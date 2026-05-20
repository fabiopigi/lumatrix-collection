"use client";

import { useEffect, useState } from "react";
import type { DesignPage } from "@/lib/pixel-designer/types";
import { ModalShell } from "./modal-shell";

export interface PageMetaPatch {
  title?: string;
  description?: string;
  duration?: number;
  fadeInTime?: number;
}

interface PageMetaModalProps {
  open: boolean;
  pageIndex: number;
  page: DesignPage | undefined;
  onClose: () => void;
  onSave: (patch: PageMetaPatch) => void;
}

export function PageMetaModal(props: PageMetaModalProps) {
  if (!props.open || !props.page) return null;
  return <PageMetaModalInner {...props} page={props.page} />;
}

function PageMetaModalInner({
  pageIndex,
  page,
  onClose,
  onSave,
}: Omit<PageMetaModalProps, "open" | "page"> & { page: DesignPage }) {
  const [title, setTitle] = useState(page.title ?? "");
  const [description, setDescription] = useState(page.description ?? "");
  const [duration, setDuration] = useState(
    page.duration !== undefined ? String(page.duration) : "",
  );
  const [fadeInTime, setFadeInTime] = useState(
    page.fadeInTime !== undefined ? String(page.fadeInTime) : "",
  );

  // Reset form whenever the modal targets a different page.
  useEffect(() => {
    setTitle(page.title ?? "");
    setDescription(page.description ?? "");
    setDuration(page.duration !== undefined ? String(page.duration) : "");
    setFadeInTime(
      page.fadeInTime !== undefined ? String(page.fadeInTime) : "",
    );
  }, [pageIndex, page]);

  const parseMs = (v: string): number | undefined => {
    const trimmed = v.trim();
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.round(n);
  };

  const handleSave = () => {
    onSave({
      title: title.trim() === "" ? undefined : title.trim(),
      description: description.trim() === "" ? undefined : description.trim(),
      duration: parseMs(duration),
      fadeInTime: parseMs(fadeInTime),
    });
    onClose();
  };

  return (
    <ModalShell
      onClose={onClose}
      label="Page metadata"
      className="w-[480px] max-h-[88vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[15px] font-semibold text-foreground">
            Page metadata
          </div>
          <div className="text-[11px] text-[#777] mt-0.5">
            <span className="font-mono text-[#aaa]">
              #{pageIndex + 1} {page.label}
            </span>
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

      <Field
        label="Title"
        hint="Display name shown on the page in the editor. Also exposed in the JSON."
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Welcome"
          maxLength={120}
          className="w-full bg-[#0a0a0c] border border-edge text-foreground px-2 py-1.5 rounded text-xs outline-none focus:border-[#4a90e2] focus:bg-[#0e0e12] placeholder:text-[#555]"
        />
      </Field>

      <Field
        label="Description"
        hint="Free-form notes. JSON-only — never shown in the editor outside this modal."
      >
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          spellCheck={false}
          rows={3}
          placeholder="e.g. Splash frame for the launcher; static for 3s before the first animation."
          className="w-full bg-[#0a0a0c] border border-edge text-foreground p-2 rounded text-xs leading-[1.4] resize-y outline-none focus:border-[#4a90e2] focus:bg-[#0e0e12] placeholder:text-[#555]"
        />
      </Field>

      <Field
        label="Auto-play"
        hint="Hints for the design's auto-playback. Leave empty to fall back to player defaults."
      >
        <div className="flex items-center gap-3">
          <SubField label="Duration">
            <input
              type="number"
              min={0}
              step={100}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="—"
              className="w-24 bg-[#0a0a0c] border border-edge text-foreground px-2 py-1 rounded text-xs outline-none focus:border-[#4a90e2] focus:bg-[#0e0e12] text-right placeholder:text-[#555]"
            />
            <UnitTag>ms</UnitTag>
          </SubField>
          <SubField label="Fade in">
            <input
              type="number"
              min={0}
              step={50}
              value={fadeInTime}
              onChange={(e) => setFadeInTime(e.target.value)}
              placeholder="—"
              className="w-24 bg-[#0a0a0c] border border-edge text-foreground px-2 py-1 rounded text-xs outline-none focus:border-[#4a90e2] focus:bg-[#0e0e12] text-right placeholder:text-[#555]"
            />
            <UnitTag>ms</UnitTag>
          </SubField>
        </div>
      </Field>

      <div className="flex justify-end gap-1.5 mt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-[#22222a] border border-[#2f2f37] text-foreground hover:bg-[#2c2c34]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-3 py-1.5 rounded text-xs bg-[#4a90e2] text-[#06121e] border border-[#4a90e2] font-semibold hover:bg-[#5fa0ee] cursor-pointer"
        >
          Save
        </button>
      </div>
    </ModalShell>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-[0.1em] text-[#777] mb-1 font-semibold">
        {label}
      </div>
      {children}
      <div className="text-[10.5px] text-[#666] mt-1 leading-[1.4]">{hint}</div>
    </div>
  );
}

function SubField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-[#aaa]">
      <span className="font-medium text-[#888]">{label}</span>
      {children}
    </label>
  );
}

function UnitTag({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] text-[#666]">{children}</span>;
}
