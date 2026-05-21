"use client";

import { createContext, useContext, useState } from "react";
import type {
  SpriteKey,
  SpriteSet,
} from "@/lib/pixel-designer/sprites";
import { formatSpriteKey, parseSpriteKey } from "@/lib/pixel-designer/sprites";
import type {
  Annotation,
  Config,
  DesignPage,
  FontKey,
  Mode,
  Selection,
} from "@/lib/pixel-designer/types";
import { PANEL_DEFAULT_OPEN } from "@/lib/pixel-designer/panel-state";
import { FontPreviewModal } from "./font-preview-modal";
import { PreviewPanelBody } from "./preview-panel-body";

const FONT_OPTIONS: Array<{ value: FontKey; label: string }> = [
  { value: "3x5", label: "3×5  ·  fixed-width" },
  { value: "5x8", label: "5×8  ·  fixed-width" },
  { value: "7x9", label: "7×9  ·  proportional (Jersey 10)" },
];

/** Encoding of which palette source feeds the swatch grid:
 *  - "default": the per-color-mode built-in palette
 *  - "used":    the auto-derived "colours already painted on the canvas"
 *  - "custom:<id>": one of the user's saved palettes, identified by id */
export type PaletteSourceKey = "default" | "used" | `custom:${string}`;

export interface PaletteSourceOption {
  /** Value used in the <select>. Matches PaletteSourceKey. */
  value: PaletteSourceKey;
  label: string;
  group: "builtin" | "custom";
}

interface SidePanelProps {
  mode: Mode;
  maskAvailable: boolean;
  onMode: (m: Mode) => void;

  color: string;
  palette: string[];
  paletteSource: PaletteSourceKey;
  paletteOptions: PaletteSourceOption[];
  onPaletteSource: (source: PaletteSourceKey) => void;
  /** Save the *visible* swatches as a new named custom palette. Parent opens
   *  the name-input modal. Always enabled. */
  onSavePalette: () => void;
  /** Rename the active palette. Parent only wires this when source is custom. */
  onRenamePalette: () => void;
  /** Delete the active palette. Parent only wires this when source is custom. */
  onDeletePalette: () => void;
  onColor: (c: string) => void;

  font: FontKey;
  text: string;
  onFont: (f: FontKey) => void;
  onText: (t: string) => void;

  symbol: SpriteKey | null;
  onSymbol: (s: SpriteKey) => void;
  /** All available sprite sets (Classic mono + any PNG-backed sets the
   *  loader resolved). Empty array while the async PNGs are still
   *  decoding — the Sprites panel falls back to a "Loading…" hint. */
  spriteSets: SpriteSet[];
  /** Maximum sprite cell size that fits the active canvas. Sets larger
   *  than this are hidden from the picker — the user can switch hardware
   *  variants to access bigger sprite packs. */
  maxSpriteSize: number;

  annotations: Annotation[];
  selection: Selection | null;
  showAnnotations: boolean;
  onShowAnnotations: (v: boolean) => void;
  onAddAnnotation: (text: string) => void;
  onUpdateAnnotation: (id: string, text: string) => void;
  onDeleteAnnotation: (id: string) => void;

  // Animation preview — the source data the Preview panel renders. When
  // `previewablePages` is empty (or less than 2), the panel still renders
  // its header so the layout stays stable, but the body shows a hint.
  previewablePages: DesignPage[];
  previewPresetId: string;
  previewConfig: Config;

  // Persistent collapsed/expanded state. Keys are stable panel ids
  // (kebab-case). Missing keys fall back to each panel's `defaultOpen`.
  openPanels: Record<string, boolean>;
  onTogglePanel: (id: string) => void;
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

  // Preview is "ready" when there's a sequence to play AND every page has a
  // variant for the active preset (so the same view holds the whole way).
  // The Section is mounted regardless so its position in the panel order
  // (and the user's open/closed preference) stay stable.
  const previewReady =
    props.previewablePages.length > 1 &&
    props.previewablePages.every(
      (p) => p.variants[props.previewPresetId],
    );

