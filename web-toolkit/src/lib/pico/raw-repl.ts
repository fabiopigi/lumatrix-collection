/**
 * MicroPython raw REPL protocol over an open PicoSerial.
 *
 * Sequence we expect when entering raw REPL:
 *   client → 0x03 0x03   (interrupt any running program twice)
 *   client → 0x01        (request raw REPL mode)
 *   server → "raw REPL; CTRL-B to exit\r\n>"
 *
 * Per-statement execute:
 *   client → code bytes + 0x04   (Ctrl-D commits)
 *   server → "OK"                (code accepted)
 *   server → stdout + 0x04
 *   server → stderr + 0x04       (empty if successful)
 *   server → ">"                  (back at raw prompt)
 *
 * Exit raw REPL: send 0x02. Soft-reboot: send 0x04 from the normal REPL,
 * which we issue by sending 0x02 followed by 0x04.
 */

import { PicoSerial, bytes, decodeAscii } from "./serial";
import { RawPasteUnsupportedError, sendRawPaste } from "./raw-paste";

const RAW_PROMPT = bytes("raw REPL; CTRL-B to exit\r\n>");
const EOT = new Uint8Array([0x04]);
const PROMPT = bytes(">");
const OK = bytes("OK");

export class PicoReplError extends Error {
  constructor(message: string, readonly stderr?: string) {
    super(message);
    this.name = "PicoReplError";
  }
}

export async function interrupt(serial: PicoSerial): Promise<void> {
  await serial.write(new Uint8Array([0x03, 0x03]));
  // Give the Pico a moment to print the >>> prompt before we discard it.
  await new Promise((r) => setTimeout(r, 100));
  serial.flushBuffer();
}

export async function enterRaw(serial: PicoSerial): Promise<void> {
  await interrupt(serial);
  await serial.write(new Uint8Array([0x01]));
  try {
    await serial.readUntil(RAW_PROMPT, 2000, "raw REPL prompt");
  } catch {
    throw new PicoReplError(
      "Pico didn't respond to raw REPL request — try unplugging and replugging.",
    );
  }
  // Soft-reset inside raw REPL to free all heap allocated by the previously-
  // running launcher (apps, fonts, screens, NeoPixel buffer). Without this we
  // hit MemoryError when uploading even moderately-sized files. boot.py/main.py
  // don't re-run during a raw-REPL soft reset; the device just re-emits the
  // raw REPL banner with a fresh interpreter.
  await serial.write(new Uint8Array([0x04]));
  try {
    await serial.readUntil(RAW_PROMPT, 5000, "raw REPL prompt after soft reset");
  } catch {
    throw new PicoReplError(
      "Pico didn't return to raw REPL after soft reset.",
    );
  }
}

export async function exitRaw(serial: PicoSerial): Promise<void> {
  await serial.write(new Uint8Array([0x02]));
}

/** Soft-reset the Pico from inside raw REPL. After this, the device reboots
 *  and runs main.py. The serial connection survives the reboot. */
export async function softReset(serial: PicoSerial): Promise<void> {
  // Exit raw mode first; from the friendly REPL, Ctrl-D triggers soft reboot.
  await exitRaw(serial);
  await new Promise((r) => setTimeout(r, 50));
  await serial.write(new Uint8Array([0x04]));
}

export interface ExecResult {
  readonly stdout: string;
  readonly stderr: string;
}

/** Run a single statement (or block) in raw REPL. Returns stdout/stderr.
 *  Throws PicoReplError if the Pico rejects the code or returns a non-empty
 *  stderr. The serial position is expected to be at the raw `>` prompt
 *  when calling, and is left at the `>` prompt when returning.
 *
 *  Uses raw-paste mode (window-based flow control) by default — necessary
 *  for any statement bigger than the Pico's USB-CDC RX buffer. Falls back to
 *  the naïve "blast + Ctrl-D" path only on firmwares without raw-paste. */
export async function execute(
  serial: PicoSerial,
  code: string,
  timeoutMs = 30_000,
): Promise<ExecResult> {
  const codeBytes = bytes(code);
  let usedRawPaste = true;
  try {
    await sendRawPaste(serial, codeBytes);
  } catch (err) {
    if (err instanceof RawPasteUnsupportedError) {
      // Fallback: blast the bytes + Ctrl-D. Only safe for short statements
      // that fit in the Pico's RX buffer (~256 B). Emits the legacy "OK" ack.
      usedRawPaste = false;
      await serial.write(codeBytes);
      await serial.write(EOT);
    } else {
      throw err;
    }
  }

  // The fallback path is the only one that emits "OK" — raw-paste already
  // proved the parser accepted the code by consuming all the bytes, so the
  // device skips straight to the stdout/stderr framing after end-of-paste.
  if (!usedRawPaste) {
    const okResp = await serial.readN(2, 5_000, "OK ack");
    const okText = decodeAscii(okResp);
    if (okText !== "OK") {
      throw new PicoReplError(
        `Pico rejected code (expected "OK", got "${okText}")`,
      );
    }
  }

  const stdoutPlus = await serial.readUntil(EOT, timeoutMs, "stdout terminator");
  const stdout = decodeAscii(stdoutPlus.subarray(0, stdoutPlus.length - 1));

  const stderrPlus = await serial.readUntil(EOT, timeoutMs, "stderr terminator");
  const stderr = decodeAscii(stderrPlus.subarray(0, stderrPlus.length - 1));

  // Drain the trailing ">" prompt so the next execute starts cleanly.
  await serial.readUntil(PROMPT, 2_000, "raw prompt");

  if (stderr.trim().length > 0) {
    throw new PicoReplError(`Pico runtime error: ${stderr.trim()}`, stderr);
  }
  return { stdout, stderr };
}

// Re-export for convenience.
export { OK };
