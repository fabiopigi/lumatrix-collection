"use client";

import { ModalShell } from "./modal-shell";

interface DeletePageModalProps {
  open: boolean;
  pageLabel: string;
  pageIndex: number;
  variantCount: number;
  activePresetLabel: string;
  /** Can we drop a variant without leaving the page empty? */
  canDeleteVariant: boolean;
  /** Are there other pages, so removing this one is allowed? */
  canDeletePage: boolean;
  onDeleteVariant: () => void;
  onDeletePage: () => void;
  onClose: () => void;
}

export function DeletePageModal(props: DeletePageModalProps) {
  if (!props.open) return null;
  return <DeletePageModalInner {...props} />;
}

function DeletePageModalInner({
  pageLabel,
  pageIndex,
  variantCount,
  activePresetLabel,
  canDeleteVariant,
  canDeletePage,
  onDeleteVariant,
  onDeletePage,
  onClose,
}: Omit<DeletePageModalProps, "open">) {
  return (
    <ModalShell onClose={onClose} label="Delete page or variant" className="w-[420px]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[15px] font-semibold text-foreground">
            Delete what?
          </div>
          <div className="text-[11px] text-fg-faint mt-0.5">
            <span className="font-mono text-fg-2">
              #{pageIndex + 1} {pageLabel}
            </span>
            {" · "}
            {variantCount} variant{variantCount === 1 ? "" : "s"}
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

      <div className="flex flex-col gap-1.5 mb-3">
        <ActionRow
          label={`Only this variant on this page (${activePresetLabel})`}
          hint={
            canDeleteVariant
              ? `Removes the ${activePresetLabel} variant from this page. Other pages keep their ${activePresetLabel} variants; this page keeps its other variants.`
              : "This is the page's only variant. Deleting it would leave the page unrenderable; use “Only this page” instead."
          }
          disabled={!canDeleteVariant}
          onClick={onDeleteVariant}
        />
        <ActionRow
          label="Only this page"
          hint={
            canDeletePage
              ? `Removes this page and all ${variantCount} variant${variantCount === 1 ? "" : "s"} on it. Other pages are untouched.`
              : "Can't delete the design's only page. Add another page first."
          }
          disabled={!canDeletePage}
          onClick={onDeletePage}
          danger
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover"
        >
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

function ActionRow({
  label,
  hint,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left px-3 py-2 rounded border transition-colors ${
        disabled
          ? "bg-sunken/30 border-line-mute text-fg-faint cursor-not-allowed"
          : danger
            ? "bg-[#1a0a0a] border-danger-soft text-danger hover:bg-[#2a1010] hover:border-danger-line cursor-pointer"
            : "bg-sunken border-line-strong text-foreground hover:bg-[#101015] hover:border-line-stronger cursor-pointer"
      }`}
    >
      <div className="text-xs font-medium">{label}</div>
      <div
        className={`text-[10.5px] mt-0.5 leading-[1.4] ${disabled ? "text-[#444]" : danger ? "text-[#cc6666]" : "text-fg-faint"}`}
      >
        {hint}
      </div>
    </button>
  );
}
