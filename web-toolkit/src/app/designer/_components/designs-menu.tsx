"use client";

import { useEffect, useRef, useState } from "react";

interface DesignsMenuProps {
  currentName: string;
  isScratch: boolean;
  onNew: () => void;
  onSaveAs: () => void;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}

/** The "current design" name + dropdown menu shown in the designer header.
 *  The button itself is the design name (italicised for scratch, since
 *  scratch isn't a saved entry); the dropdown houses the menu actions. */
export function DesignsMenu({
  currentName,
  isScratch,
  onNew,
  onSaveAs,
  onOpen,
  onRename,
  onDelete,
}: DesignsMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Design library"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover max-w-[200px]"
      >
        <span
          className={`truncate ${isScratch ? "italic text-muted" : ""}`}
        >
          {currentName}
        </span>
        <span className="text-muted text-[10px] leading-none">▾</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 z-30 w-52 rounded border border-line-strong bg-panel shadow-[0_8px_32px_rgba(0,0,0,0.5)] py-1"
        >
          <MenuItem onClick={run(onNew)} label="New" hint="⌘N" />
          <MenuItem onClick={run(onSaveAs)} label="Save as…" />
          <MenuItem onClick={run(onOpen)} label="Open…" />
          <MenuDivider />
          <MenuItem
            onClick={run(onRename)}
            label="Rename…"
            disabled={isScratch}
            disabledHint="scratch can't be renamed — Save as… first"
          />
          <MenuItem
            onClick={run(onDelete)}
            label="Delete"
            danger
            disabled={isScratch}
            disabledHint="scratch can't be deleted"
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  hint,
  onClick,
  disabled,
  danger,
  disabledHint,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  disabledHint?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "text-danger hover:bg-danger-soft"
          : "text-foreground hover:bg-raised"
      }`}
    >
      <span>{label}</span>
      {hint && (
        <span className="font-mono text-[10px] text-fg-faint">{hint}</span>
      )}
    </button>
  );
}

function MenuDivider() {
  return <div className="h-px bg-line-strong my-1 mx-1" />;
}
