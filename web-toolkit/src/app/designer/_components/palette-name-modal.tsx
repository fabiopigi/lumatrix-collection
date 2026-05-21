"use client";

import { useEffect, useRef, useState } from "react";
import { ModalShell } from "./modal-shell";

interface PaletteNameModalProps {
  open: boolean;
  title: string;
  initialValue: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}

/** Tiny text-input modal for Save / Rename of a custom palette. Mirrors
 *  DesignNameModal but stays separate so the two can diverge (palette names
 *  have a different aria label and may grow palette-specific affordances). */
export function PaletteNameModal(props: PaletteNameModalProps) {
  if (!props.open) return null;
  return <PaletteNameModalInner {...props} />;
}

function PaletteNameModalInner({
  title,
  initialValue,
  confirmLabel,
  onClose,
  onConfirm,
}: Omit<PaletteNameModalProps, "open">) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  const canSubmit = value.trim().length > 0;

  return (
    <ModalShell onClose={onClose} label={title} width={400}>
      <h2 className="m-0 mb-3 text-[13px] font-semibold">{title}</h2>
      <input
        ref={inputRef}
        type="text"
        aria-label="Palette name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        maxLength={80}
        placeholder="Name your palette"
        className="w-full bg-sunken border border-edge text-foreground px-2 py-1.5 rounded text-xs outline-none focus:border-cta focus:bg-input-focus select-text mb-3"
      />
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-cta text-cta-fg border border-cta font-semibold hover:bg-cta-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cta"
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
