"use client";

import { useMemo, useState } from "react";
import { DEFAULT_CONFIG, LUMATRIX_MASK } from "@/lib/pixel-designer/config";
import { computeLedIndex } from "@/lib/pixel-designer/led-index";
import { COLOR_MODE_LABELS } from "@/lib/pixel-designer/palette";
import type { Axis, ColorMode, Config, Origin } from "@/lib/pixel-designer/types";
import { HARDWARE_PRESETS } from "@/lib/hardware-presets";
import { ModalShell } from "./modal-shell";

interface ConfigModalProps {
  open: boolean;
  current: Config;
  onClose: () => void;
  onSave: (next: Config) => void;
}

export function ConfigModal(props: ConfigModalProps) {
  if (!props.open) return null;
  return <ConfigModalInner {...props} />;
}

function ConfigModalInner({ current, onClose, onSave }: ConfigModalProps) {
  const [width, setWidth] = useState(current.width);
  const [height, setHeight] = useState(current.height);
  const [colorMode, setColorMode] = useState<ColorMode>(current.colorMode);
  const [origin, setOrigin] = useState<Origin>(current.origin);
  const [axis, setAxis] = useState<Axis>(current.axis);
  const [serpentine, setSerpentine] = useState(current.serpentine);
  const [mask, setMask] = useState(current.letterMask);

  const previewCfg: Config = useMemo(
    () => ({
      width: clamp(width, 1, 64),
      height: clamp(height, 1, 64),
      colorMode,
      origin,
      axis,
      serpentine,
      letterMask: mask,
    }),
    [width, height, colorMode, origin, axis, serpentine, mask],
  );

  const cellPx = Math.max(
    14,
    Math.min(28, Math.floor(360 / Math.max(previewCfg.width, previewCfg.height))),
  );

  const cells: React.ReactNode[] = [];
  for (let y = 0; y < previewCfg.height; y++) {
    for (let x = 0; x < previewCfg.width; x++) {
      const idx = computeLedIndex(x, y, previewCfg);
      const zero = idx === 0;
      cells.push(
        <div
          key={`${x},${y}`}
          className={`flex items-center justify-center font-mono text-[8px] rounded-sm aspect-square min-w-[20px] ${
            zero ? "bg-[#2a3a4a] text-accent font-bold" : "bg-panel-2 text-muted"
          }`}
        >
          {idx}
        </div>,
      );
    }
  }

  const maskLines = mask.split("\n");
  const lineCount = maskLines.length;
  const longest = maskLines.reduce((m, l) => Math.max(m, l.length), 0);
  const usable = maskLines
    .slice(0, previewCfg.height)
    .reduce((sum, l) => sum + Math.min(l.length, previewCfg.width), 0);
  const maskWarn = lineCount > previewCfg.height || longest > previewCfg.width;
  const maskMsg = `Expected ${previewCfg.height} row${previewCfg.height === 1 ? "" : "s"} × ${previewCfg.width} cols. Got ${lineCount} row${lineCount === 1 ? "" : "s"}, longest ${longest} cols. ${usable}/${previewCfg.width * previewCfg.height} cells filled.${maskWarn ? " (extras will be ignored)" : ""}`;

  const resetToDefaults = () => {
    setWidth(DEFAULT_CONFIG.width);
    setHeight(DEFAULT_CONFIG.height);
    setColorMode(DEFAULT_CONFIG.colorMode);
    setOrigin(DEFAULT_CONFIG.origin);
    setAxis(DEFAULT_CONFIG.axis);
    setSerpentine(DEFAULT_CONFIG.serpentine);
    setMask(DEFAULT_CONFIG.letterMask);
  };

  const save = () => onSave(previewCfg);

  return (
    <ModalShell onClose={onClose} label="Variant settings" width={560} className="max-h-[88vh] overflow-y-auto">
      <h2 className="m-0 mb-3 text-[13px] font-semibold">
        Variant settings —{" "}
        <span className="text-accent font-mono">
          {HARDWARE_PRESETS.find(
            (p) => p.width === current.width && p.height === current.height,
          )?.label ?? `${current.width}×${current.height}`}
        </span>
      </h2>
      <p className="text-[10.5px] text-fg-faint -mt-2 mb-3 leading-[1.4]">
        These fields describe the active variant&apos;s hardware (size, wiring,
        letter mask) plus the design&apos;s global colour mode. Other variants
        keep their own wiring.
      </p>

      <CfgSection title="Dimensions">
        <div className="flex gap-1.5 items-center">
          <NumLabel label="Width">
            <NumInput value={width} onChange={setWidth} />
          </NumLabel>
          <NumLabel label="Height">
            <NumInput value={height} onChange={setHeight} />
          </NumLabel>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {HARDWARE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.label}
              onClick={() => {
                setWidth(p.width);
                setHeight(p.height);
              }}
              className="px-2.5 py-1 rounded text-[11px] cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover"
            >
              {p.width}×{p.height}
            </button>
          ))}
        </div>
      </CfgSection>

      <CfgSection title="Color mode">
        <Select
          value={colorMode}
          onChange={(v) => setColorMode(v as ColorMode)}
          options={Object.entries(COLOR_MODE_LABELS).map(([k, v]) => ({
            value: k,
            label: v,
          }))}
        />
      </CfgSection>

      <CfgSection title="LED indexing">
        <div className="flex flex-col gap-2.5">
          <LabelStack label="Origin (LED 0 corner)">
            <Select
              value={origin}
              onChange={(v) => setOrigin(v as Origin)}
              options={[
                { value: "top-left", label: "Top-left" },
                { value: "top-right", label: "Top-right" },
                { value: "bottom-left", label: "Bottom-left" },
                { value: "bottom-right", label: "Bottom-right" },
              ]}
            />
          </LabelStack>
          <LabelStack label="Primary axis">
            <Select
              value={axis}
              onChange={(v) => setAxis(v as Axis)}
              options={[
                { value: "row", label: "Rows (horizontal strips)" },
                { value: "col", label: "Columns (vertical strips)" },
              ]}
            />
          </LabelStack>
          <label className="flex flex-row items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={serpentine}
              onChange={(e) => setSerpentine(e.target.checked)}
            />
            Serpentine (alternate strip direction)
          </label>
        </div>
        <div className="mt-3.5">
          <div className="text-[11px] text-muted mb-1.5 flex justify-between">
            <span>Index preview</span>
            <span className="text-accent font-mono">
              {previewCfg.width}×{previewCfg.height} ={" "}
              {previewCfg.width * previewCfg.height} LED
              {previewCfg.width * previewCfg.height === 1 ? "" : "s"}
            </span>
          </div>
          <div
            className="bg-sunken border border-edge rounded p-2 grid gap-0.5 justify-start overflow-x-auto"
            style={{
              gridTemplateColumns: `repeat(${previewCfg.width}, ${cellPx}px)`,
            }}
          >
            {cells}
          </div>
        </div>
      </CfgSection>

      <CfgSection title="Letter mask" hint="one character per cell, newline per row. Empty / . / space = blank dot.">
        <textarea
          value={mask}
          onChange={(e) => setMask(e.target.value)}
          spellCheck={false}
          placeholder={
            "Type letters, one per LED.\nLines shorter than the matrix width are padded with blanks.\nLines beyond the matrix height are ignored."
          }
          className="w-full min-h-[140px] bg-sunken border border-edge text-foreground p-2 rounded font-mono text-[13px] leading-[1.4] tracking-[0.12em] uppercase resize-y whitespace-pre overflow-x-auto outline-none focus:border-cta focus:bg-input-focus select-text"
        />
        <div
          className={`mt-1.5 text-[11px] font-mono ${maskWarn ? "text-[#d8a000]" : "text-accent"}`}
        >
          {maskMsg}
        </div>
        <div className="flex gap-1.5 mt-2">
          <button
            type="button"
            onClick={() => setMask("")}
            className="px-2.5 py-1 rounded text-[11px] cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => setMask(LUMATRIX_MASK)}
            className="px-2.5 py-1 rounded text-[11px] cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover"
          >
            Use LUMATRIX preset
          </button>
        </div>
      </CfgSection>

      <div className="flex gap-1.5 mt-4 items-center">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={resetToDefaults}
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-[#2a1818] border border-danger-soft text-danger hover:bg-danger-soft"
        >
          Reset to LUMATRIX defaults
        </button>
        <button
          type="button"
          onClick={save}
          className="ml-auto px-3 py-1.5 rounded text-xs cursor-pointer bg-cta text-cta-fg border border-cta font-semibold hover:bg-cta-hover"
        >
          Save
        </button>
      </div>
    </ModalShell>
  );
}

function CfgSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 pb-3.5 border-b border-edge last-of-type:border-b-0">
      <div className="text-[11px] uppercase tracking-[0.08em] text-muted mb-2 font-semibold">
        {title}
        {hint && (
          <span className="ml-1 font-normal text-fg-faint normal-case tracking-normal text-[11px]">
            — {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function NumLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5 flex-1 text-xs">
      {label}
      {children}
    </label>
  );
}

function NumInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      min={1}
      max={64}
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 1)}
      className="w-[70px] flex-none bg-sunken border border-edge text-foreground px-2 py-1.5 rounded text-xs outline-none focus:border-cta focus:bg-input-focus"
    />
  );
}

function LabelStack({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      {label}
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-sunken border border-edge text-foreground px-2 py-1.5 rounded text-xs outline-none focus:border-cta focus:bg-input-focus"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
