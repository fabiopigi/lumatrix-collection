"use client";

import { useEffect, useMemo, useState } from "react";
import { activeConfig } from "@/lib/pixel-designer/config";
import {
  buildExportJSON,
  buildPresetExportJSON,
  pickPage,
} from "@/lib/pixel-designer/json-io";
import {
  exportPngGrid,
  type PngGridSection,
} from "@/lib/pixel-designer/png-export";
import {
  buildShareUrl,
  SHARE_WARN_BYTES,
} from "@/lib/pixel-designer/share-link";
import type { Design, Mode } from "@/lib/pixel-designer/types";
import { HARDWARE_PRESETS, presetIdsInOrder } from "@/lib/hardware-presets";
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
  const presetIds = useMemo(
    () => presetIdsInOrder(Object.keys(design.hardware)),
    [design],
  );
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
  // Convention: variants run left/right (columns), pages run top/bottom (rows).

  const sectionFor = (pageIdx: number, presetId: string): PngGridSection | null => {
    const p = design.pages[pageIdx];
    const v = p?.variants[presetId];
    if (!p || !v) return null;
    return {
      config: activeConfig(design, presetId),
      pixels: v.pixels.slice(),
    };
  };

  const handlePngVariant = () => {
    if (!page || !page.variants[activePreset]) return;
    exportPngGrid({
      sections: [[sectionFor(activePage, activePreset)]],
      rowLabels: [`#${activePage + 1}  ${page.label}`],
      columnLabels: [presetFullLabel(activePreset)],
      mode,
      filename: `${pageLabel}-${activePreset}.png`,
    });
  };

  const handlePngPageVariants = () => {
    if (!page) return;
    const cols = presetIdsInOrder(Object.keys(page.variants));
    if (cols.length === 0) return;
    exportPngGrid({
      sections: [cols.map((id) => sectionFor(activePage, id))],
      rowLabels: [`#${activePage + 1}  ${page.label}`],
      columnLabels: cols.map(presetFullLabel),
      mode,
      filename: `${pageLabel}-all-variants.png`,
    });
  };

  const handlePngPresetPages = () => {
    const rowsWithVariant = design.pages
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.variants[activePreset] !== undefined);
    if (rowsWithVariant.length === 0) return;
    exportPngGrid({
      sections: rowsWithVariant.map(({ i }) => [sectionFor(i, activePreset)]),
      rowLabels: rowsWithVariant.map(({ p, i }) => `#${i + 1}  ${p.label}`),
      columnLabels: [presetFullLabel(activePreset)],
      mode,
      filename: `design-${activePreset}-all-pages.png`,
    });
  };

  const handlePngEverything = () => {
    // Use every preset that any page has, ordered by HARDWARE_PRESETS first
    // (so the canonical sizes line up predictably), then any custom ones.
    const presetsUsed = new Set<string>();
    for (const p of design.pages) {
      for (const id of Object.keys(p.variants)) presetsUsed.add(id);
    }
    const ordered: string[] = [];
    for (const p of HARDWARE_PRESETS) {
      if (presetsUsed.has(p.id)) ordered.push(p.id);
    }
    for (const id of presetsUsed) {
      if (!ordered.includes(id)) ordered.push(id);
    }
    if (ordered.length === 0) return;

    exportPngGrid({
      sections: design.pages.map((_, pageIdx) =>
        ordered.map((presetId) => sectionFor(pageIdx, presetId)),
      ),
      rowLabels: design.pages.map((p, i) => `#${i + 1}  ${p.label}`),
      columnLabels: ordered.map(presetFullLabel),
      mode,
      filename: `design-all-${design.pages.length}p-${ordered.length}v.png`,
    });
  };

  return (
    <ModalShell onClose={onClose} label="Export design" className="w-[560px] max-h-[88vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[15px] font-semibold text-foreground">Export</div>
          <div className="text-[11px] text-fg-faint mt-0.5">
            {design.pages.length} page{design.pages.length === 1 ? "" : "s"} ·{" "}
            {totalVariants} variant{totalVariants === 1 ? "" : "s"} across{" "}
            {presetIds.length} hardware preset
            {presetIds.length === 1 ? "" : "s"}
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

      <Section title="Share link">
        <ShareLinkRow design={design} />
        <div className="text-[10.5px] text-fg-faint mt-1 px-1 leading-[1.4]">
          Anyone with this link opens your design directly in their browser.
          The data lives in the URL — no upload, no account.
        </div>
      </Section>

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
                className="bg-sunken border border-edge text-foreground px-1.5 py-0.5 rounded text-[11px] outline-none cursor-pointer focus:border-cta"
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
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover"
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
      <div className="text-[10px] uppercase tracking-[0.1em] text-fg-faint mb-1.5 font-semibold">
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
      className={`flex items-center gap-3 px-2.5 py-2 rounded border border-line-mute bg-sunken/30 ${disabled ? "opacity-50" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-xs text-foreground">{label}</div>
        <div className="text-[10.5px] text-fg-faint mt-0.5 leading-[1.4]">
          {hint}
        </div>
      </div>
      {onCopy && (
        <button
          type="button"
          onClick={handleCopy}
          disabled={disabled}
          className="px-2 py-1 rounded text-[11px] cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover disabled:cursor-not-allowed disabled:hover:bg-raised shrink-0"
        >
          {copyState === "copied" ? "Copied" : "Copy"}
        </button>
      )}
      <button
        type="button"
        onClick={onDownload}
        disabled={disabled}
        className="px-2.5 py-1 rounded text-[11px] cursor-pointer bg-cta text-cta-fg border border-cta font-semibold hover:bg-cta-hover disabled:cursor-not-allowed disabled:hover:bg-cta shrink-0"
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

function ShareLinkRow({ design }: { design: Design }) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; url: string; bytes: number; oversize: boolean }
    | { kind: "error"; message: string }
  >({ kind: "loading" });
  const [copied, setCopied] = useState(false);

  // Recompute the share link whenever the design changes. Encoding + compress
  // is ~milliseconds for 8×8 designs and ~tens of ms for large multi-page
  // animations, so eager generation keeps the modal responsive without
  // surfacing a separate "Generate" button. The synchronous resets to
  // "loading" + clear-copied are intentional cascading renders — we want
  // the stale URL to disappear immediately on design change, not after the
  // async build resolves.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: "loading" });
    setCopied(false);
    (async () => {
      try {
        const r = await buildShareUrl(
          design,
          window.location.origin,
          window.location.pathname,
        );
        if (!cancelled) {
          setState({
            kind: "ready",
            url: r.url,
            bytes: r.bytes,
            oversize: r.oversize,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            kind: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [design]);

  const handleCopy = async () => {
    if (state.kind !== "ready") return;
    try {
      await navigator.clipboard.writeText(state.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard write failed (insecure context, denied permission, etc.).
      // The input is selectable so the user can still copy manually.
    }
  };

  return (
    <div className="flex flex-col gap-1.5 px-2.5 py-2 rounded border border-line-mute bg-sunken/30">
      {state.kind === "loading" && (
        <div className="text-[11px] text-fg-faint">Generating link…</div>
      )}
      {state.kind === "error" && (
        <div className="text-[11px] text-danger">
          Couldn&apos;t build share link: {state.message}
        </div>
      )}
      {state.kind === "ready" && (
        <>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              aria-label="Shareable design URL"
              value={state.url}
              onFocus={(e) => e.currentTarget.select()}
              onClick={(e) => e.currentTarget.select()}
              className="flex-1 bg-sunken border border-edge text-foreground px-2 py-1 rounded font-mono text-[11px] outline-none focus:border-cta select-text min-w-0"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1 rounded text-[11px] cursor-pointer bg-cta text-cta-fg border border-cta font-semibold hover:bg-cta-hover shrink-0"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="text-[10.5px] text-fg-faint">
            {formatBytes(state.bytes)}
            {state.oversize && (
              <span className="text-warning ml-1.5">
                — over {Math.round(SHARE_WARN_BYTES / 1000)} KB; some chat apps
                truncate long URLs, consider exporting JSON instead.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}
