"use client";

import { useRef } from "react";
import { SYMBOLS } from "@/lib/pixel-designer/symbols";
import type { FontKey, Mode } from "@/lib/pixel-designer/types";

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

  jsonValue: string;
  onJsonChange: (v: string) => void;
  onExport: () => void;
  onImport: () => void;
  onCopy: () => void;
  copyLabel: string;
  importError: string | null;
}

export function SidePanel(props: SidePanelProps) {
  const colorInputRef = useRef<HTMLInputElement>(null);

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
            className="relative w-7 h-7 rounded-md border border-white/10 cursor-pointer block"
            style={{ background: props.color }}
            onClick={() => colorInputRef.current?.click()}
            title="Click to pick custom"
          >
            <input
              ref={colorInputRef}
              type="color"
              value={normalizeHex(props.color)}
              onChange={(e) => props.onColor(e.target.value)}
              className="absolute opacity-0 pointer-events-none w-0 h-0"
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
        <div className="flex items-center mb-1.5">
          <div className="flex bg-[#0a0a0c] p-0.5 rounded-md border border-edge w-full">
            <ToggleButton
              on={props.font === "3x5"}
              onClick={() => props.onFont("3x5")}
            >
              3×5
            </ToggleButton>
            <ToggleButton
              on={props.font === "5x8"}
              onClick={() => props.onFont("5x8")}
            >
              5×8
            </ToggleButton>
          </div>
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

      <Section title="Design JSON">
        <textarea
          value={props.jsonValue}
          onChange={(e) => props.onJsonChange(e.target.value)}
          spellCheck={false}
          placeholder="Click Export to fill, or paste JSON and click Import."
          className="w-full h-[120px] bg-[#0a0a0c] border border-edge text-foreground p-2 rounded font-mono text-[10.5px] leading-[1.4] resize-y outline-none focus:border-[#4a90e2] focus:bg-[#0e0e12] select-text"
        />
        <div className="flex gap-1.5 mt-1.5">
          <Btn primary onClick={props.onExport} className="flex-1">
            Export
          </Btn>
          <Btn onClick={props.onImport} className="flex-1">
            Import
          </Btn>
          <Btn onClick={props.onCopy} className="flex-1">
            {props.copyLabel}
          </Btn>
        </div>
        {props.importError && (
          <div className="mt-1.5 text-[11px] text-[#ff8888] font-mono">
            {props.importError}
          </div>
        )}
      </Section>

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

function Btn({
  children,
  onClick,
  primary,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs cursor-pointer transition-colors ${
        primary
          ? "bg-[#4a90e2] text-[#06121e] border border-[#4a90e2] font-semibold hover:bg-[#5fa0ee]"
          : "bg-[#22222a] border border-[#2f2f37] text-foreground hover:bg-[#2c2c34]"
      } ${className ?? ""}`}
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
