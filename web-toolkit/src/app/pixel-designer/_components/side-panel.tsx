"use client";

import { useState } from "react";
import { SYMBOLS } from "@/lib/pixel-designer/symbols";
import type {
  Annotation,
  FontKey,
  Mode,
  Selection,
} from "@/lib/pixel-designer/types";
import { FontPreviewModal } from "./font-preview-modal";

const FONT_OPTIONS: Array<{ value: FontKey; label: string }> = [
  { value: "3x5", label: "3×5  ·  fixed-width" },
  { value: "5x8", label: "5×8  ·  fixed-width" },
  { value: "7x9", label: "7×9  ·  proportional (Jersey 10)" },
];

interface SidePanelProps {
  mode: Mode;
  maskAvailable: boolean;
  onMode: (m: Mode) => void;

  color: string;
  palette: string[];
  onColor: (c: string) => void;

  font: FontKey;
  text: string;
  onFont: (f: FontKey) => void;
  onText: (t: string) => void;

  symbol: string | null;
  onSymbol: (s: string) => void;

  annotations: Annotation[];
  selection: Selection | null;
  showAnnotations: boolean;
  onShowAnnotations: (v: boolean) => void;
  onAddAnnotation: (text: string) => void;
  onUpdateAnnotation: (id: string, text: string) => void;
  onDeleteAnnotation: (id: string) => void;
}

