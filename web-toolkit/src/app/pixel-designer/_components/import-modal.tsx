"use client";

import { useEffect, useRef, useState } from "react";
import { ModalShell } from "./modal-shell";

interface ImportModalProps {
  open: boolean;
  value: string;
  onValueChange: (v: string) => void;
  onImport: () => void;
  onImageImport: (file: File) => void | Promise<void>;
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
  onImageImport,
  error,
  onClose,
}: Omit<ImportModalProps, "open">) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [importingImage, setImportingImage] = useState(false);

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

  const handleImageFile = async (file: File) => {
    setImportingImage(true);
    try {
      await onImageImport(file);
    } finally {
      setImportingImage(false);
    }
  };

  return (
    <ModalShell onClose={onClose} className="w-[560px] max-h-[88vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[15px] font-semibold text-foreground">Import</div>
          <div className="text-[11px] text-[#777] mt-0.5">
            Paste a design JSON below or load a .json file (replaces the
            current design). Or import a PNG / GIF to append it as new pages
            on the active hardware variant — GIF frames become consecutive
            pages with their frame delays as page durations.
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[#888] hover:text-foreground cursor-pointer text-xl leading-none px-2"
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
        className="w-full h-[280px] bg-[#0a0a0c] border border-edge text-foreground p-2 rounded font-mono text-[11px] leading-[1.4] resize-y outline-none focus:border-[#4a90e2] focus:bg-[#0e0e12] select-text"
      />

      {error && (
        <div className="mt-2 text-[11px] text-[#ff8888] font-mono">{error}</div>
      )}

      <div className="flex justify-between mt-3 gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={readingFile || importingImage}
            className="px-3 py-1.5 rounded text-xs cursor-pointer bg-[#22222a] border border-[#2f2f37] text-foreground hover:bg-[#2c2c34] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {readingFile ? "Reading…" : "Load JSON…"}
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
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={readingFile || importingImage}
            className="px-3 py-1.5 rounded text-xs cursor-pointer bg-[#22222a] border border-[#2f2f37] text-foreground hover:bg-[#2c2c34] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importingImage ? "Importing…" : "Import PNG / GIF…"}
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/gif,.png,.gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageFile(f);
              e.currentTarget.value = "";
            }}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs cursor-pointer bg-[#22222a] border border-[#2f2f37] text-foreground hover:bg-[#2c2c34]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={value.trim() === ""}
            className="px-3 py-1.5 rounded text-xs cursor-pointer bg-[#4a90e2] text-[#06121e] border border-[#4a90e2] font-semibold hover:bg-[#5fa0ee] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#4a90e2]"
          >
            Import
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
