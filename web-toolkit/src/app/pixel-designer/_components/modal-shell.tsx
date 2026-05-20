"use client";

import { useEffect, useRef } from "react";

interface ModalShellProps {
  onClose: () => void;
  /** Short, plain-language name of the dialog for screen readers (e.g. "Add
   *  page", "Export"). Required — the dialog has no accessible name without
   *  it. */
  label: string;
  width?: number;
  className?: string;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function ModalShell({
  onClose,
  label,
  width,
  className,
  children,
}: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Send focus into the dialog so keyboard / screen-reader users land
    // inside it rather than continuing from wherever the trigger button was.
    const focusables = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusables[0] ?? dialog).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // Recompute on each keypress — modals can toggle disabled buttons,
      // open inner sections, etc. Querying once on mount would go stale.
      const items = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const outside = !active || !dialog.contains(active);
      if (e.shiftKey) {
        if (outside || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (outside || active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Return focus to the element that opened the modal. Guarded against
      // the trigger having been removed from the DOM while the modal was open.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`bg-panel border border-[#2a2a30] rounded-lg p-4 max-w-[90vw] outline-none ${className ?? ""}`}
        style={width ? { width } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
