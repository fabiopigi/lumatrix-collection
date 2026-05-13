"use client";

import { ModalShell } from "./modal-shell";

interface AddPageModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (copy: boolean) => void;
}

export function AddPageModal({ open, onClose, onAdd }: AddPageModalProps) {
  if (!open) return null;
  return (
    <ModalShell onClose={onClose} width={380}>
      <h2 className="m-0 mb-3 text-[13px] font-semibold">Add page</h2>
      <p className="text-[#888] text-xs m-0 mb-4">
        Pages share the same matrix configuration. The new page is inserted
        after the current page.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAdd(false)}
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-[#4a90e2] text-[#06121e] border border-[#4a90e2] font-semibold hover:bg-[#5fa0ee]"
        >
          Empty page
        </button>
        <button
          type="button"
          onClick={() => onAdd(true)}
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-[#22222a] border border-[#2f2f37] text-foreground hover:bg-[#2c2c34]"
        >
          Copy current
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto px-3 py-1.5 rounded text-xs cursor-pointer bg-[#22222a] border border-[#2f2f37] text-foreground hover:bg-[#2c2c34]"
        >
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}