export function SidePanel(props: SidePanelProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleHexBlur = (v: string) => {
    let next = v.trim();
    if (!next.startsWith("#")) next = "#" + next;
    if (/^#[0-9a-fA-F]{6}$/.test(next)) {
      props.onColor(next);
    } else {
      // restore via re-render — caller's color stays as is
    }
  };

  return (
    <aside className="w-[340px] bg-[#131316] border-l border-edge p-3.5 overflow-y-auto shrink-0">
      <Section title="Mode">
        <div className="toggle-row flex bg-[#0a0a0c] p-0.5 rounded-md border border-edge">
          <ToggleButton
            on={props.mode === "pixel"}
            onClick={() => props.onMode("pixel")}
          >
            Pixel
          </ToggleButton>
          <ToggleButton
            on={props.mode === "mask"}
            onClick={() => props.maskAvailable && props.onMode("mask")}
            disabled={!props.maskAvailable}
            title={
              props.maskAvailable
                ? undefined
                : "Mask mode requires a letter mask. Open ⚙ Config to define one."
            }
          >
            Letter mask
          </ToggleButton>
        </div>
        <Tip>
          Mask mode renders each LED as its assigned letter glyph (defined in ⚙
          Config → Letter mask). Blank cells show as a centered dot. Drawing
          still works per pixel.
        </Tip>
      </Section>

      <Section title="Color">
        <div className="flex items-center gap-2 mb-2">
          <label
            className="relative w-7 h-7 rounded-md border border-white/10 cursor-pointer block overflow-hidden"
            style={{ background: props.color }}
            title="Click to pick custom"
          >
            <input
              type="color"
              value={normalizeHex(props.color)}
              onChange={(e) => props.onColor(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer border-0 p-0 m-0 bg-transparent"
            />
          </label>
          <input
            type="text"
            defaultValue={props.color.toUpperCase()}
            key={props.color}
            onBlur={(e) => handleHexBlur(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            maxLength={7}
            className="flex-1 bg-[#0a0a0c] border border-edge text-foreground px-2 py-1.5 rounded font-mono text-xs uppercase outline-none focus:border-[#4a90e2] focus:bg-[#0e0e12] select-text"
          />
        </div>
        <div className="grid grid-cols-8 gap-1">
          {props.palette.map((c) => {
            const selected = c.toLowerCase() === props.color.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                onClick={() => props.onColor(c)}
                title={c.toUpperCase()}
                style={{ background: c }}
                className={`aspect-square rounded-md border cursor-pointer transition-transform hover:scale-110 ${
                  selected
                    ? "border-accent shadow-[0_0_0_2px_#6cf,0_0_8px_rgba(108,204,255,0.4)]"
                    : "border-white/[0.06]"
                }`}
              />
            );
          })}
        </div>
      </Section>

      <Section title="Text" hint="type then click on grid">
        <div className="flex items-center gap-1.5 mb-1.5">
          <select
            value={props.font}
            onChange={(e) => props.onFont(e.target.value as FontKey)}
            className="flex-1 bg-[#0a0a0c] border border-edge text-foreground px-2 py-1.5 rounded text-xs outline-none focus:border-[#4a90e2] focus:bg-[#0e0e12] cursor-pointer"
          >
            {FONT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            title="Preview all glyphs"
            className="px-2 py-1.5 rounded text-xs bg-[#22222a] border border-[#2f2f37] text-foreground hover:bg-[#2c2c34] cursor-pointer shrink-0"
          >
            Preview
          </button>
        </div>
        <input
          type="text"
          value={props.text}
          onChange={(e) => props.onText(e.target.value)}
          placeholder="Type to preview…"
          maxLength={32}
          className="w-full bg-[#0a0a0c] border border-edge text-foreground px-2 py-1.5 rounded text-xs outline-none focus:border-[#4a90e2] focus:bg-[#0e0e12] select-text"
        />
        <Tip>
          Picks Text tool automatically. Hover the grid for placement; click to
          stamp.
        </Tip>
      </Section>

      {previewOpen && (
        <FontPreviewModal
          font={props.font}
          color={props.color}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      <Section title="Symbols" hint="click then click grid">
        <div className="flex flex-wrap gap-[5px]">
          {Object.entries(SYMBOLS).map(([key, rows]) => (
            <button
              key={key}
              type="button"
              title={key}
              onClick={() => props.onSymbol(key)}
              className={`w-10 h-10 shrink-0 rounded border bg-[#1a1a1f] cursor-pointer p-[5px] flex items-center justify-center ${
                props.symbol === key
                  ? "border-accent bg-[#1d2937]"
                  : "border-[#25252b] hover:bg-[#22222a] hover:border-[#333]"
              }`}
            >
              <SymbolSvg rows={rows} />
            </button>
          ))}
        </div>
      </Section>

      <AnnotationsSection
        annotations={props.annotations}
        selection={props.selection}
        show={props.showAnnotations}
        onShow={props.onShowAnnotations}
        onAdd={props.onAddAnnotation}
        onUpdate={props.onUpdateAnnotation}
        onDelete={props.onDeleteAnnotation}
      />

      <Section title="Shortcuts">
        <Tip>
          <Kbd>P</Kbd> pencil &nbsp; <Kbd>E</Kbd> eraser &nbsp; <Kbd>F</Kbd>{" "}
          fill &nbsp; <Kbd>I</Kbd> eyedrop
          <br />
          <Kbd>L</Kbd> line &nbsp; <Kbd>R</Kbd>/<Kbd>⇧R</Kbd> rect &nbsp;{" "}
          <Kbd>O</Kbd>/<Kbd>⇧O</Kbd> ellipse
          <br />
          <Kbd>S</Kbd> select &nbsp; <Kbd>T</Kbd> text
          <br />
          <Kbd>⌘Z</Kbd>/<Kbd>⌘⇧Z</Kbd> undo/redo &nbsp; <Kbd>⌫</Kbd> delete sel
          <br />
          Hold <Kbd>Alt</Kbd> with select to copy instead of cut.
          <br />
          Arrow keys nudge selection.
        </Tip>
      </Section>
    </aside>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-[18px]">
      <div className="text-[10px] uppercase tracking-[0.1em] text-[#777] mb-2 font-semibold flex items-center gap-2">
        {title}
        {hint && (
          <span className="font-normal text-[#555] normal-case tracking-normal text-[10px]">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ToggleButton({
  children,
  on,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex-1 px-2 py-1.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
        on ? "bg-[#2a3a4a] text-accent" : "bg-transparent text-[#888]"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] text-[#666] leading-[1.5] mt-1">
      {children}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block font-mono text-[10px] bg-[#2a2a30] border border-[#3a3a42] rounded-[3px] px-[4px] py-px text-[#aaa] min-w-[14px] text-center">
      {children}
    </span>
  );
}

function SymbolSvg({ rows }: { rows: string[] }) {
  const w = rows[0].length;
  const h = rows.length;
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rows[y][x] === "X") {
        rects.push(
          <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill="#cce6ff" />,
        );
      }
    }
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block w-full h-full">
      {rects}
    </svg>
  );
}

function normalizeHex(c: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#ff0000";
}

function AnnotationsSection({
  annotations,
  selection,
  show,
  onShow,
  onAdd,
  onUpdate,
  onDelete,
}: {
  annotations: Annotation[];
  selection: Selection | null;
  show: boolean;
  onShow: (v: boolean) => void;
  onAdd: (text: string) => void;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const hasSelection = !!selection;
  const canAdd = hasSelection && draft.trim() !== "";
  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(draft);
    setDraft("");
  };
  return (
    <Section title="Annotations" hint="label regions of the design">
      <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => onShow(e.target.checked)}
          className="cursor-pointer accent-[#f5a623]"
        />
        <span className="text-[11px] text-[#aaa]">Show on grid</span>
      </label>

      <div className="rounded border border-edge bg-[#0a0a0c] p-2 mb-2">
        {hasSelection ? (
          <div className="text-[10.5px] text-[#aaa] font-mono mb-1.5">
            Selection {selection!.x},{selection!.y} ·{" "}
            {selection!.w}×{selection!.h}
          </div>
        ) : (
          <div className="text-[10.5px] text-[#666] mb-1.5">
            Make a selection (
            <Kbd>S</Kbd> tool) to label its region.
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder={
              hasSelection ? "e.g. player icon" : "Selection needed…"
            }
            disabled={!hasSelection}
            className="flex-1 bg-[#0a0a0c] border border-edge text-foreground px-2 py-1.5 rounded text-xs outline-none focus:border-[#f5a623] focus:bg-[#0e0e12] disabled:opacity-50 select-text"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="px-3 py-1.5 rounded text-xs cursor-pointer bg-[#f5a623] text-[#1a1308] border border-[#f5a623] font-semibold hover:bg-[#ffb83c] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#f5a623]"
          >
            Add
          </button>
        </div>
      </div>

      {annotations.length === 0 ? (
        <div className="text-[10.5px] text-[#555] italic">
          No annotations on this variant.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {annotations.map((a) => (
            <AnnotationRow
              key={a.id}
              annotation={a}
              onUpdate={(t) => onUpdate(a.id, t)}
              onDelete={() => onDelete(a.id)}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

function AnnotationRow({
  annotation,
  onUpdate,
  onDelete,
}: {
  annotation: Annotation;
  onUpdate: (text: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(annotation.text);
  // Re-sync local draft if the annotation text changes externally (e.g. undo).
  // Using a key on the input keeps this branch-free.
  return (
    <div className="flex items-center gap-1.5 rounded border border-[#1f1f25] bg-[#0a0a0c]/40 px-2 py-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-[#f5a623] shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <input
          key={annotation.id + "-" + annotation.text}
          type="text"
          defaultValue={annotation.text}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const t = draft.trim();
            if (t && t !== annotation.text) onUpdate(t);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setDraft(annotation.text);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="bg-transparent border border-transparent text-foreground px-1.5 py-0.5 rounded text-xs outline-none hover:border-[#2a2a30] focus:bg-[#0a0a0c] focus:border-[#f5a623] select-text"
        />
        <div className="text-[10px] text-[#666] font-mono px-1.5">
          {annotation.x},{annotation.y} · {annotation.w}×{annotation.h}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        title="Delete annotation"
        className="w-6 h-6 rounded text-sm leading-none border border-[#2a2a30] bg-transparent text-[#888] cursor-pointer hover:bg-[#3a2020] hover:text-[#ff8888] hover:border-[#5a3030] shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
