/**
 * Thin wrapper over Web Serial: opens a port, runs a background reader that
 * fills a byte buffer, and exposes consumer primitives (readUntil, readN,
 * write). Designed for short interactions like the MicroPython raw REPL —
 * nothing here is optimised for streaming.
 *
 * Web Serial is Chromium-only and requires HTTPS or localhost. Callers should
 * gate on `isWebSerialSupported()` before instantiating.
 */

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function bytes(s: string): Uint8Array {
  return encoder.encode(s);
}

export function decodeAscii(b: Uint8Array): string {
  return decoder.decode(b);
}

/** Open the OS port picker. Resolves with the chosen SerialPort. */
export async function requestPort(): Promise<SerialPort> {
  // The user gesture must come from a real DOM click.
  return navigator.serial.requestPort();
}

export class PicoSerial {
  private readonly port: SerialPort;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private buffer: number[] = [];
  private waiters: Array<() => void> = [];
  private readLoop: Promise<void> | null = null;
  private aborted = false;

  constructor(port: SerialPort) {
    this.port = port;
  }

  async open(baudRate = 115200): Promise<void> {
    // port.open() throws synchronously-ish "The port is already open." if a
    // previous run (e.g. before a hot-reload) didn't release it. Treat that
    // as a reusable port: the streams from the previous open are still on
    // `this.port`, so we just attach new reader/writer locks.
    try {
      const openPromise = this.port.open({ baudRate });
      // Defensively cap how long we'll wait for open() — a hung serial layer
      // shouldn't pin the UI on "Starting…" forever.
      const timed = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Timed out opening serial port (5 s).")), 5_000),
      );
      await Promise.race([openPromise, timed]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already open/i.test(msg)) {
        throw err;
      }
      // Fall through — we'll try to reuse the existing streams below.
    }
    if (!this.port.writable || !this.port.readable) {
      throw new Error("Serial port has no readable/writable streams.");
    }
    try {
      this.writer = this.port.writable.getWriter();
    } catch (err) {
      throw new Error(
        `Couldn't acquire writer (port may be in use by another tab): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    this.readLoop = this.runReadLoop();
  }

  async close(): Promise<void> {
    this.aborted = true;
    try {
      this.writer?.releaseLock();
    } catch {
      /* ignore */
    }
    this.writer = null;
    try {
      await this.port.close();
    } catch {
      /* ignore */
    }
    await this.readLoop?.catch(() => undefined);
  }

  private async runReadLoop(): Promise<void> {
    const readable = this.port.readable;
    if (!readable) return;
    const reader = readable.getReader();
    try {
      while (!this.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && value.length) {
          for (const b of value) this.buffer.push(b);
          for (const cb of this.waiters.splice(0)) cb();
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.writer) throw new Error("Serial port is not open");
    await this.writer.write(data);
  }

  async writeText(s: string): Promise<void> {
    await this.write(bytes(s));
  }

  /** Drain whatever is currently buffered; non-blocking. */
  flushBuffer(): Uint8Array {
    const out = new Uint8Array(this.buffer);
    this.buffer = [];
    return out;
  }

  /** True if at least one byte is currently buffered — lets streaming code
   *  opportunistically drain acks without blocking. */
  hasPendingByte(): boolean {
    return this.buffer.length > 0;
  }

  private findMarker(marker: Uint8Array): number {
    if (marker.length === 0) return 0;
    const last = this.buffer.length - marker.length;
    outer: for (let i = 0; i <= last; i++) {
      for (let j = 0; j < marker.length; j++) {
        if (this.buffer[i + j] !== marker[j]) continue outer;
      }
      return i;
    }
    return -1;
  }

  private waitForData(timeoutMs: number, label: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        const i = this.waiters.indexOf(notify);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(new Error(`Timed out waiting for ${label}`));
      }, timeoutMs);
      const notify = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      this.waiters.push(notify);
    });
  }

  /** Read (and consume) bytes from the buffer up to and including `marker`. */
  async readUntil(marker: Uint8Array, timeoutMs: number, label?: string): Promise<Uint8Array> {
    const deadline = Date.now() + timeoutMs;
    const lbl = label ?? decodeAscii(marker);
    for (;;) {
      const idx = this.findMarker(marker);
      if (idx >= 0) {
        const end = idx + marker.length;
        const result = new Uint8Array(this.buffer.slice(0, end));
        this.buffer.splice(0, end);
        return result;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error(`Timed out waiting for ${lbl}`);
      }
      await this.waitForData(remaining, lbl);
    }
  }

  /** Read (and consume) exactly N bytes. */
  async readN(n: number, timeoutMs: number, label = `${n} bytes`): Promise<Uint8Array> {
    const deadline = Date.now() + timeoutMs;
    while (this.buffer.length < n) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error(`Timed out waiting for ${label}`);
      }
      await this.waitForData(remaining, label);
    }
    const result = new Uint8Array(this.buffer.slice(0, n));
    this.buffer.splice(0, n);
    return result;
  }
}
