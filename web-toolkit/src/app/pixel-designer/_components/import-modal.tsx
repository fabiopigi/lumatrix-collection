"use client";

import { useEffect, useRef, useState } from "react";
import { ModalShell } from "./modal-shell";

interface ImportModalProps {
  open: boolean;
  value: string;
  onValueChange: (v: string) => void;
  onImport: () => void;
  error: string | null;
  onClose: () => void;
}

export function ImportModal(props: ImportModalProps) {
  if (!props.open) return null;
  return <ImportModalInner {...props} />;
}

function ImportModalInner({
  value,
  onValueChange,
  onImport,
  error,
  onClose,
}: Omit<ImportModalProps, "open">) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [readingFile, setReadingFile] = useState(false);

  // Focus the textarea on open so the user can paste immediately. The modal
  // mounts when `open` flips to true, so an effect tied to first mount is the
  // right hook.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleFile = async (file: File) => {
    setReadingFile(true);
    try {
      const text = await file.text();
      onValueChange(text);
    } finally {
      setReadingFile(false);
    }
  };

  return (
    <ModalShell onClose={onClose} label="Import design" className="w-[560px] max-h-[88vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[15px] font-semibold text-foreground">Import</div>
          <div className="text-[11px] text-fg-faint mt-0.5">
            Paste a design JSON below or load a .json file. Importing replaces
            the current design.
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-foreground cursor-pointer text-xl leading-none px-2"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        spellCheck={false}
        placeholder='Paste design JSON here. Use Export… to produce one.'
        className="w-full h-[280px] bg-sunken border border-edge text-foreground p-2 rounded font-mono text-[11px] leading-[1.4] resize-y outline-none focus:border-cta focus:bg-input-focus select-text"
      />

      {error && (
        <div className="mt-2 text-[11px] text-danger font-mono">{error}</div>
      )}

      <div className="flex justify-between mt-3 gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={readingFile}
            className="px-3 py-1.5 rounded text-xs cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover"
          >
            {readingFile ? "Reading…" : "Load file…"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.currentTarget.value = "";
            }}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={value.trim() === ""}
            className="px-3 py-1.5 rounded text-xs cursor-pointer bg-cta text-cta-fg border border-cta font-semibold hover:bg-cta-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cta"
          >
            Import
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
