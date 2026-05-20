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
    <ModalShell onClose={onClose} label="Add page" width={380}>
      <h2 className="m-0 mb-3 text-[13px] font-semibold">Add page</h2>
      <p className="text-muted text-xs m-0 mb-4">
        Pages share the same matrix configuration. The new page is inserted
        after the current page.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAdd(false)}
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-cta text-cta-fg border border-cta font-semibold hover:bg-cta-hover"
        >
          Empty page
        </button>
        <button
          type="button"
          onClick={() => onAdd(true)}
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover"
        >
          Copy current
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto px-3 py-1.5 rounded text-xs cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover"
        >
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}
