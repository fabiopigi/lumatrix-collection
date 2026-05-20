"use client";

import { useEffect, useMemo, useState } from "react";
import { HARDWARE_PRESETS } from "@/lib/hardware-presets";
import type { Design } from "@/lib/pixel-designer/types";
import { fits } from "@/lib/pixel-designer/variants";
import { ModalShell } from "./modal-shell";

export type AddVariantInit = "scale" | "center" | "blank";

export interface AddVariantResult {
  created: number;
  skippedAlreadyHad: number;
  skippedNoSource: number;
  skippedTooBig: number;
  skippedDetails: Array<{
    pageIdx: number;
    pageLabel: string;
    reason: string;
  }>;
}

interface AddVariantModalProps {
  open: boolean;
  design: Design;
  pageIdx: number;
  sourcePreset: string;
  /** When set, the modal switches to a results view: the action just ran
   *  with at least one page skipped, and we're showing the summary until
   *  the user clicks Done. */
  result: AddVariantResult | null;
  onClose: () => void;
  onAdd: (
    targetPresetId: string,
    init: AddVariantInit,
    applyToAllPages: boolean,
  ) => void;
}

export function AddVariantModal(props: AddVariantModalProps) {
  if (!props.open) return null;
  return <AddVariantModalInner {...props} />;
}

