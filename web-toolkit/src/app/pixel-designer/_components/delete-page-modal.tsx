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
    <ModalShell onClose={onClose} className="w-[420px]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[15px] font-semibold text-foreground">
            Delete what?
          </div>
          <div className="text-[11px] text-[#777] mt-0.5">
            <span className="font-mono text-[#aaa]">
              #{pageIndex + 1} {pageLabel}
            </span>
            {" — "}
            {variantCount} variant{variantCount === 1 ? "" : "s"}
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

      <div className="flex flex-col gap-1.5 mb-3">
        <ActionRow
          label={`Delete this variant (${activePresetLabel})`}
          hint={
            canDeleteVariant
              ? "Keeps the page and its other variants. The active variant is removed for this page only."
              : "This is the page's only variant — deleting it would leave the page unrenderable. Use “delete entire page” instead."
          }
          disabled={!canDeleteVariant}
          onClick={onDeleteVariant}
        />
        <ActionRow
          label="Delete the entire page"
          hint={
            canDeletePage
              ? `Removes the page and all ${variantCount} variant${variantCount === 1 ? "" : "s"} on it.`
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
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-[#22222a] border border-[#2f2f37] text-foreground hover:bg-[#2c2c34]"
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
          ? "bg-[#0a0a0c]/30 border-[#1f1f25] text-[#555] cursor-not-allowed"
          : danger
            ? "bg-[#1a0a0a] border-[#3a2020] text-[#ff8888] hover:bg-[#2a1010] hover:border-[#5a3030] cursor-pointer"
            : "bg-[#0a0a0c] border-[#2a2a30] text-foreground hover:bg-[#101015] hover:border-[#3a3a42] cursor-pointer"
      }`}
    >
      <div className="text-xs font-medium">{label}</div>
      <div
        className={`text-[10.5px] mt-0.5 leading-[1.4] ${disabled ? "text-[#444]" : danger ? "text-[#cc6666]" : "text-[#777]"}`}
      >
        {hint}
      </div>
    </button>
  );
}
