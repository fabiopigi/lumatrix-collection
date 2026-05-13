"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useHeaderActionsSlot } from "@/components/header-actions-slot";
import {
  CELL_GAP,
  computeCellSize,
  DEFAULT_CONFIG,
  isMaskAvailable,
  loadConfig,
  saveConfig,
} from "@/lib/pixel-designer/config";
import { textPoints } from "@/lib/pixel-designer/fonts";
import {
  ellipsePoints,
  fillPoints,
  linePoints,
  rectPoints,
} from "@/lib/pixel-designer/geometry";
import { computeLedIndex } from "@/lib/pixel-designer/led-index";
import { buildExportJSON, parseImport } from "@/lib/pixel-designer/json-io";
import {
  COLOR_MODES,
  getDefaultColor,
  getPalette,
} from "@/lib/pixel-designer/palette";
import { exportPng } from "@/lib/pixel-designer/png-export";
import { symbolPoints } from "@/lib/pixel-designer/symbols";
import type {
  Config,
  FontKey,
  Mode,
  Page,
  Point,
  Preview,
  Selection,
  Snapshot,
  Tool,
} from "@/lib/pixel-designer/types";
import { AddPageModal } from "./add-page-modal";
import { ConfigModal } from "./config-modal";
import { PixelGrid } from "./pixel-grid";
import { SidePanel } from "./side-panel";
import { Toolbar } from "./toolbar";

type DragMode =
  | "free"
  | "shape"
  | "select-create"
  | "select-move"
  | "text-place"
  | "stamp-place"
  | null;

const HISTORY_LIMIT = 100;

function makeEmptyPixels(config: Config): (string | null)[] {
  return new Array(config.width * config.height).fill(null);
}

function clonePages(pages: Page[]): Page[] {
  return pages.map((p) => ({ label: p.label, pixels: p.pixels.slice() }));
}

