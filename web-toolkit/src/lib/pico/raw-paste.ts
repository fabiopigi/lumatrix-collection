/**
 * MicroPython raw-paste mode — window-based flow control for sending large
 * chunks of code without overflowing the device's USB-CDC RX buffer.
 *
 * Protocol (entered from inside raw REPL at the `>` prompt):
 *   client → 0x05 0x41 0x01            (Ctrl-E A Ctrl-A: enter raw paste)
 *   server → 'R' + flag                (0x52 0x01 = supported; 0x52 0x00 = not)
 *   server → 2 bytes window-size LE + 0x01    (initial ready ack)
 *   loop:
 *     client streams data; server sends 0x01 each time it has consumed
 *     `window_size` bytes (i.e. we may have up to `window_size` bytes in
 *     flight). Server may also send 0x04 to abort.
 *   client → 0x04                      (end of data)
 *   server → 0x04                      (end-of-paste confirm; may be preceded
 *                                       by extra 0x01 acks)
 *   server → standard raw-REPL output: "OK" + stdout + 0x04 + stderr + 0x04 + ">"
 */

import { PicoSerial } from "./serial";

export class RawPasteUnsupportedError extends Error {
  constructor() {
    super("Pico firmware doesn't support raw-paste mode");
    this.name = "RawPasteUnsupportedError";
  }
}

/** Send `data` to the Pico using raw-paste flow control. Caller must already
 *  be at the raw REPL `>` prompt. After this returns, the device starts
 *  executing and will produce the standard raw-REPL response. */
export async function sendRawPaste(
  serial: PicoSerial,
  data: Uint8Array,
): Promise<void> {
  await serial.write(new Uint8Array([0x05, 0x41, 0x01]));

  const header = await serial.readN(2, 2_000, "raw-paste header");
  if (header[0] !== 0x52) {
    throw new Error(
      `Unexpected raw-paste header byte: 0x${header[0].toString(16)}`,
    );
  }
  if (header[1] === 0x00) throw new RawPasteUnsupportedError();
  if (header[1] !== 0x01) {
    throw new Error(`Unexpected raw-paste flag: 0x${header[1].toString(16)}`);
  }

  const winAck = await serial.readN(3, 2_000, "raw-paste window+ack");
  const windowSize = winAck[0] | (winAck[1] << 8);
  if (winAck[2] !== 0x01) {
    throw new Error(
      `Expected initial ack 0x01, got 0x${winAck[2].toString(16)}`,
    );
  }

  let remaining = windowSize;
  let offset = 0;

  while (offset < data.length) {
    // Drain any acks waiting in the buffer first — lets us refill credit
    // without forcing a synchronous wait on every window boundary.
    while (remaining === 0 || serial.hasPendingByte()) {
      const ack = await serial.readN(1, 10_000, "raw-paste ack");
      if (ack[0] === 0x01) {
        remaining += windowSize;
      } else if (ack[0] === 0x04) {
        throw new Error("Pico aborted raw-paste mode");
      } else {
        throw new Error(
          `Unexpected raw-paste byte: 0x${ack[0].toString(16)}`,
        );
      }
    }

    const chunk = Math.min(remaining, data.length - offset);
    await serial.write(data.subarray(offset, offset + chunk));
    offset += chunk;
    remaining -= chunk;
  }

  // End-of-data marker.
  await serial.write(new Uint8Array([0x04]));

  // Device may emit more 0x01 acks before the final 0x04 end-of-paste signal.
  while (true) {
    const b = await serial.readN(1, 5_000, "end-of-paste ack");
    if (b[0] === 0x04) return;
    if (b[0] !== 0x01) {
      throw new Error(
        `Unexpected byte after end-of-data: 0x${b[0].toString(16)}`,
      );
    }
  }
}
