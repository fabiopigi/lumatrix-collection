"use client";

import { useEffect, useRef, useState } from "react";
import { ModalShell } from "./modal-shell";

interface DesignNameModalProps {
  open: boolean;
  title: string;
  /** Initial value of the input (e.g. existing name when renaming). */
  initialValue: string;
  /** Label on the confirm button (e.g. "Save", "Rename"). */
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}

/** Shared text-input modal used by Save as… and Rename. Pre-fills the input
 *  and pre-selects it so the user can either type a fresh name or tweak the
 *  existing one without an extra select-all keystroke. */
export function DesignNameModal(props: DesignNameModalProps) {
  if (!props.open) return null;
  return <DesignNameModalInner {...props} />;
}

function DesignNameModalInner({
  title,
  initialValue,
  confirmLabel,
  onClose,
  onConfirm,
}: Omit<DesignNameModalProps, "open">) {
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
        aria-label="Design name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        maxLength={80}
        placeholder="Name your design"
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
