/**
 * Orchestrates the LumenFlash upload: connect → interrupt → mkdir directories
 * → write each file via base64-in-raw-REPL → write config.py → soft-reset.
 *
 * Files are sent as one execute() per file: a single Python statement that
 * decodes a base64 literal and writes it. Works comfortably for ≤25 KB files
 * on the Pico (our largest, fonts.json, is ~23 KB raw / ~31 KB base64). If
 * that ever stops fitting in MicroPython's parser, we drop in raw-paste mode.
 */

import { fetchBundleFile, type BundleFile } from "./manifest";
import { renderConfigPy, type PicoConfig } from "./config-py";
import { enterRaw, execute, softReset } from "./raw-repl";
import { PicoSerial } from "./serial";

export type UploadStatus = "queued" | "uploading" | "done" | "failed";

export interface UploadFileState {
  readonly src: string;
  readonly pico: string;
  readonly bytes: number;
  status: UploadStatus;
  error?: string;
}

export type UploadEvent =
  | { type: "files"; files: UploadFileState[] }
  | { type: "progress"; index: number; status: UploadStatus; error?: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
  | { type: "done" }
  | { type: "failed"; error: string };

export type UploadListener = (e: UploadEvent) => void;

/** Convert a byte array to a base64 ASCII string. Avoids the
 *  String.fromCharCode allocation blowup for our small files. */
function toBase64(data: Uint8Array): string {
  let bin = "";
  // Chunk to keep argument count under engine limits.
  const CHUNK = 0x8000;
  for (let i = 0; i < data.length; i += CHUNK) {
    bin += String.fromCharCode(...data.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** Largest raw byte slice we send per execute() call. The statement we wrap
 *  it in becomes `f.write(binascii.a2b_base64(b"<base64>"))` — at this size
 *  the source is ~4.4 KB, well under what the Pico's parser can handle in
 *  raw-paste mode after the launcher has already allocated its working set. */
const FILE_CHUNK_BYTES = 3 * 1024;

function assertSafePath(picoPath: string): void {
  if (picoPath.includes('"') || picoPath.includes("\\")) {
    throw new Error(`Refusing to upload to unsafe path ${picoPath}`);
  }
}

function openFileStatement(picoPath: string): string {
  assertSafePath(picoPath);
  return [
    `import binascii`,
    `_f = open("${picoPath}", "wb")`,
  ].join("\n");
}

function writeChunkStatement(base64: string): string {
  return `_f.write(binascii.a2b_base64(b"${base64}"))`;
}

const CLOSE_STATEMENT = `_f.close()\ndel _f`;

function mkdirStatement(picoDir: string): string {
  assertSafePath(picoDir);
  return [
    `import os`,
    `try:`,
    `    os.mkdir("${picoDir}")`,
    `except OSError:`,
    `    pass`,
  ].join("\n");
}

/** Stream one file to the Pico as a sequence of small base64 chunks. Opens
 *  the file once, writes each chunk in its own execute(), then closes. Keeps
 *  the parser source string under FILE_CHUNK_BYTES on the device side. */
async function writeFileChunked(
  serial: PicoSerial,
  picoPath: string,
  data: Uint8Array,
): Promise<void> {
  await execute(serial, openFileStatement(picoPath), 10_000);
  try {
    for (let offset = 0; offset < data.length; offset += FILE_CHUNK_BYTES) {
      const chunk = data.subarray(offset, offset + FILE_CHUNK_BYTES);
      const b64 = toBase64(chunk);
      await execute(serial, writeChunkStatement(b64), 30_000);
    }
  } finally {
    // Best-effort close even if a write failed — leaves the Pico's filesystem
    // in a clean state for the next attempt.
    await execute(serial, CLOSE_STATEMENT, 5_000).catch(() => undefined);
  }
}

function dirsFor(files: ReadonlyArray<{ pico: string }>): string[] {
  const dirs = new Set<string>();
  for (const f of files) {
    const idx = f.pico.lastIndexOf("/");
    if (idx > 0) dirs.add(f.pico.slice(0, idx));
  }
  // Sort by depth so parents come first.
  return Array.from(dirs).sort((a, b) => a.length - b.length);
}

export interface UploadPlan {
  /** Bundle files that ship verbatim (core + data + selected apps). */
  readonly files: ReadonlyArray<BundleFile>;
  /** Per-user config written last so a partial upload doesn't leave stale config. */
  readonly config: PicoConfig;
}

export async function runUpload(
  port: SerialPort,
  plan: UploadPlan,
  emit: UploadListener,
): Promise<void> {
  const log = (message: string) => {
    emit({ type: "log", level: "info", message });
    // Mirror to the DevTools console so we still have a trail if the UI
    // freezes or never receives the event.
    console.log("[lumenflash]", message);
  };
  log("Opening serial port…");
  const serial = new PicoSerial(port);
  try {
    await serial.open();
    log("Interrupting and entering raw REPL…");
    await enterRaw(serial);

    // Pre-fetch every file from the dev server so progress reflects pure Pico
    // upload time, not download time. Also lets us fail fast if the bundle is
    // missing pieces.
    log(`Fetching bundle (${plan.files.length} files)…`);
    const bundles: Array<{ src: string; pico: string; data: Uint8Array }> = [];
    for (let i = 0; i < plan.files.length; i++) {
      const f = plan.files[i];
      log(`  [${i + 1}/${plan.files.length}] fetching ${f.src}…`);
      const data = await fetchBundleFile(f.src);
      bundles.push({ src: f.src, pico: f.pico, data });
    }

    // Generate config.py text and treat it as the final file.
    const configText = renderConfigPy(plan.config);
    const configBytes = new TextEncoder().encode(configText);
    bundles.push({ src: "config.py", pico: "/config.py", data: configBytes });

    // Announce the file list so the UI can render rows up-front.
    const fileStates: UploadFileState[] = bundles.map((b) => ({
      src: b.src,
      pico: b.pico,
      bytes: b.data.length,
      status: "queued",
    }));
    emit({ type: "files", files: fileStates });

    // Make any directories the files need (e.g. /apps).
    const dirs = dirsFor(bundles);
    if (dirs.length) log(`Creating directories: ${dirs.join(", ")}`);
    for (const d of dirs) {
      if (d === "" || d === "/") continue;
      await execute(serial, mkdirStatement(d), 10_000);
    }

    // Upload one file at a time, chunked. Sequential keeps Pico RAM usage
    // low; the bottleneck is USB CDC throughput either way.
    log(`Writing ${bundles.length} files to the Pico…`);
    for (let i = 0; i < bundles.length; i++) {
      const { data, pico } = bundles[i];
      const chunks = Math.max(1, Math.ceil(data.length / FILE_CHUNK_BYTES));
      log(`  [${i + 1}/${bundles.length}] writing ${pico} (${data.length} B / ${chunks} chunk${chunks === 1 ? "" : "s"})…`);
      emit({ type: "progress", index: i, status: "uploading" });
      try {
        await writeFileChunked(serial, pico, data);
        emit({ type: "progress", index: i, status: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit({ type: "progress", index: i, status: "failed", error: message });
        emit({ type: "failed", error: message });
        return;
      }
    }

    log("Soft-resetting Pico…");
    await softReset(serial);

    // Give the reboot a beat to land before we drop the port — otherwise the
    // Pico's USB CDC re-enumerates on top of an open writer and macOS gets
    // grumpy.
    await new Promise((r) => setTimeout(r, 500));
    emit({ type: "done" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({ type: "failed", error: message });
  } finally {
    await serial.close();
  }
}

