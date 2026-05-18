"use client";

import { useState } from "react";
import { requestPort } from "@/lib/pico/serial";

interface Props {
  /** `null` = still checking, `false` = unsupported, `true` = ready. */
  supported: boolean | null;
  onConnected(port: SerialPort): void;
}

export function StepConnect({ supported, onConnected }: Props) {
  const [showFirmware, setShowFirmware] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    try {
      const p = await requestPort();
      onConnected(p);
    } catch (err) {
      // The user cancelling the OS picker also throws — surface a friendly note.
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("user cancel") || msg.includes("No port selected") ? null : msg);
    }
  };

  if (supported === null) {
    return <p className="text-[12px] text-muted">Checking browser support…</p>;
  }

  if (!supported) {
    return (
      <section>
        <h2 className="text-[13px] font-semibold tracking-[0.04em] text-white">
          Your browser doesn&apos;t support Web Serial
        </h2>
        <p className="mt-2 text-[12px] text-muted leading-relaxed max-w-prose">
          LumenFlash needs the Web Serial API to talk to the Pico. Open this
          page in a Chromium-based browser (Chrome, Edge, Brave, Opera) on a
          desktop OS.
        </p>
        <p className="mt-3 text-[12px] text-muted leading-relaxed max-w-prose">
          Or follow the manual deploy guide in{" "}
          <a
            href="https://github.com/fabiopigi/lumenlab/blob/main/docs/AUTHORING.md#files-to-copy-to-the-pico"
            className="text-accent underline"
            target="_blank"
            rel="noreferrer"
          >
            docs/AUTHORING.md
          </a>
          .
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-[13px] font-semibold tracking-[0.04em] text-white">
        Plug your Pico in and connect
      </h2>
      <p className="mt-1 text-[12px] text-muted leading-relaxed max-w-prose">
        Plug the Pico into USB. Click below, then pick its serial port in
        the OS dialog — it&apos;s the one labelled <span className="font-mono text-foreground">Board in FS mode</span>{" "}
        or with a vendor ID starting <span className="font-mono text-foreground">2e8a</span>.
      </p>

      <div className="mt-5">
        <button
          type="button"
          onClick={onClick}
          className="rounded bg-accent px-5 py-2.5 text-[13px] font-semibold tracking-[0.04em] text-black cursor-pointer hover:bg-accent/90"
        >
          Connect Pico
        </button>
      </div>

      {error && (
        <p className="mt-3 text-[12px] text-red-300">Connection failed: {error}</p>
      )}

      <div className="mt-8 border-t border-edge pt-4">
        <button
          type="button"
          onClick={() => setShowFirmware((v) => !v)}
          className="text-[12px] tracking-[0.04em] text-muted hover:text-foreground cursor-pointer"
        >
          {showFirmware ? "−" : "+"} First time? Install MicroPython firmware
        </button>
        {showFirmware && (
          <div className="mt-3 text-[12px] text-muted leading-relaxed max-w-prose space-y-2">
            <p>
              The Pico needs MicroPython firmware before LumenFlash can talk
              to it. One-time setup:
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Hold down the white <span className="font-semibold">BOOTSEL</span> button on the Pico while plugging it into USB.
              </li>
              <li>
                The Pico shows up as a USB drive named{" "}
                <span className="font-mono text-foreground">RPI-RP2</span>.
              </li>
              <li>
                Download the latest MicroPython UF2 from{" "}
                <a
                  href="https://micropython.org/download/RPI_PICO/"
                  className="text-accent underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  micropython.org/download/RPI_PICO
                </a>{" "}
                and drag it onto the drive.
              </li>
              <li>
                The Pico reboots, the drive disappears, and a serial port
                shows up instead. Come back here and click Connect.
              </li>
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
