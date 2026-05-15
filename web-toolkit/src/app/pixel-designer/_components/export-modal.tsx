"use client";

import { useMemo, useState } from "react";
import { activeConfig } from "@/lib/pixel-designer/config";
import {
  buildExportJSON,
  buildPresetExportJSON,
  pickPage,
} from "@/lib/pixel-designer/json-io";
import { exportPngSheet, type PngSection } from "@/lib/pixel-designer/png-export";
import type { Design, Mode } from "@/lib/pixel-designer/types";
import { HARDWARE_PRESETS } from "@/lib/hardware-presets";
import { ModalShell } from "./modal-shell";

interface ExportModalProps {
  open: boolean;
  design: Design;
  activePage: number;
  activePreset: string;
  mode: Mode;
  onClose: () => void;
}

export function ExportModal(props: ExportModalProps) {
  if (!props.open) return null;
  return <ExportModalInner {...props} />;
}

function ExportModalInner({
  design,
  activePage,
  activePreset,
  mode,
  onClose,
}: Omit<ExportModalProps, "open">) {
  const presetIds = useMemo(() => Object.keys(design.hardware), [design]);
  const [presetForFlat, setPresetForFlat] = useState<string>(activePreset);

  const page = design.pages[activePage];
  const pageLabel = page?.label ?? `Page ${activePage + 1}`;
  const totalVariants = useMemo(() => {
    let n = 0;
    for (const p of design.pages) n += Object.keys(p.variants).length;
    return n;
  }, [design]);
  const pageVariantCount = page ? Object.keys(page.variants).length : 0;
  const flatPagesCount = useMemo(
    () =>
      design.pages.filter((p) => p.variants[presetForFlat] !== undefined).length,
    [design, presetForFlat],
  );

  const presetSizeLabel = (id: string) => {
    const hw = design.hardware[id];
    return hw ? `${hw.width}×${hw.height}` : id;
  };

  const presetFullLabel = (id: string) =>
    HARDWARE_PRESETS.find((p) => p.id === id)?.label ?? presetSizeLabel(id);

  // ──────── JSON actions ────────

  const handleJsonFull = () => {
    downloadJSON(buildExportJSON(design), `design-${design.pages.length}p.json`);
  };

  const handleJsonPage = () => {
    if (!page) return;
    downloadJSON(
      buildExportJSON(pickPage(design, activePage)),
      `design-page-${activePage + 1}.json`,
    );
  };

  const handleJsonPreset = () => {
    try {
      downloadJSON(
        buildPresetExportJSON(design, presetForFlat),
        `design-${presetForFlat}.json`,
      );
    } catch (err) {
      // No variant for that preset on any page — guard already filters but
      // hardware lookup can still miss in pathological cases.
      console.error(err);
    }
  };

  // ──────── PNG actions ────────

  const sectionsForPage = (pageIdx: number): PngSection[] => {
    const p = design.pages[pageIdx];
    if (!p) return [];
    return Object.entries(p.variants).map(([presetId, v]) => ({
      title: `${p.label} — ${presetSizeLabel(presetId)}`,
      config: activeConfig(design, presetId),
      pixels: v.pixels.slice(),
    }));
  };

  const sectionsForPreset = (presetId: string): PngSection[] => {
    const cfg = activeConfig(design, presetId);
    return design.pages
      .map((p, i) => ({ p, i, v: p.variants[presetId] }))
      .filter((x) => x.v !== undefined)
      .map(({ p, i, v }) => ({
        title: `#${i + 1}  ${p.label}`,
        config: cfg,
        pixels: v!.pixels.slice(),
      }));
  };

  const handlePngVariant = () => {
    if (!page || !page.variants[activePreset]) return;
    exportPngSheet(
      [
        {
          title: `${page.label} — ${presetSizeLabel(activePreset)}`,
          config: activeConfig(design, activePreset),
          pixels: page.variants[activePreset].pixels.slice(),
        },
      ],
      mode,
      `${pageLabel}-${activePreset}.png`,
    );
  };

  const handlePngPageVariants = () => {
    if (!page) return;
    exportPngSheet(
      sectionsForPage(activePage),
      mode,
      `${pageLabel}-all-variants.png`,
    );
  };

  const handlePngPresetPages = () => {
    exportPngSheet(
      sectionsForPreset(activePreset),
      mode,
      `design-${activePreset}-all-pages.png`,
    );
  };

  const handlePngEverything = () => {
    const sections: PngSection[] = [];
    for (let i = 0; i < design.pages.length; i++) {
      sections.push(...sectionsForPage(i));
    }
    exportPngSheet(
      sections,
      mode,
      `design-all-${design.pages.length}p-${totalVariants}v.png`,
    );
  };

  return (
    <ModalShell onClose={onClose} className="w-[560px] max-h-[88vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[15px] font-semibold text-foreground">Export</div>
          <div className="text-[11px] text-[#777] mt-0.5">
            {design.pages.length} page{design.pages.length === 1 ? "" : "s"} ·{" "}
            {totalVariants} variant{totalVariants === 1 ? "" : "s"} across{" "}
            {presetIds.length} hardware preset
            {presetIds.length === 1 ? "" : "s"}
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

      <Section title="JSON">
        <Row
          label="Everything"
          hint={`Full design: ${design.pages.length}p × ${presetIds.length}h = ${totalVariants} grids of pixel data.`}
          onDownload={handleJsonFull}
          onCopy={async () =>
            navigator.clipboard.writeText(
              JSON.stringify(buildExportJSON(design), null, 2),
            )
          }
        />
        <Row
          label="This page + its variants"
          hint={`${pageLabel} with all ${pageVariantCount} variant${pageVariantCount === 1 ? "" : "s"}.`}
          onDownload={handleJsonPage}
          onCopy={async () =>
            navigator.clipboard.writeText(
              JSON.stringify(
                buildExportJSON(pickPage(design, activePage)),
                null,
                2,
              ),
            )
          }
          disabled={!page}
        />
        <Row
          label={
            <span className="inline-flex items-center gap-1.5">
              Single hardware:
              <select
                value={presetForFlat}
                onChange={(e) => setPresetForFlat(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#0a0a0c] border border-edge text-foreground px-1.5 py-0.5 rounded text-[11px] outline-none cursor-pointer focus:border-[#4a90e2]"
              >
                {presetIds.map((id) => (
                  <option key={id} value={id}>
                    {presetFullLabel(id)}
                  </option>
                ))}
              </select>
            </span>
          }
          hint={`Flat per-hardware shape: ${flatPagesCount} page${flatPagesCount === 1 ? "" : "s"} have a ${presetSizeLabel(presetForFlat)} variant.`}
          onDownload={handleJsonPreset}
          onCopy={async () =>
            navigator.clipboard.writeText(
              JSON.stringify(
                buildPresetExportJSON(design, presetForFlat),
                null,
                2,
              ),
            )
          }
          disabled={flatPagesCount === 0}
        />
      </Section>

      <Section title="PNG">
        <Row
          label={`This variant (${presetSizeLabel(activePreset)})`}
          hint={`${pageLabel} rendered as a single image in ${mode} mode.`}
          onDownload={handlePngVariant}
          disabled={!page || !page.variants[activePreset]}
        />
        <Row
          label="This page, all variants"
          hint={`${pageLabel} stacked: ${pageVariantCount} grid${pageVariantCount === 1 ? "" : "s"}.`}
          onDownload={handlePngPageVariants}
          disabled={pageVariantCount === 0}
        />
        <Row
          label={`All pages, this variant (${presetSizeLabel(activePreset)})`}
          hint={`${design.pages.filter((p) => p.variants[activePreset]).length} page${design.pages.filter((p) => p.variants[activePreset]).length === 1 ? "" : "s"} that have a ${presetSizeLabel(activePreset)} variant.`}
          onDownload={handlePngPresetPages}
          disabled={
            design.pages.filter((p) => p.variants[activePreset]).length === 0
          }
        />
        <Row
          label="Everything sheet"
          hint={`Every variant of every page: ${totalVariants} grids total.`}
          onDownload={handlePngEverything}
          disabled={totalVariants === 0}
        />
      </Section>

      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-[#22222a] border border-[#2f2f37] text-foreground hover:bg-[#2c2c34]"
        >
          Close
        </button>
      </div>
    </ModalShell>
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
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-[0.1em] text-[#777] mb-1.5 font-semibold">
        {title}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  hint,
  onDownload,
  onCopy,
  disabled,
}: {
  label: React.ReactNode;
  hint: string;
  onDownload: () => void;
  onCopy?: () => Promise<void> | void;
  disabled?: boolean;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const handleCopy = async () => {
    if (!onCopy) return;
    try {
      await onCopy();
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      // silently ignore — clipboard may be unavailable
    }
  };
  return (
    <div
      className={`flex items-center gap-3 px-2.5 py-2 rounded border border-[#1f1f25] bg-[#0a0a0c]/30 ${disabled ? "opacity-50" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-xs text-foreground">{label}</div>
        <div className="text-[10.5px] text-[#777] mt-0.5 leading-[1.4]">
          {hint}
        </div>
      </div>
      {onCopy && (
        <button
          type="button"
          onClick={handleCopy}
          disabled={disabled}
          className="px-2 py-1 rounded text-[11px] cursor-pointer bg-[#22222a] border border-[#2f2f37] text-foreground hover:bg-[#2c2c34] disabled:cursor-not-allowed disabled:hover:bg-[#22222a] shrink-0"
        >
          {copyState === "copied" ? "Copied" : "Copy"}
        </button>
      )}
      <button
        type="button"
        onClick={onDownload}
        disabled={disabled}
        className="px-2.5 py-1 rounded text-[11px] cursor-pointer bg-[#4a90e2] text-[#06121e] border border-[#4a90e2] font-semibold hover:bg-[#5fa0ee] disabled:cursor-not-allowed disabled:hover:bg-[#4a90e2] shrink-0"
      >
        Download
      </button>
    </div>
  );
}

function downloadJSON(obj: unknown, filename: string) {
  const json = JSON.stringify(obj, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