  return (
    <PanelStateContext.Provider
      value={{ open: props.openPanels, onToggle: props.onTogglePanel }}
    >
    <aside
      className="w-[340px] h-full bg-surface-1 border-l border-edge p-3.5 overflow-y-auto shrink-0"
      style={{ scrollbarGutter: "stable" }}
    >
      <Section id="mode" title="Mode">
        <div className="toggle-row flex bg-sunken p-0.5 rounded-md border border-edge">
          <ToggleButton
            on={props.mode === "pixel"}
            onClick={() => props.onMode("pixel")}
          >
            Pixel
          </ToggleButton>
          <ToggleButton
            on={props.mode === "led"}
            onClick={() => props.onMode("led")}
            title="LED mode mimics how the physical LUMATRIX looks — bright chip in the middle of each cell with the colour radiating outward."
          >
            LED
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
          LED mode previews how the physical board looks; Mask mode renders
          each LED as its assigned letter glyph (define one in ⚙ Config →
          Letter mask). Drawing still works per pixel in every mode.
        </Tip>
      </Section>

      <Section id="preview" title="Preview" hint="play multi-page animation">
        {previewReady ? (
          <PreviewPanelBody
            pages={props.previewablePages}
            presetId={props.previewPresetId}
            config={props.previewConfig}
          />
        ) : (
          <div className="text-[10.5px] text-fg-faint italic px-1 py-2">
            Need at least 2 pages all sharing the active variant. Add a page or
            an extra variant to start previewing.
          </div>
        )}
      </Section>

      <Section id="color" title="Color">
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
            aria-label="Color hex value"
            defaultValue={props.color.toUpperCase()}
            key={props.color}
            onBlur={(e) => handleHexBlur(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            maxLength={7}
            className="flex-1 bg-sunken border border-edge text-foreground px-2 py-1.5 rounded font-mono text-xs uppercase outline-none focus:border-cta focus:bg-input-focus select-text"
          />
        </div>
        <PaletteSourcePicker
          source={props.paletteSource}
          options={props.paletteOptions}
          onSource={props.onPaletteSource}
          paletteSize={props.palette.length}
          onSave={props.onSavePalette}
          onRename={props.onRenamePalette}
          onDelete={props.onDeletePalette}
        />
        {props.palette.length === 0 ? (
          <div className="text-[10.5px] text-fg-faint italic px-1 py-2">
            {props.paletteSource === "used"
              ? "No colours on the canvas yet — paint something to populate this palette."
              : "This palette is empty."}
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {props.palette.map((c, i) => {
              const selected = c.toLowerCase() === props.color.toLowerCase();
              return (
                <button
                  key={`${c}-${i}`}
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
        )}
      </Section>

      <Section id="text" title="Text" hint="type then click on grid">
        <div className="flex items-center gap-1.5 mb-1.5">
          <select
            value={props.font}
            onChange={(e) => props.onFont(e.target.value as FontKey)}
            className="flex-1 bg-sunken border border-edge text-foreground px-2 py-1.5 rounded text-xs outline-none focus:border-cta focus:bg-input-focus cursor-pointer"
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
            className="px-2 py-1.5 rounded text-xs bg-raised border border-line-strong text-foreground hover:bg-raised-hover cursor-pointer shrink-0"
          >
            Preview
          </button>
        </div>
        <input
          type="text"
          aria-label="Text to stamp onto the grid"
          value={props.text}
          onChange={(e) => props.onText(e.target.value)}
          placeholder="Type to preview…"
          maxLength={32}
          className="w-full bg-sunken border border-edge text-foreground px-2 py-1.5 rounded text-xs outline-none focus:border-cta focus:bg-input-focus select-text"
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

      <Section id="symbols" title="Sprites" hint="click then click grid">
        <SpritesPanel
          sets={props.spriteSets}
          maxSize={props.maxSpriteSize}
          symbol={props.symbol}
          color={props.color}
          onSymbol={props.onSymbol}
        />
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

      <Section id="shortcuts" title="Shortcuts">
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
    </PanelStateContext.Provider>
  );
}

/** Context wiring the collapsed/expanded state of every Section in the
 *  side-panel to a single source of truth held by `Designer`. The map is
 *  the persisted localStorage map; missing entries fall back to each
 *  Section's `defaultOpen` prop. */
interface PanelStateCtx {
  open: Record<string, boolean>;
  onToggle: (id: string) => void;
}
const PanelStateContext = createContext<PanelStateCtx | null>(null);

function Section({
  id,
  title,
  hint,
  children,
}: {
  /** Stable kebab-case id; used as the localStorage key for persisting the
   *  collapsed/expanded state. */
  id: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const ctx = useContext(PanelStateContext);
  const fallback = PANEL_DEFAULT_OPEN[id] ?? true;
  const open = ctx ? (ctx.open[id] ?? fallback) : fallback;
  const headerId = `panel-${id}-header`;
  const bodyId = `panel-${id}-body`;
  return (
    <div className={open ? "mb-[18px]" : "mb-1.5"}>
      <button
        id={headerId}
        type="button"
        onClick={() => ctx?.onToggle(id)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="w-full flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-fg-faint mb-2 font-semibold cursor-pointer hover:text-foreground transition-colors text-left bg-transparent border-0 p-0 select-none"
      >
        <span
          aria-hidden
          className={`inline-block text-[9px] transition-transform duration-150 ${
            open ? "rotate-90" : "rotate-0"
          }`}
        >
          ▶
        </span>
        <span>{title}</span>
        {hint && (
          <span className="font-normal text-fg-faint normal-case tracking-normal text-[10px]">
            {hint}
          </span>
        )}
      </button>
      {open && (
        <div id={bodyId} role="region" aria-labelledby={headerId}>
          {children}
        </div>
      )}
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
        on ? "bg-[#2a3a4a] text-accent" : "bg-transparent text-muted"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] text-fg-faint leading-[1.5] mt-1">
      {children}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block font-mono text-[10px] bg-line-strong border border-line-stronger rounded-[3px] px-[4px] py-px text-fg-2 min-w-[14px] text-center">
      {children}
    </span>
  );
}

function SpritesPanel({
  sets,
  maxSize,
  symbol,
  color,
  onSymbol,
}: {
  sets: SpriteSet[];
  maxSize: number;
  symbol: SpriteKey | null;
  color: string;
  onSymbol: (s: SpriteKey) => void;
}) {
  // Hide sets larger than the active variant — a 16×16 sprite can't fit on
  // 8×8 hardware. Switching variants in the header brings them back.
  const visible = sets.filter((s) => s.size <= maxSize);

  // Pick the active set: follow `symbol`'s setId when present, otherwise
  // default to the first visible set. If the persisted set is hidden by
  // the size filter, fall through to the default.
  const symbolSetId = symbol ? parseSpriteKey(symbol).setId : null;
  const fromSymbol =
    symbolSetId ? visible.find((s) => s.id === symbolSetId) : undefined;
  const [picked, setPicked] = useState<string | null>(null);
  const activeId =
    (picked && visible.find((s) => s.id === picked)?.id) ??
    fromSymbol?.id ??
    visible[0]?.id ??
    null;
  const active = visible.find((s) => s.id === activeId) ?? null;

  if (sets.length === 0) {
    return (
      <div className="text-[10.5px] text-fg-faint italic px-1 py-2">
        Loading sprite sets…
      </div>
    );
  }
  if (!active) {
    return (
      <div className="text-[10.5px] text-fg-faint italic px-1 py-2">
        No sprite sets fit a {maxSize}×{maxSize} canvas yet. Switch to a larger
        variant in the header to access bigger sets.
      </div>
    );
  }

  // Sort options so the dropdown is grouped by size; pick a representative
  // tint colour for mono-set thumbnails so the buttons read like icons even
  // before the user picks one.
  const optionsBySize = new Map<number, SpriteSet[]>();
  for (const s of visible) {
    if (!optionsBySize.has(s.size)) optionsBySize.set(s.size, []);
    optionsBySize.get(s.size)!.push(s);
  }
  const sortedSizes = [...optionsBySize.keys()].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-2">
      <select
        aria-label="Sprite set"
        value={active.id}
        onChange={(e) => setPicked(e.target.value)}
        className="bg-sunken border border-edge text-foreground px-2 py-1.5 rounded text-xs outline-none focus:border-cta focus:bg-input-focus cursor-pointer"
      >
        {sortedSizes.map((size) => (
          <optgroup key={size} label={`${size}×${size}`}>
            {optionsBySize.get(size)!.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="flex flex-wrap gap-[5px]">
        {active.sprites.map((sprite) => {
          const key = formatSpriteKey(active.id, sprite.name);
          const selected = symbol === key;
          return (
            <button
              key={sprite.name}
              type="button"
              title={sprite.name}
              onClick={() => onSymbol(key)}
              className={`w-10 h-10 shrink-0 rounded border bg-panel-2 cursor-pointer p-[5px] flex items-center justify-center ${
                selected
                  ? "border-accent bg-active"
                  : "border-line-strong hover:bg-raised hover:border-line-stronger"
              }`}
            >
              <SpriteSvg
                pixels={sprite.pixels}
                size={active.size}
                tint={active.colorful ? null : color}
              />
            </button>
          );
        })}
      </div>

      {(active.attribution || active.license) && (
        <AttributionLine
          name={active.name}
          license={active.license}
          attribution={active.attribution}
          url={active.attributionUrl}
        />
      )}
    </div>
  );
}

function SpriteSvg({
  pixels,
  size,
  tint,
}: {
  pixels: (string | null)[];
  size: number;
  /** Mono sets render every filled cell in this colour (matches "stamp uses
   *  the active brush colour" behaviour). Pass null for colourful sets so
   *  each cell shows its own hex. */
  tint: string | null;
}) {
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = pixels[y * size + x];
      if (!c) continue;
      rects.push(
        <rect
          key={`${x},${y}`}
          x={x}
          y={y}
          width={1}
          height={1}
          fill={tint ?? c}
        />,
      );
    }
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="block w-full h-full">
      {rects}
    </svg>
  );
}

function AttributionLine({
  name,
  license,
  attribution,
  url,
}: {
  name: string;
  license?: string;
  attribution?: string;
  url?: string;
}) {
  const parts = [name];
  if (license) parts.push(license);
  if (attribution) parts.push(attribution);
  return (
    <div className="text-[10px] text-fg-faint px-1 leading-[1.4]">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="hover:text-foreground underline-offset-2 hover:underline"
        >
          {parts.join(" · ")} ↗
        </a>
      ) : (
        parts.join(" · ")
      )}
    </div>
  );
}

function normalizeHex(c: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#ff0000";
}

function PaletteSourcePicker({
  source,
  options,
  onSource,
  paletteSize,
  onSave,
  onRename,
  onDelete,
}: {
  source: PaletteSourceKey;
  options: PaletteSourceOption[];
  onSource: (s: PaletteSourceKey) => void;
  paletteSize: number;
  onSave: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const isCustom = source.startsWith("custom:");
  // "Save" is meaningful when there are swatches to capture. The default
  // palette is technically fixed, but users can still pin it under a name
  // as a starting point, so we allow it; only disable when there's nothing
  // to save (e.g. empty "used on canvas").
  const canSave = paletteSize > 0;
  const builtin = options.filter((o) => o.group === "builtin");
  const custom = options.filter((o) => o.group === "custom");
  return (
    <div className="flex items-stretch gap-1 mb-2">
      <select
        aria-label="Palette source"
        value={source}
        onChange={(e) => onSource(e.target.value as PaletteSourceKey)}
        className="flex-1 min-w-0 bg-sunken border border-edge text-foreground px-2 py-1.5 rounded text-xs outline-none focus:border-cta focus:bg-input-focus cursor-pointer"
      >
        {builtin.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {custom.length > 0 && (
          <optgroup label="Custom">
            {custom.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <PaletteActionBtn
        title="Save current palette as…"
        onClick={onSave}
        disabled={!canSave}
      >
        Save
      </PaletteActionBtn>
      <PaletteActionBtn
        title={isCustom ? "Rename this palette" : "Only custom palettes can be renamed"}
        onClick={onRename}
        disabled={!isCustom}
      >
        Rename
      </PaletteActionBtn>
      <PaletteActionBtn
        title={isCustom ? "Delete this palette" : "Only custom palettes can be deleted"}
        onClick={onDelete}
        disabled={!isCustom}
        danger
      >
        ✕
      </PaletteActionBtn>
    </div>
  );
}

function PaletteActionBtn({
  children,
  onClick,
  title,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  const dangerCls = danger
    ? "hover:bg-danger-soft hover:text-danger hover:border-danger-line"
    : "hover:bg-raised-hover";
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`px-2 py-1.5 rounded text-[11px] cursor-pointer bg-raised border border-line-strong text-foreground disabled:opacity-30 disabled:cursor-not-allowed shrink-0 ${dangerCls}`}
    >
      {children}
    </button>
  );
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
    <Section id="annotations" title="Annotations" hint="label regions of the design">
      <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => onShow(e.target.checked)}
          className="cursor-pointer accent-warning"
        />
        <span className="text-[11px] text-fg-2">Show on grid</span>
      </label>

      <div className="rounded border border-edge bg-sunken p-2 mb-2">
        {hasSelection ? (
          <div className="text-[10.5px] text-fg-2 font-mono mb-1.5">
            Selection {selection!.x},{selection!.y} ·{" "}
            {selection!.w}×{selection!.h}
          </div>
        ) : (
          <div className="text-[10.5px] text-fg-faint mb-1.5">
            Make a selection (
            <Kbd>S</Kbd> tool) to label its region.
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            type="text"
            aria-label="Annotation label for selected region"
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
            className="flex-1 bg-sunken border border-edge text-foreground px-2 py-1.5 rounded text-xs outline-none focus:border-warning focus:bg-input-focus disabled:opacity-50 select-text"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="px-3 py-1.5 rounded text-xs cursor-pointer bg-warning text-warning-fg border border-warning font-semibold hover:bg-[#ffb83c] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-warning"
          >
            Add
          </button>
        </div>
      </div>

      {annotations.length === 0 ? (
        <div className="text-[10.5px] text-fg-faint italic">
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
    <div className="flex items-center gap-1.5 rounded border border-line-mute bg-sunken/40 px-2 py-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <input
          key={annotation.id + "-" + annotation.text}
          type="text"
          aria-label="Annotation text"
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
          className="bg-transparent border border-transparent text-foreground px-1.5 py-0.5 rounded text-xs outline-none hover:border-line-strong focus:bg-sunken focus:border-warning select-text"
        />
        <div className="text-[10px] text-fg-faint font-mono px-1.5">
          {annotation.x},{annotation.y} · {annotation.w}×{annotation.h}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        title="Delete annotation"
        className="w-6 h-6 rounded text-sm leading-none border border-line-strong bg-transparent text-muted cursor-pointer hover:bg-danger-soft hover:text-danger hover:border-danger-line shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