export function Designer() {
  const [config, setConfig] = useState<Config>(() => ({ ...DEFAULT_CONFIG }));
  const [pages, setPages] = useState<Page[]>(() => [
    { label: "Page 1", pixels: makeEmptyPixels(DEFAULT_CONFIG) },
  ]);
  const [currentPage, setCurrentPage] = useState(0);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState<string>(getDefaultColor("rgb"));
  const [mode, setMode] = useState<Mode>("pixel");
  const [font, setFont] = useState<FontKey>("3x5");
  const [text, setText] = useState("");
  const [symbol, setSymbol] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [jsonValue, setJsonValue] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const [history, setHistory] = useState<Snapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const isDownRef = useRef(false);
  const dragModeRef = useRef<DragMode>(null);
  const dragStartRef = useRef<Point | null>(null);
  const dragEndRef = useRef<Point | null>(null);
  const dragOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const dragModifierRef = useRef({ alt: false, shift: false });
  const lastPaintRef = useRef<Point | null>(null);
  const dragGridRef = useRef<HTMLDivElement | null>(null);
  const dragPageRef = useRef<number>(0);

  const gridRefs = useRef<Array<HTMLDivElement | null>>([]);
  const setGridRef = useCallback(
    (i: number) => (el: HTMLDivElement | null) => {
      gridRefs.current[i] = el;
    },
    [],
  );

  const cellSize = useMemo(
    () => computeCellSize(config.width, config.height),
    [config.width, config.height],
  );
  const step = cellSize + CELL_GAP;

  const palette = useMemo(() => getPalette(config.colorMode), [config.colorMode]);
  const maskAvailable = useMemo(() => isMaskAvailable(config), [config]);

  // ============ helpers ============

  const pushHistory = useCallback(
    (
      nextPages: Page[] = pages,
      nextCurrent: number = currentPage,
    ) => {
      const snap: Snapshot = {
        pages: clonePages(nextPages),
        currentPage: nextCurrent,
      };
      setHistory((prev) => {
        let h = prev.slice(0, historyIndex + 1);
        h.push(snap);
        if (h.length > HISTORY_LIMIT) h = h.slice(h.length - HISTORY_LIMIT);
        setHistoryIndex(h.length - 1);
        return h;
      });
    },
    [pages, currentPage, historyIndex],
  );

  const applySnapshot = useCallback((snap: Snapshot) => {
    setPages(clonePages(snap.pages));
    setCurrentPage(Math.min(snap.currentPage, snap.pages.length - 1));
    setSelection(null);
    setPreview(null);
  }, []);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const ni = historyIndex - 1;
    setHistoryIndex(ni);
    applySnapshot(history[ni]);
  }, [applySnapshot, history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const ni = historyIndex + 1;
    setHistoryIndex(ni);
    applySnapshot(history[ni]);
  }, [applySnapshot, history, historyIndex]);

  // ============ load persisted config + initial history snapshot ============

  // One-shot hydration from localStorage. The effect-with-setState pattern is the
  // correct shape here: a lazy useState initializer would compute different values
  // on server vs. client, causing a hydration mismatch.
  useEffect(() => {
    const persisted = loadConfig();
    /* eslint-disable react-hooks/set-state-in-effect */
    setConfig(persisted);
    const initialPages: Page[] = [
      { label: "Page 1", pixels: makeEmptyPixels(persisted) },
    ];
    setPages(initialPages);
    setColor(getDefaultColor(persisted.colorMode));
    setHistory([{ pages: clonePages(initialPages), currentPage: 0 }]);
    setHistoryIndex(0);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // ============ pixel writes ============

  const writePixels = useCallback(
    (
      writer: (px: (string | null)[]) => void,
      commit = true,
    ) => {
      setPages((prev) => {
        const next = prev.slice();
        const target = next[currentPage].pixels.slice();
        writer(target);
        next[currentPage] = { ...next[currentPage], pixels: target };
        if (commit) {
          // schedule history push after state settles
          queueMicrotask(() => pushHistory(next, currentPage));
        }
        return next;
      });
    },
    [currentPage, pushHistory],
  );

  // ============ selection ============

  const commitSelectionInto = useCallback(
    (sel: Selection, pixels: (string | null)[]) => {
      for (let dy = 0; dy < sel.h; dy++) {
        for (let dx = 0; dx < sel.w; dx++) {
          const c = sel.contents[dy * sel.w + dx];
          if (!c) continue;
          const tx = sel.x + dx;
          const ty = sel.y + dy;
          if (tx < 0 || tx >= config.width || ty < 0 || ty >= config.height)
            continue;
          pixels[ty * config.width + tx] = c;
        }
      }
    },
    [config.width, config.height],
  );

  const commitSelection = useCallback(() => {
    setSelection((sel) => {
      if (!sel || !sel.floating) return sel;
      setPages((prev) => {
        const next = prev.slice();
        const target = next[currentPage].pixels.slice();
        commitSelectionInto(sel, target);
        next[currentPage] = { ...next[currentPage], pixels: target };
        queueMicrotask(() => pushHistory(next, currentPage));
        return next;
      });
      return null;
    });
  }, [currentPage, commitSelectionInto, pushHistory]);

  // ============ tool/mode/color ============

  const handleSetTool = useCallback(
    (next: Tool) => {
      setSelection((sel) => {
        if (sel?.floating) {
          // commit floating selection on tool switch
          setPages((prev) => {
            const np = prev.slice();
            const target = np[currentPage].pixels.slice();
            commitSelectionInto(sel, target);
            np[currentPage] = { ...np[currentPage], pixels: target };
            queueMicrotask(() => pushHistory(np, currentPage));
            return np;
          });
          return null;
        }
        if (next !== "select") return null;
        return sel;
      });
      if (next !== "stamp") setSymbol(null);
      setPreview(null);
      setTool(next);
    },
    [commitSelectionInto, currentPage, pushHistory],
  );

  // ============ pages ============

  const setActivePage = useCallback(
    (pi: number) => {
      if (pi === currentPage) return;
      commitSelection();
      setCurrentPage(pi);
      setPreview(null);
    },
    [currentPage, commitSelection],
  );

  const addPage = useCallback(
    (copy: boolean) => {
      setPages((prev) => {
        const newPage: Page = {
          label: `Page ${prev.length + 1}`,
          pixels: copy
            ? prev[currentPage].pixels.slice()
            : makeEmptyPixels(config),
        };
        const insertAt = currentPage + 1;
        const next = prev.slice();
        next.splice(insertAt, 0, newPage);
        queueMicrotask(() => pushHistory(next, insertAt));
        return next;
      });
      setCurrentPage((cp) => cp + 1);
    },
    [config, currentPage, pushHistory],
  );

  const deletePage = useCallback(
    (idx: number) => {
      if (pages.length <= 1) return;
      if (!window.confirm(`Delete "${pages[idx].label}"?`)) return;
      setPages((prev) => {
        const next = prev.slice();
        next.splice(idx, 1);
        const nextCurrent = Math.min(currentPage, next.length - 1);
        queueMicrotask(() => pushHistory(next, nextCurrent));
        if (currentPage >= next.length) setCurrentPage(next.length - 1);
        return next;
      });
    },
    [pages, currentPage, pushHistory],
  );

  const renamePage = useCallback((idx: number, label: string) => {
    setPages((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], label };
      return next;
    });
  }, []);

  // ============ pointer handling ============

  const eventToCell = useCallback(
    (e: { clientX: number; clientY: number }, gridEl: HTMLDivElement): Point | null => {
      const rect = gridEl.getBoundingClientRect();
      const lx = e.clientX - rect.left;
      const ly = e.clientY - rect.top;
      const x = Math.floor(lx / step);
      const y = Math.floor(ly / step);
      if (x < 0 || x >= config.width || y < 0 || y >= config.height) return null;
      return { x, y };
    },
    [config.width, config.height, step],
  );

  const shapePts = useCallback(
    (a: Point, b: Point, t: Tool): Point[] => {
      if (t === "line") return linePoints(a.x, a.y, b.x, b.y);
      if (t === "rect") return rectPoints(a.x, a.y, b.x, b.y, false);
      if (t === "rectfill") return rectPoints(a.x, a.y, b.x, b.y, true);
      if (t === "ellipse")
        return ellipsePoints(a.x, a.y, b.x, b.y, false, config.width, config.height);
      if (t === "ellipsefill")
        return ellipsePoints(a.x, a.y, b.x, b.y, true, config.width, config.height);
      return [];
    },
    [config.width, config.height],
  );

  const previewShape = useCallback(
    (a: Point, c: Point): Preview => ({
      points: shapePts(a, c, tool).map((p) => ({ ...p, color })),
    }),
    [tool, color, shapePts],
  );

  const previewText = useCallback(
    (c: Point): Preview => ({
      points: textPoints(text, font, c.x, c.y).map((p) => ({
        ...p,
        color,
        ghost: true,
      })),
    }),
    [text, font, color],
  );

  const previewStamp = useCallback(
    (c: Point): Preview | null => {
      if (!symbol) return null;
      return {
        points: symbolPoints(symbol, c.x, c.y).map((p) => ({
          ...p,
          color,
          ghost: true,
        })),
      };
    },
    [symbol, color],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent, pageIdx: number) => {
      if (e.button !== 0) return;
      const grid = gridRefs.current[pageIdx];
      if (!grid) return;
      if (pageIdx !== currentPage) setActivePage(pageIdx);
      const c = eventToCell(e, grid);
      if (!c) return;
      e.preventDefault();

      dragGridRef.current = grid;
      dragPageRef.current = pageIdx;
      isDownRef.current = true;
      dragStartRef.current = c;
      dragEndRef.current = c;
      dragModifierRef.current = { alt: e.altKey, shift: e.shiftKey };

      const t = tool;
      if (t === "pencil") {
        dragModeRef.current = "free";
        lastPaintRef.current = c;
        writePixels((px) => {
          px[c.y * config.width + c.x] = color;
        }, false);
      } else if (t === "eraser") {
        dragModeRef.current = "free";
        lastPaintRef.current = c;
        writePixels((px) => {
          px[c.y * config.width + c.x] = null;
        }, false);
      } else if (t === "fill") {
        const pts = fillPoints(
          c.x,
          c.y,
          config.width,
          config.height,
          pages[currentPage].pixels,
        );
        writePixels((px) => {
          for (const p of pts) px[p.y * config.width + p.x] = color;
        });
        dragModeRef.current = null;
        isDownRef.current = false;
      } else if (t === "eyedrop") {
        const v = pages[currentPage].pixels[c.y * config.width + c.x];
        if (v) setColor(v);
        isDownRef.current = false;
      } else if (
        t === "line" ||
        t === "rect" ||
        t === "rectfill" ||
        t === "ellipse" ||
        t === "ellipsefill"
      ) {
        dragModeRef.current = "shape";
        setPreview(previewShape(c, c));
      } else if (t === "select") {
        if (selection && pointInSel(c, selection)) {
          dragModeRef.current = "select-move";
          dragOffsetRef.current = { x: c.x - selection.x, y: c.y - selection.y };
        } else {
          if (selection) commitSelection();
          dragModeRef.current = "select-create";
          // Create transient selection for visual feedback
          setSelection({
            x: c.x,
            y: c.y,
            w: 1,
            h: 1,
            contents: [null],
            floating: false,
            transient: true,
          });
        }
      } else if (t === "text") {
        dragModeRef.current = "text-place";
        setPreview(previewText(c));
      } else if (t === "stamp") {
        dragModeRef.current = "stamp-place";
        setPreview(previewStamp(c));
      }
    },
    [
      color,
      commitSelection,
      config.width,
      config.height,
      currentPage,
      eventToCell,
      pages,
      previewShape,
      previewStamp,
      previewText,
      selection,
      setActivePage,
      tool,
      writePixels,
    ],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      let c: Point | null = null;
      if (isDownRef.current && dragGridRef.current) {
        c = eventToCell(e, dragGridRef.current);
      } else {
        const target = e.target as HTMLElement | null;
        const grid = target?.closest?.(".pd-grid") as HTMLDivElement | null;
        if (grid && grid === gridRefs.current[currentPage]) {
          c = eventToCell(e, grid);
        }
      }

      setHover(c);

      if (!isDownRef.current) {
        if (c && (tool === "text" || tool === "stamp")) {
          setPreview(tool === "text" ? previewText(c) : previewStamp(c));
        } else if (tool !== "text" && tool !== "stamp") {
          setPreview((p) => (p ? null : p));
        }
        return;
      }
      if (!c) return;
      dragEndRef.current = c;
      const start = dragStartRef.current;
      if (!start) return;
      const mode = dragModeRef.current;

      if (mode === "free") {
        const last = lastPaintRef.current ?? start;
        const pts = linePoints(last.x, last.y, c.x, c.y);
        const fill = tool === "pencil" ? color : null;
        writePixels((px) => {
          for (const p of pts) {
            if (p.x < 0 || p.x >= config.width || p.y < 0 || p.y >= config.height)
              continue;
            px[p.y * config.width + p.x] = fill;
          }
        }, false);
        lastPaintRef.current = c;
      } else if (mode === "shape") {
        setPreview(previewShape(start, c));
      } else if (mode === "select-create") {
        const minX = Math.max(0, Math.min(start.x, c.x));
        const minY = Math.max(0, Math.min(start.y, c.y));
        const maxX = Math.min(config.width - 1, Math.max(start.x, c.x));
        const maxY = Math.min(config.height - 1, Math.max(start.y, c.y));
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        setSelection({
          x: minX,
          y: minY,
          w,
          h,
          contents: new Array(w * h).fill(null),
          floating: false,
          transient: true,
        });
      } else if (mode === "select-move") {
        setSelection((sel) =>
          sel
            ? {
                ...sel,
                x: c.x - dragOffsetRef.current.x,
                y: c.y - dragOffsetRef.current.y,
              }
            : sel,
        );
      }
    };

    const onUp = () => {
      if (!isDownRef.current) return;
      const start = dragStartRef.current;
      const end = dragEndRef.current ?? start;
      const mode = dragModeRef.current;
      const t = tool;

      if (start && end) {
        if (mode === "free") {
          pushHistory();
        } else if (mode === "shape") {
          const pts = shapePts(start, end, t);
          writePixels((px) => {
            for (const p of pts) {
              if (
                p.x < 0 ||
                p.x >= config.width ||
                p.y < 0 ||
                p.y >= config.height
              )
                continue;
              px[p.y * config.width + p.x] = color;
            }
          });
        } else if (mode === "select-create") {
          // Promote to floating selection
          const copy = dragModifierRef.current.alt;
          setSelection(() => {
            const minX = Math.max(0, Math.min(start.x, end.x));
            const minY = Math.max(0, Math.min(start.y, end.y));
            const maxX = Math.min(
              config.width - 1,
              Math.max(start.x, end.x),
            );
            const maxY = Math.min(
              config.height - 1,
              Math.max(start.y, end.y),
            );
            const w = maxX - minX + 1;
            const h = maxY - minY + 1;
            const contents: (string | null)[] = new Array(w * h).fill(null);
            const cur = pages[currentPage].pixels;
            for (let dy = 0; dy < h; dy++) {
              for (let dx = 0; dx < w; dx++) {
                contents[dy * w + dx] = cur[(minY + dy) * config.width + (minX + dx)];
              }
            }
            if (!copy) {
              writePixels((px) => {
                for (let dy = 0; dy < h; dy++) {
                  for (let dx = 0; dx < w; dx++) {
                    px[(minY + dy) * config.width + (minX + dx)] = null;
                  }
                }
              }, false);
            }
            return {
              x: minX,
              y: minY,
              w,
              h,
              contents,
              floating: true,
              copy,
            } as Selection;
          });
        } else if (mode === "text-place") {
          const pts = textPoints(text, font, end.x, end.y);
          writePixels((px) => {
            for (const p of pts) {
              if (
                p.x < 0 ||
                p.x >= config.width ||
                p.y < 0 ||
                p.y >= config.height
              )
                continue;
              px[p.y * config.width + p.x] = color;
            }
          });
        } else if (mode === "stamp-place" && symbol) {
          const pts = symbolPoints(symbol, end.x, end.y);
          writePixels((px) => {
            for (const p of pts) {
              if (
                p.x < 0 ||
                p.x >= config.width ||
                p.y < 0 ||
                p.y >= config.height
              )
                continue;
              px[p.y * config.width + p.x] = color;
            }
          });
        }
      }

      // Clear transient (non-floating) selection on mouseup
      setSelection((sel) => (sel && sel.transient && !sel.floating ? null : sel));

      isDownRef.current = false;
      dragModeRef.current = null;
      lastPaintRef.current = null;
      setPreview(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    color,
    config.height,
    config.width,
    currentPage,
    eventToCell,
    font,
    pages,
    previewShape,
    previewStamp,
    previewText,
    pushHistory,
    shapePts,
    symbol,
    text,
    tool,
    writePixels,
  ]);

  // ============ header actions ============

  const handleClear = useCallback(() => {
    setSelection(null);
    writePixels((px) => {
      px.fill(null);
    });
  }, [writePixels]);

  const handlePng = useCallback(() => {
    exportPng(config, pages, mode);
  }, [config, pages, mode]);

  // ============ keyboard ============

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        if (e.key === "Escape") (target as HTMLInputElement).blur();
        return;
      }
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && e.key === "Backspace") {
        e.preventDefault();
        handleClear();
        return;
      }
      if (selection) {
        if (e.key === "Escape" || e.key === "Enter") {
          e.preventDefault();
          commitSelection();
          return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          setSelection(null);
          pushHistory();
          return;
        }
        if (e.key === "ArrowLeft") {
          setSelection((sel) => (sel ? { ...sel, x: sel.x - 1 } : sel));
          e.preventDefault();
          return;
        }
        if (e.key === "ArrowRight") {
          setSelection((sel) => (sel ? { ...sel, x: sel.x + 1 } : sel));
          e.preventDefault();
          return;
        }
        if (e.key === "ArrowUp") {
          setSelection((sel) => (sel ? { ...sel, y: sel.y - 1 } : sel));
          e.preventDefault();
          return;
        }
        if (e.key === "ArrowDown") {
          setSelection((sel) => (sel ? { ...sel, y: sel.y + 1 } : sel));
          e.preventDefault();
          return;
        }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "p") handleSetTool("pencil");
      else if (k === "e") handleSetTool("eraser");
      else if (k === "f") handleSetTool("fill");
      else if (k === "i") handleSetTool("eyedrop");
      else if (k === "l") handleSetTool("line");
      else if (k === "r") handleSetTool(e.shiftKey ? "rectfill" : "rect");
      else if (k === "o") handleSetTool(e.shiftKey ? "ellipsefill" : "ellipse");
      else if (k === "s") handleSetTool("select");
      else if (k === "t") handleSetTool("text");
      else if (k === "m")
        setMode((m) => (m === "pixel" && maskAvailable ? "mask" : "pixel"));
      else if (k === "x") setColor("#000000");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, maskAvailable, redo, undo, handleSetTool, commitSelection, pushHistory]);

  // ============ JSON ============

  const handleExport = useCallback(() => {
    const out = buildExportJSON(config, pages);
    setJsonValue(JSON.stringify(out, null, 2));
    setImportError(null);
  }, [config, pages]);

  const handleImport = useCallback(() => {
    try {
      const result = parseImport(jsonValue, config);
      if (result.config && result.configMismatch) {
        const ok = window.confirm(
          `Imported design uses different matrix config (${result.config.width}×${result.config.height}, ${result.config.colorMode}). Apply?`,
        );
        if (ok) {
          setConfig(result.config);
          saveConfig(result.config);
        }
      }
      setPages(result.pages);
      setCurrentPage(0);
      setSelection(null);
      pushHistory(result.pages, 0);
      setImportError(null);
    } catch (err) {
      setImportError(`Import error: ${(err as Error).message}`);
    }
  }, [jsonValue, config, pushHistory]);

  const handleCopy = useCallback(async () => {
    let toCopy = jsonValue;
    if (!toCopy) {
      const out = buildExportJSON(config, pages);
      toCopy = JSON.stringify(out, null, 2);
      setJsonValue(toCopy);
    }
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy"), 1200);
    } catch {
      // fallback: leave the textarea filled; user can select+copy
    }
  }, [jsonValue, config, pages]);

  // ============ config save ============

  const handleConfigSave = useCallback(
    (next: Config) => {
      saveConfig(next);
      setConfig(next);
      const N = next.width * next.height;
      const remapped = pages.map((p) => ({
        label: p.label,
        pixels:
          p.pixels.length === N
            ? p.pixels.slice()
            : new Array(N).fill(null),
      }));
      setPages(remapped);
      const pal = COLOR_MODES[next.colorMode]?.palette ?? [];
      const norm = (c: string) => c.toLowerCase();
      if (!pal.map(norm).includes(norm(color))) {
        setColor(getDefaultColor(next.colorMode));
      }
      setSelection(null);
      setHistory([{ pages: clonePages(remapped), currentPage: 0 }]);
      setHistoryIndex(0);
      setCurrentPage((c) => Math.min(c, remapped.length - 1));
      if (!isMaskAvailable(next) && mode === "mask") setMode("pixel");
      setConfigOpen(false);
    },
    [pages, color, mode],
  );

  // ============ derived UI ============

  const stCell = hover ? `${hover.x},${hover.y}` : "—";
  const stLed = hover ? computeLedIndex(hover.x, hover.y, config) : "—";
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const headerSlot = useHeaderActionsSlot();
  const headerActions = (
    <>
      <div className="flex gap-1.5">
        <IconBtn title="Undo (⌘Z)" disabled={!canUndo} onClick={undo}>
          ↶
        </IconBtn>
        <IconBtn title="Redo (⌘⇧Z)" disabled={!canRedo} onClick={redo}>
          ↷
        </IconBtn>
      </div>
      <div className="w-px h-5 bg-edge mx-1" />
      <div className="flex gap-1.5">
        <HeaderBtn onClick={handleClear} title="Clear all (⌘⌫)">
          Clear
        </HeaderBtn>
        <HeaderBtn onClick={handlePng} title="Export PNG snapshot">
          PNG
        </HeaderBtn>
        <IconBtn title="Matrix configuration" onClick={() => setConfigOpen(true)}>
          ⚙
        </IconBtn>
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] min-h-[480px]">
      {headerSlot && createPortal(headerActions, headerSlot)}

      <div className="flex flex-1 min-h-0">
        <Toolbar tool={tool} onTool={handleSetTool} />

        <section
          className="flex-1 min-w-0 flex flex-col items-center gap-4 overflow-auto p-8 px-5"
          style={{
            background:
              "radial-gradient(ellipse at center, #18181d 0%, #0a0a0c 100%)",
          }}
        >
          <div className="flex flex-col gap-[18px] items-center w-full">
            {pages.map((page, pi) => {
              const isActive = pi === currentPage;
              return (
                <div
                  key={pi}
                  className={`flex flex-col gap-2 items-stretch rounded-xl p-1.5 border-2 transition-colors ${
                    isActive
                      ? "border-accent/40 bg-accent/[0.04]"
                      : "border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 px-1.5">
                    <span
                      className={`font-mono text-[11px] font-bold min-w-[24px] ${
                        isActive ? "text-accent" : "text-[#555]"
                      }`}
                    >
                      #{pi + 1}
                    </span>
                    <input
                      value={page.label}
                      onChange={(e) => renamePage(pi, e.target.value)}
                      onFocus={() => setActivePage(pi)}
                      onBlur={() => pushHistory()}
                      placeholder="Page label"
                      className="flex-1 bg-transparent border border-transparent text-foreground px-2 py-1 rounded text-xs outline-none hover:border-[#2a2a30] focus:bg-[#0a0a0c] focus:border-[#4a90e2] select-text"
                    />
                    <button
                      type="button"
                      onClick={() => deletePage(pi)}
                      disabled={pages.length <= 1}
                      title="Delete page"
                      className="w-6 h-6 rounded text-sm leading-none border border-[#2a2a30] bg-transparent text-[#888] cursor-pointer hover:bg-[#3a2020] hover:text-[#ff8888] hover:border-[#5a3030] disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#888] disabled:hover:border-[#2a2a30]"
                    >
                      ✕
                    </button>
                  </div>
                  <div
                    onMouseDown={(e) => onMouseDown(e, pi)}
                    onContextMenu={(e) => {
                      if ((e.target as HTMLElement).closest(".pd-grid"))
                        e.preventDefault();
                    }}
                  >
                    <PixelGrid
                      ref={setGridRef(pi)}
                      config={config}
                      pixels={page.pixels}
                      mode={mode}
                      cellSize={cellSize}
                      preview={isActive ? preview : null}
                      selection={isActive ? selection : null}
                      isActive={isActive}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setAddPageOpen(true)}
            className="px-3 py-1.5 rounded text-xs cursor-pointer bg-[#4a90e2] text-[#06121e] border border-[#4a90e2] font-semibold hover:bg-[#5fa0ee] mt-1"
          >
            + Add page
          </button>

          <div className="font-mono text-[11px] text-[#777] flex gap-[18px] flex-wrap justify-center">
            <span>
              <b className="text-[#aaa] font-medium">Page:</b>{" "}
              {currentPage + 1}/{pages.length}
            </span>
            <span>
              <b className="text-[#aaa] font-medium">Cell:</b> {stCell}
            </span>
            <span>
              <b className="text-[#aaa] font-medium">LED:</b> {String(stLed)}
            </span>
            <span>
              <b className="text-[#aaa] font-medium">Tool:</b> {tool}
            </span>
            <span>
              <b className="text-[#aaa] font-medium">Mode:</b> {mode}
            </span>
          </div>
        </section>

        <SidePanel
          mode={mode}
          maskAvailable={maskAvailable}
          onMode={setMode}
          color={color}
          palette={palette}
          onColor={setColor}
          font={font}
          text={text}
          onFont={setFont}
          onText={(t) => {
            setText(t);
            if (t && tool !== "text") handleSetTool("text");
          }}
          symbol={symbol}
          onSymbol={(s) => {
            setSymbol(s);
            handleSetTool("stamp");
          }}
          jsonValue={jsonValue}
          onJsonChange={setJsonValue}
          onExport={handleExport}
          onImport={handleImport}
          onCopy={handleCopy}
          copyLabel={copyLabel}
          importError={importError}
        />
      </div>

      <AddPageModal
        open={addPageOpen}
        onClose={() => setAddPageOpen(false)}
        onAdd={(copy) => {
          setAddPageOpen(false);
          addPage(copy);
        }}
      />
      <ConfigModal
        open={configOpen}
        current={config}
        onClose={() => setConfigOpen(false)}
        onSave={handleConfigSave}
      />
    </div>
  );
}

function pointInSel(p: Point, sel: Selection): boolean {
  return p.x >= sel.x && p.x < sel.x + sel.w && p.y >= sel.y && p.y < sel.y + sel.h;
}

function HeaderBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="px-3 py-1.5 rounded text-xs cursor-pointer bg-[#22222a] border border-[#2f2f37] text-foreground hover:bg-[#2c2c34]"
    >
      {children}
    </button>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="w-8 h-8 p-0 inline-flex items-center justify-center rounded text-xs cursor-pointer bg-[#22222a] border border-[#2f2f37] text-foreground hover:bg-[#2c2c34] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#22222a]"
    >
      {children}
    </button>
  );
}