function AddVariantModalInner({
  design,
  pageIdx,
  sourcePreset,
  result,
  onClose,
  onAdd,
}: Omit<AddVariantModalProps, "open">) {
  const page = design.pages[pageIdx];
  const sourceHw = design.hardware[sourcePreset];

  // Eligible targets: every standard preset that doesn't already have a
  // variant on this page, plus any custom preset already present in
  // design.hardware that this page hasn't covered yet.
  const eligible = useMemo(() => {
    if (!page) return [];
    const taken = new Set(Object.keys(page.variants));
    const seen = new Set<string>();
    const out: Array<{ id: string; label: string; width: number; height: number }> = [];
    for (const p of HARDWARE_PRESETS) {
      if (taken.has(p.id)) continue;
      seen.add(p.id);
      out.push({ id: p.id, label: p.label, width: p.width, height: p.height });
    }
    for (const [id, hw] of Object.entries(design.hardware)) {
      if (taken.has(id) || seen.has(id)) continue;
      out.push({
        id,
        label: `${hw.width}×${hw.height} (custom)`,
        width: hw.width,
        height: hw.height,
      });
    }
    return out;
  }, [design, page]);

  const [targetId, setTargetId] = useState<string>(eligible[0]?.id ?? "");
  const [init, setInit] = useState<AddVariantInit>("scale");
  const [applyToAll, setApplyToAll] = useState(false);

  const target = eligible.find((p) => p.id === targetId);
  const sourceFits =
    sourceHw && target
      ? fits(
          { width: sourceHw.width, height: sourceHw.height, pixels: [] },
          { width: target.width, height: target.height },
        )
      : false;

  const sourceLabel = sourceHw
    ? `${sourceHw.width}×${sourceHw.height}`
    : sourcePreset;
  const shrinkNote =
    sourceHw && target && !sourceFits
      ? `Source ${sourceLabel} doesn't fit in ${target.width}×${target.height}. Scale/Center aren't available — Start blank is the only option for this target.`
      : null;

  // When the source doesn't fit, scale/center can't carry the source pixels
  // across. We don't refuse outright any more — "blank" stays available and
  // we auto-select it so the user can just click Add.
  useEffect(() => {
    if (!sourceFits && init !== "blank") {
      setInit("blank");
    }
  }, [sourceFits, init]);

  const handleAdd = () => {
    if (!target) return;
    if (init !== "blank" && !sourceFits) return;
    onAdd(target.id, init, applyToAll);
  };

  // When the parent populated `result`, we've just finished a bulk apply with
  // skipped pages. Show the summary instead of the form until the user
  // dismisses it.
  if (result) {
    return (
      <ModalShell onClose={onClose} label="Add variant — result" className="w-[480px]">
        <ResultView result={result} onDone={onClose} />
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose} label="Add variant" className="w-[440px]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[15px] font-semibold text-foreground">
            Add variant
          </div>
          <div className="text-[11px] text-[#777] mt-0.5">
            For{" "}
            <span className="font-mono text-[#aaa]">
              {page?.label ?? `Page ${pageIdx + 1}`}
            </span>
            {" — source: "}
            <span className="font-mono text-[#aaa]">{sourceLabel}</span>
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

      {eligible.length === 0 ? (
        <p className="text-[12px] text-[#888] py-4">
          This page already has every available hardware variant. Add a new
          hardware preset to design for from the variant settings (⚙).
        </p>
      ) : (
        <>
          <Section title="Target hardware">
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full bg-[#0a0a0c] border border-edge text-foreground px-2 py-1.5 rounded text-xs outline-none focus:border-[#4a90e2] focus:bg-[#0e0e12] cursor-pointer"
            >
              {eligible.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Section>

          <Section title="Initialise">
            <InitOption
              checked={init === "scale"}
              disabled={!sourceFits}
              onChange={() => setInit("scale")}
              title="Scale to size"
              hint="Nearest-neighbour integer upscale of the source, centred on the new canvas. Empty cells stay empty."
            />
            <InitOption
              checked={init === "center"}
              disabled={!sourceFits}
              onChange={() => setInit("center")}
              title="Center unscaled"
              hint="Paste the source pixels 1:1 in the centre of the new canvas; the surround starts blank."
            />
            <InitOption
              checked={init === "blank"}
              onChange={() => setInit("blank")}
              title="Start blank"
              hint="Create the variant as an empty canvas — ignore the source. Useful when scaling down or when you want to redesign for the new size from scratch."
            />
          </Section>

          {shrinkNote && (
            <div className="mb-3 text-[11px] text-[#d8a000] bg-[#2a2010] border border-[#3a3020] rounded p-2 leading-[1.4]">
              {shrinkNote}
            </div>
          )}

          {design.pages.length > 1 && (
            <label className="flex items-start gap-2 cursor-pointer py-1 mb-3">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                className="mt-0.5 cursor-pointer accent-[#4a90e2]"
              />
              <span className="text-xs leading-[1.4]">
                <span className="text-foreground">
                  Apply to all {design.pages.length} pages
                </span>
                <span className="block text-[10.5px] text-[#777]">
                  Each page sources from its own{" "}
                  <span className="font-mono">{sourceLabel}</span> variant.
                  Pages without one — or whose source doesn&apos;t fit — are
                  skipped and reported afterwards.
                </span>
              </span>
            </label>
          )}

          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs cursor-pointer bg-[#22222a] border border-[#2f2f37] text-foreground hover:bg-[#2c2c34]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="px-3 py-1.5 rounded text-xs bg-[#4a90e2] text-[#06121e] border border-[#4a90e2] font-semibold hover:bg-[#5fa0ee] cursor-pointer"
            >
              Add variant
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

function InitOption({
  checked,
  disabled,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  title: string;
  hint: string;
}) {
  return (
    <label
      className={`flex items-start gap-2 py-1 ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <input
        type="radio"
        name="init"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className={`mt-0.5 accent-[#4a90e2] ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      />
      <span className="text-xs leading-[1.4]">
        <span className="text-foreground">{title}</span>
        <span className="block text-[10.5px] text-[#777]">{hint}</span>
      </span>
    </label>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-[0.1em] text-[#777] mb-1.5 font-semibold">
        {title}
      </div>
      {children}
    </div>
  );
}

function ResultView({
  result,
  onDone,
}: {
  result: AddVariantResult;
  onDone: () => void;
}) {
  const totalSkipped =
    result.skippedAlreadyHad +
    result.skippedNoSource +
    result.skippedTooBig;
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[15px] font-semibold text-foreground">
            Bulk add complete
          </div>
          <div className="text-[11px] text-[#777] mt-0.5">
            Created on {result.created} page
            {result.created === 1 ? "" : "s"} · skipped {totalSkipped}
          </div>
        </div>
      </div>

      {result.skippedDetails.length > 0 && (
        <div className="mb-3 bg-[#0a0a0c] border border-[#2a2a30] rounded max-h-[260px] overflow-y-auto">
          {result.skippedDetails.map((d) => (
            <div
              key={d.pageIdx}
              className="flex items-start gap-2 px-2.5 py-1.5 border-b border-[#1a1a1f] last:border-b-0 text-[11px]"
            >
              <span className="font-mono text-[#aaa] min-w-[90px]">
                {d.pageLabel}
              </span>
              <span className="text-[#888] leading-[1.4]">{d.reason}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 rounded text-xs bg-[#4a90e2] text-[#06121e] border border-[#4a90e2] font-semibold hover:bg-[#5fa0ee] cursor-pointer"
        >
          Done
        </button>
      </div>
    </>
  );
}
