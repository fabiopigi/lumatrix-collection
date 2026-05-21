"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useHeaderActionsSlot } from "@/components/header-actions-slot";
import {
  activeConfig,
  CELL_GAP,
  cloneDesign,
  computeCellSize,
  DEFAULT_DESIGN,
  DEFAULT_PRESET_ID,
  isMaskAvailable,
} from "@/lib/pixel-designer/config";
import {
  autosave,
  deleteDesign,
  getCurrent,
  importIntoLibrary,
  isScratch as libIsScratch,
  type Library,
  listDesigns,
  loadLibrary,
  newDesign,
  nextUntitledName,
  openDesign,
  renameDesign,
  saveAs,
} from "@/lib/pixel-designer/library";
import {
  decodeDesign,
  parseShareHash,
} from "@/lib/pixel-designer/share-link";
import { textPoints } from "@/lib/pixel-designer/fonts";
import {
  ellipsePoints,
  fillPoints,
  linePoints,
  rectPoints,
} from "@/lib/pixel-designer/geometry";
import { computeLedIndex } from "@/lib/pixel-designer/led-index";
import { importImageForHardware } from "@/lib/pixel-designer/image-import";
import { parseImport } from "@/lib/pixel-designer/json-io";
import {
  COLOR_MODES,
  getDefaultColor,
  getPalette,
  usedOnCanvasColors,
} from "@/lib/pixel-designer/palette";
import {
  deletePalette as deletePaletteRecord,
  listPalettes,
  loadPaletteLibrary,
  nextUntitledName as nextUntitledPaletteName,
  type PaletteLibrary,
  renamePalette as renamePaletteRecord,
  savePalette as savePaletteRecord,
} from "@/lib/pixel-designer/palette-library";
import { spritePointsAt } from "@/lib/pixel-designer/symbols";
import {
  loadAllSpriteSets,
  type SpriteKey,
  type SpriteSet,
  spritePixelsByKey,
} from "@/lib/pixel-designer/sprites";
import type {
  Annotation,
  Config,
  Design,
  FontKey,
  Hardware,
  Mode,
  Page,
  Point,
  Preview,
  Selection,
  Snapshot,
  Tool,
} from "@/lib/pixel-designer/types";
import { HARDWARE_PRESETS, presetIdsInOrder } from "@/lib/hardware-presets";
import {
  centerVariant,
  scaleVariant,
  type VariantSource,
} from "@/lib/pixel-designer/variants";
import { AddPageModal } from "./add-page-modal";
import { DesignNameModal } from "./design-name-modal";
import { DesignsMenu } from "./designs-menu";
import { ModalShell } from "./modal-shell";
import { OpenDesignModal } from "./open-design-modal";
import {
  AddVariantModal,
  type AddVariantInit,
  type AddVariantResult,
} from "./add-variant-modal";
import { ConfigModal } from "./config-modal";
import { DeletePageModal } from "./delete-page-modal";
import { ExportModal } from "./export-modal";
import { ImportModal } from "./import-modal";
import {
  PageMetaModal,
  type PageMetaPatch,
} from "./page-meta-modal";
import { PixelGrid } from "./pixel-grid";
import {
  loadPanelState,
  PANEL_DEFAULT_OPEN,
  type PanelState,
  setPanelOpen,
} from "@/lib/pixel-designer/panel-state";
import { PaletteNameModal } from "./palette-name-modal";
import { SidePanel, type PaletteSourceKey, type PaletteSourceOption } from "./side-panel";
import { Toolbar } from "./toolbar";
import { VariantPicker } from "./variant-picker";
import { VariantsStrip } from "./variants-strip";

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

/** Pick a sensible variant id for page `i` given a per-page preference list
 *  and the design's current state. Falls back to the page's first variant in
 *  canonical order if the stored preference is stale (e.g., after an undo
 *  removed the variant the user had selected). */
function resolveActivePresetFor(
  d: Design,
  presetByPage: string[],
  i: number,
): string {
  const page = d.pages[i];
  if (!page) return DEFAULT_PRESET_ID;
  const stored = presetByPage[i];
  if (stored && page.variants[stored]) return stored;
  const ordered = presetIdsInOrder(Object.keys(page.variants));
  return ordered[0] ?? DEFAULT_PRESET_ID;
}

/** Read the active-variant view of a design's pages. Each page resolves to
 *  its own preset from `presetByPage` — so different pages can show different
 *  variants. */
function viewPagesFromDesign(
  d: Design,
  presetByPage: string[],
): Page[] {
  return d.pages.map((p, i) => {
    const presetId = resolveActivePresetFor(d, presetByPage, i);
    const variant = p.variants[presetId];
    const hw = d.hardware[presetId];
    const n = hw ? hw.width * hw.height : 0;
    return {
      label: p.label,
      pixels: variant ? variant.pixels.slice() : new Array(n).fill(null),
    };
  });
}

/** Write a per-page view back into the design — each page's view pixels go
 *  into the variant for that page's currently-active preset. Pages whose
 *  active preset has no variant are left untouched. */
function applyPageViewToDesign(
  d: Design,
  presetByPage: string[],
  view: Page[],
): Design {
  return {
    ...d,
    pages: view.map((vp, i) => {
      const existing = d.pages[i];
      const presetId = resolveActivePresetFor(d, presetByPage, i);
      if (!existing) {
        // New page (added via splice) — nothing to merge with; this path
        // shouldn't fire under current call sites but is here for safety.
        return {
          label: vp.label,
          variants: presetId
            ? { [presetId]: { pixels: vp.pixels.slice() } }
            : {},
        };
      }
      if (!presetId || !existing.variants[presetId]) {
        return { ...existing, label: vp.label };
      }
      return {
        ...existing,
        label: vp.label,
        variants: {
          ...existing.variants,
          [presetId]: {
            ...existing.variants[presetId],
            pixels: vp.pixels.slice(),
          },
        },
      };
    }),
  };
}

/** Apply a Config edit to a design — colorMode goes global, the rest goes
 *  to the active preset's Hardware entry. On size change, the variant's
 *  pixels for that preset are resized (rows/cols preserved where they
 *  overlap; new cells start blank). */
function applyConfigToDesign(
  d: Design,
  presetId: string,
  next: Config,
): Design {
  const prev = activeConfig(d, presetId);
  const prevHw = d.hardware[presetId];
  const nextHw: Hardware = {
    presetId: prevHw?.presetId ?? presetId,
    width: next.width,
    height: next.height,
    origin: next.origin,
    axis: next.axis,
    serpentine: next.serpentine,
    letterMask: next.letterMask,
  };
  const sizeChanged =
    next.width !== prev.width || next.height !== prev.height;
  return {
    ...d,
    colorMode: next.colorMode,
    hardware: { ...d.hardware, [presetId]: nextHw },
    pages: sizeChanged
      ? d.pages.map((p) => {
          const oldVariant = p.variants[presetId];
          const oldPixels = oldVariant ? oldVariant.pixels : [];
          const newPixels: (string | null)[] = new Array(
            next.width * next.height,
          ).fill(null);
          const minW = Math.min(prev.width, next.width);
          const minH = Math.min(prev.height, next.height);
          for (let y = 0; y < minH; y++) {
            for (let x = 0; x < minW; x++) {
              newPixels[y * next.width + x] =
                oldPixels[y * prev.width + x] ?? null;
            }
          }
          // Clip annotations to the new grid; drop ones that no longer fit.
          const clipped = (oldVariant?.annotations ?? [])
            .map((a) => {
              const x = Math.max(0, Math.min(next.width - 1, a.x));
              const y = Math.max(0, Math.min(next.height - 1, a.y));
              const w = Math.max(0, Math.min(next.width - x, a.w));
              const h = Math.max(0, Math.min(next.height - y, a.h));
              return { ...a, x, y, w, h };
            })
            .filter((a) => a.w > 0 && a.h > 0);
          return {
            ...p,
            variants: {
              ...p.variants,
              [presetId]: {
                pixels: newPixels,
                ...(clipped.length > 0 ? { annotations: clipped } : {}),
              },
            },
          };
        })
      : d.pages,
  };
}

export function Designer() {
  const [design, _setDesignBase] = useState<Design>(() =>
    cloneDesign(DEFAULT_DESIGN),
  );
  // Per-page active variant. Each entry is the preset id whose pixels show
  // on that page. Stale entries (variant deleted) are resolved at read time
  // by resolveActivePresetFor — they don't have to be normalised eagerly.
  const [activePresetByPage, _setActivePresetByPageBase] = useState<string[]>(
    () => [DEFAULT_PRESET_ID],
  );
  const [currentPage, _setCurrentPageBase] = useState(0);

  // Refs mirror the latest values so that callbacks fired via queueMicrotask
  // (after a state update but before the next render) can read the just-
  // committed state without waiting for React's commit phase.
  const designRef = useRef(design);
  const activePresetByPageRef = useRef<string[]>([DEFAULT_PRESET_ID]);
  const currentPageRef = useRef(currentPage);

  const setDesign = useCallback(
    (updater: Design | ((prev: Design) => Design)) => {
      _setDesignBase((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (p: Design) => Design)(prev)
            : updater;
        designRef.current = next;
        return next;
      });
    },
    [],
  );

  const setActivePresetByPage = useCallback(
    (updater: string[] | ((prev: string[]) => string[])) => {
      _setActivePresetByPageBase((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (p: string[]) => string[])(prev)
            : updater;
        activePresetByPageRef.current = next;
        return next;
      });
    },
    [],
  );

  const setCurrentPage = useCallback(
    (val: number | ((prev: number) => number)) => {
      _setCurrentPageBase((prev) => {
        const next =
          typeof val === "function"
            ? (val as (p: number) => number)(prev)
            : val;
        currentPageRef.current = next;
        return next;
      });
    },
    [],
  );

  /** Update one page's active preset. Used by the variants strip on each
   *  page tab and (for the current page) by the header preset selector. */
  const setActivePresetForPage = useCallback(
    (pageIdx: number, presetId: string) => {
      setActivePresetByPage((prev) => {
        if (prev[pageIdx] === presetId) return prev;
        const next = prev.slice();
        next[pageIdx] = presetId;
        return next;
      });
    },
    [setActivePresetByPage],
  );

  /** Sugar for `setActivePresetForPage(currentPage, …)` — what the header
   *  hardware picker calls when the user changes the dropdown. */
  const setActivePreset = useCallback(
    (presetId: string) => {
      setActivePresetForPage(currentPageRef.current, presetId);
    },
    [setActivePresetForPage],
  );

  // Derived view: tools/renderers consume `config` and `pages` exactly as
  // before; reads go through each page's own active variant.
  const activePreset = resolveActivePresetFor(
    design,
    activePresetByPage,
    currentPage,
  );
  const config = useMemo(
    () => activeConfig(design, activePreset),
    [design, activePreset],
  );
  const pages = useMemo<Page[]>(
    () => viewPagesFromDesign(design, activePresetByPage),
    [design, activePresetByPage],
  );

  /** Wrapped setter that accepts a Page[] view and routes writes back to
   *  each page's currently-active variant. */
  const setPages = useCallback(
    (value: Page[] | ((prev: Page[]) => Page[])) => {
      setDesign((prev) => {
        const view = viewPagesFromDesign(prev, activePresetByPageRef.current);
        const nextView =
          typeof value === "function"
            ? (value as (p: Page[]) => Page[])(view)
            : value;
        return applyPageViewToDesign(
          prev,
          activePresetByPageRef.current,
          nextView,
        );
      });
    },
    [setDesign],
  );

  /** Wrapped setter that accepts a Config and edits the current page's
   *  active preset's hardware entry on the design. */
  const setConfig = useCallback(
    (value: Config | ((prev: Config) => Config)) => {
      setDesign((prev) => {
        const presetId = resolveActivePresetFor(
          prev,
          activePresetByPageRef.current,
          currentPageRef.current,
        );
        const prevCfg = activeConfig(prev, presetId);
        const nextCfg =
          typeof value === "function"
            ? (value as (p: Config) => Config)(prevCfg)
            : value;
        return applyConfigToDesign(prev, presetId, nextCfg);
      });
    },
    [setDesign],
  );
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState<string>(getDefaultColor("rgb"));
  const [mode, setMode] = useState<Mode>("pixel");
  const [font, setFont] = useState<FontKey>("3x5");
  const [text, setText] = useState("");
  // `symbol` is now a sprite key in the form "<setId>:<spriteName>" (see
  // sprites.ts `formatSpriteKey`). Kept as a single string so existing
  // serialisation / preview state plumbing doesn't change.
  const [symbol, setSymbol] = useState<SpriteKey | null>(null);
  const [spriteSets, setSpriteSets] = useState<SpriteSet[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [jsonValue, setJsonValue] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [addVariantFor, setAddVariantFor] = useState<number | null>(null);
  const [addVariantResult, setAddVariantResult] =
    useState<AddVariantResult | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [deletePromptFor, setDeletePromptFor] = useState<number | null>(null);
  const [metaModalFor, setMetaModalFor] = useState<number | null>(null);
  // Sidepanel collapses into a drawer below `lg`. State is harmless at lg+
  // because the drawer's positioning classes become inert at that breakpoint.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Collapsed/expanded state for the side-panel sections. Persisted to
  // localStorage so refreshing keeps the layout the user shaped.
  const [panelState, setPanelStateBase] = useState<PanelState>({
    schemaVersion: 1,
    open: {},
  });
  const togglePanel = useCallback((id: string) => {
    setPanelStateBase((prev) => {
      const current = prev.open[id];
      // Flip — if there's no entry yet, "current" is undefined; the section's
      // own defaultOpen drives the initial render, so a missing entry means
      // "matches default" and clicking should write the inverse.
      const fallback = PANEL_DEFAULT_OPEN[id] ?? true;
      const effective = typeof current === "boolean" ? current : fallback;
      return setPanelOpen(prev, id, !effective);
    });
  }, []);

  // Page reorder drag state. `dragFromIdx` is the index being dragged;
  // `dragOverIdx` is the gap index where dropping would insert the page
  // (0…pages.length, where N means "after the last page"). A mirroring ref
  // is read by dragover/drop handlers; those fire synchronously and can
  // race React's post-dragstart re-render, so the ref keeps them correct.
  const [dragFromIdx, _setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragFromIdxRef = useRef<number | null>(null);
  const setDragFromIdx = useCallback((v: number | null) => {
    dragFromIdxRef.current = v;
    _setDragFromIdx(v);
  }, []);

  const [history, setHistory] = useState<Snapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Library is the persistence layer. We mirror it in state so React updates
  // when the user opens / renames / deletes; autosave writes through here
  // too. A ref tracks the latest value so synchronous handlers (beforeunload,
  // pre-switch flush) can read it without waiting for the next render.
  const [library, _setLibraryBase] = useState<Library | null>(null);
  const libraryRef = useRef<Library | null>(null);
  const setLibrary = useCallback(
    (updater: Library | ((prev: Library) => Library)) => {
      _setLibraryBase((prev) => {
        if (!prev) return prev;
        const next =
          typeof updater === "function"
            ? (updater as (p: Library) => Library)(prev)
            : updater;
        libraryRef.current = next;
        return next;
      });
    },
    [],
  );
  // Modals for the Designs menu.
  const [openListOpen, setOpenListOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteDesignOpen, setDeleteDesignOpen] = useState(false);

  // Custom palette library — separate localStorage blob from the design
  // library. Mirrors `library` above: state for reactive UI plus a ref so
  // synchronous handlers can read the latest value.
  const [paletteLibrary, _setPaletteLibraryBase] =
    useState<PaletteLibrary | null>(null);
  const paletteLibraryRef = useRef<PaletteLibrary | null>(null);
  const setPaletteLibrary = useCallback(
    (updater: PaletteLibrary | ((prev: PaletteLibrary) => PaletteLibrary)) => {
      _setPaletteLibraryBase((prev) => {
        if (!prev) return prev;
        const next =
          typeof updater === "function"
            ? (updater as (p: PaletteLibrary) => PaletteLibrary)(prev)
            : updater;
        paletteLibraryRef.current = next;
        return next;
      });
    },
    [],
  );
  const [paletteSource, setPaletteSource] =
    useState<PaletteSourceKey>("default");
  const [savePaletteOpen, setSavePaletteOpen] = useState(false);
  const [renamePaletteOpen, setRenamePaletteOpen] = useState(false);
  const [deletePaletteOpen, setDeletePaletteOpen] = useState(false);

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

  const defaultPalette = useMemo(
    () => getPalette(config.colorMode),
    [config.colorMode],
  );
  const usedPalette = useMemo(() => usedOnCanvasColors(design), [design]);
  const customPalettes = useMemo(
    () => (paletteLibrary ? listPalettes(paletteLibrary) : []),
    [paletteLibrary],
  );
  const activeCustomPalette = useMemo(() => {
    if (!paletteSource.startsWith("custom:")) return null;
    const id = paletteSource.slice("custom:".length);
    return paletteLibrary?.palettes[id] ?? null;
  }, [paletteSource, paletteLibrary]);
  // Resolve the swatches the side-panel should render. If the source is a
  // custom palette that's since been deleted, fall back to default rather
  // than rendering an empty / stale grid.
  const palette = useMemo<string[]>(() => {
    if (paletteSource === "default") return defaultPalette;
    if (paletteSource === "used") return usedPalette;
    return activeCustomPalette?.colors ?? defaultPalette;
  }, [paletteSource, defaultPalette, usedPalette, activeCustomPalette]);
  const paletteOptions = useMemo<PaletteSourceOption[]>(() => {
    const opts: PaletteSourceOption[] = [
      { value: "default", label: "Default", group: "builtin" },
      { value: "used", label: "Used on canvas", group: "builtin" },
    ];
    for (const p of customPalettes) {
      opts.push({
        value: `custom:${p.id}` as PaletteSourceKey,
        label: p.name,
        group: "custom",
      });
    }
    return opts;
  }, [customPalettes]);
  const maskAvailable = useMemo(() => isMaskAvailable(config), [config]);

  const activePresetLabel = useMemo(() => {
    const preset = HARDWARE_PRESETS.find((p) => p.id === activePreset);
    if (preset) return preset.label;
    const hw = design.hardware[activePreset];
    return hw ? `${hw.width}×${hw.height}` : activePreset;
  }, [design.hardware, activePreset]);

  // ============ helpers ============

  const pushHistory = useCallback(
    (nextPages?: Page[], nextCurrent?: number) => {
      // Snapshot the latest design (via ref so it reflects the most recently
      // committed state, even if pushHistory is fired from queueMicrotask).
      // If a caller is in the middle of writing pages and hasn't waited for
      // React to re-render, they can pass the new Page[] view and the new
      // current-page index explicitly — those are merged into the snapshot.
      const baseDesign = designRef.current;
      const designForSnap =
        nextPages !== undefined
          ? applyPageViewToDesign(
              baseDesign,
              activePresetByPageRef.current,
              nextPages,
            )
          : baseDesign;
      const snap: Snapshot = {
        design: cloneDesign(designForSnap),
        activePage: nextCurrent ?? currentPageRef.current,
      };
      setHistory((prev) => {
        let h = prev.slice(0, historyIndex + 1);
        h.push(snap);
        if (h.length > HISTORY_LIMIT) h = h.slice(h.length - HISTORY_LIMIT);
        setHistoryIndex(h.length - 1);
        return h;
      });
    },
    [historyIndex],
  );

  const applySnapshot = useCallback(
    (snap: Snapshot) => {
      setDesign(cloneDesign(snap.design));
      setCurrentPage(
        Math.min(snap.activePage, snap.design.pages.length - 1),
      );
      setSelection(null);
      setPreview(null);
    },
    [setDesign, setCurrentPage],
  );

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

  // ============ load library + initial history snapshot ============

  // One-shot hydration from the design library. The effect-with-setState
  // pattern is the correct shape here: a lazy useState initializer would
  // compute different values on server vs. client (localStorage is undefined
  // on the server), causing a hydration mismatch.
  useEffect(() => {
    const lib = loadLibrary();
    const current = getCurrent(lib);
    const persisted = current.data;
    libraryRef.current = lib;
    /* eslint-disable react-hooks/set-state-in-effect */
    _setLibraryBase(lib);
    setDesign(cloneDesign(persisted));
    // Each page starts with its first canonical-order variant active. If a
    // page has no variants (shouldn't happen for a valid design), fall back
    // to the default preset id so the array stays page-length-aligned.
    const presetByPage = persisted.pages.map((p) => {
      const ordered = presetIdsInOrder(Object.keys(p.variants));
      return ordered[0] ?? DEFAULT_PRESET_ID;
    });
    setActivePresetByPage(
      presetByPage.length > 0 ? presetByPage : [DEFAULT_PRESET_ID],
    );
    setColor(getDefaultColor(persisted.colorMode));
    setHistory([
      {
        design: cloneDesign(persisted),
        activePage: 0,
      },
    ]);
    setHistoryIndex(0);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-shot hydration of the custom palette library. Separate localStorage
  // key, so it's loaded independently of the design library.
  useEffect(() => {
    const lib = loadPaletteLibrary();
    paletteLibraryRef.current = lib;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    _setPaletteLibraryBase(lib);
  }, []);

  // One-shot hydration of the collapsed/expanded panel state. Loaded after
  // mount so SSR doesn't try to read localStorage; until this fires, every
  // section uses its built-in default. The flicker is invisible in practice.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPanelStateBase(loadPanelState());
  }, []);

  // Resolve all sprite sets — the inline mono "Classic" set is synchronous,
  // any PNG-backed sets decode async. Once loaded, the Sprites panel switches
  // from the placeholder to the real grids. Cached at module scope (in
  // sprites.ts), so navigating between pages doesn't re-decode.
  useEffect(() => {
    let cancelled = false;
    loadAllSpriteSets().then((sets) => {
      if (!cancelled) setSpriteSets(sets);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ============ autosave to the library ============

  // Debounce so rapid pixel paints don't hammer localStorage. 500ms is short
  // enough that a tab close + reopen feels seamless and long enough that drag-
  // paint runs aren't constantly serializing.
  useEffect(() => {
    if (!libraryRef.current) return;
    const t = setTimeout(() => {
      setLibrary((lib) => autosave(lib, designRef.current));
    }, 500);
    return () => clearTimeout(t);
  }, [design, setLibrary]);

  // Flush any pending autosave synchronously before the tab unloads. With the
  // 500ms debounce, a fast close could otherwise drop the last few edits.
  useEffect(() => {
    const onBeforeUnload = () => {
      const lib = libraryRef.current;
      if (!lib) return;
      // autosave writes to localStorage synchronously; the in-memory state
      // update gets discarded with the page tear-down, which is fine.
      autosave(lib, designRef.current);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // ============ pixel writes ============

  const writePixels = useCallback(
    (
      writer: (px: (string | null)[]) => void,
      commit = true,
    ) => {
      // Read currentPage from the ref so writes that follow a setActivePage()
      // (e.g., first click on a different page) land on the just-focused page,
      // not the previously-focused one that's still in the closure.
      const pi = currentPageRef.current;
      setPages((prev) => {
        const next = prev.slice();
        const target = next[pi].pixels.slice();
        writer(target);
        next[pi] = { ...next[pi], pixels: target };
        if (commit) {
          // schedule history push after state settles
          queueMicrotask(() => pushHistory(next, pi));
        }
        return next;
      });
    },
    [pushHistory],
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
    const pi = currentPageRef.current;
    setSelection((sel) => {
      if (!sel || !sel.floating) return sel;
      setPages((prev) => {
        const next = prev.slice();
        const target = next[pi].pixels.slice();
        commitSelectionInto(sel, target);
        next[pi] = { ...next[pi], pixels: target };
        queueMicrotask(() => pushHistory(next, pi));
        return next;
      });
      return null;
    });
  }, [commitSelectionInto, pushHistory]);

  // ============ annotations ============

  const currentAnnotations = useMemo<Annotation[]>(() => {
    const v = design.pages[currentPage]?.variants[activePreset];
    return v?.annotations ?? [];
  }, [design, currentPage, activePreset]);

  /** Make a new annotation from the current selection's bounding rectangle.
   *  If the selection is floating (pixels were cut), its pixels are committed
   *  back to the canvas first — annotations are metadata, so we shouldn't
   *  destroy artwork in the act of labelling it. */
  const addAnnotationFromSelection = useCallback(
    (text: string) => {
      const sel = selection;
      const t = text.trim();
      if (!sel || !t) return;
      const pi = currentPageRef.current;
      const presetId = resolveActivePresetFor(
        designRef.current,
        activePresetByPageRef.current,
        pi,
      );
      const anno: Annotation = {
        id: `anno-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        x: sel.x,
        y: sel.y,
        w: sel.w,
        h: sel.h,
        text: t,
      };
      setDesign((prev) => {
        const page = prev.pages[pi];
        if (!page) return prev;
        const v = page.variants[presetId];
        if (!v) return prev;
        // Bake floating-selection pixels back in. Skips when the selection is
        // transient/non-floating since no pixels were cut in that case.
        let nextPixels = v.pixels;
        if (sel.floating) {
          const cfg = activeConfig(prev, presetId);
          nextPixels = v.pixels.slice();
          for (let dy = 0; dy < sel.h; dy++) {
            for (let dx = 0; dx < sel.w; dx++) {
              const c = sel.contents[dy * sel.w + dx];
              if (!c) continue;
              const tx = sel.x + dx;
              const ty = sel.y + dy;
              if (tx < 0 || tx >= cfg.width || ty < 0 || ty >= cfg.height)
                continue;
              nextPixels[ty * cfg.width + tx] = c;
            }
          }
        }
        const annotations = [...(v.annotations ?? []), anno];
        return {
          ...prev,
          pages: prev.pages.map((p, i) =>
            i === pi
              ? {
                  ...p,
                  variants: {
                    ...p.variants,
                    [presetId]: {
                      ...v,
                      pixels: nextPixels,
                      annotations,
                    },
                  },
                }
              : p,
          ),
        };
      });
      setSelection(null);
      queueMicrotask(() => pushHistory());
    },
    [selection, setDesign, pushHistory],
  );

  const updateAnnotationText = useCallback(
    (id: string, text: string) => {
      const pi = currentPageRef.current;
      const presetId = resolveActivePresetFor(
        designRef.current,
        activePresetByPageRef.current,
        pi,
      );
      setDesign((prev) => ({
        ...prev,
        pages: prev.pages.map((p, i) => {
          if (i !== pi) return p;
          const v = p.variants[presetId];
          if (!v) return p;
          const annotations = (v.annotations ?? []).map((a) =>
            a.id === id ? { ...a, text } : a,
          );
          return {
            ...p,
            variants: { ...p.variants, [presetId]: { ...v, annotations } },
          };
        }),
      }));
      queueMicrotask(() => pushHistory());
    },
    [setDesign, pushHistory],
  );

  const deleteAnnotation = useCallback(
    (id: string) => {
      const pi = currentPageRef.current;
      const presetId = resolveActivePresetFor(
        designRef.current,
        activePresetByPageRef.current,
        pi,
      );
      setDesign((prev) => ({
        ...prev,
        pages: prev.pages.map((p, i) => {
          if (i !== pi) return p;
          const v = p.variants[presetId];
          if (!v) return p;
          const annotations = (v.annotations ?? []).filter((a) => a.id !== id);
          return {
            ...p,
            variants: { ...p.variants, [presetId]: { ...v, annotations } },
          };
        }),
      }));
      queueMicrotask(() => pushHistory());
    },
    [setDesign, pushHistory],
  );

  // ============ tool/mode/color ============

  const handleSetTool = useCallback(
    (next: Tool) => {
      setSelection((sel) => {
        if (sel?.floating) {
          // commit floating selection on tool switch
          const pi = currentPageRef.current;
          setPages((prev) => {
            const np = prev.slice();
            const target = np[pi].pixels.slice();
            commitSelectionInto(sel, target);
            np[pi] = { ...np[pi], pixels: target };
            queueMicrotask(() => pushHistory(np, pi));
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
    [commitSelectionInto, pushHistory],
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
      // New page inherits the full variant set from the page we're inserting
      // after, so adding a page never silently drops variants the user is
      // designing for. `copy` controls pixel content per variant; the variant
      // shape (which presets exist) is always inherited.
      const insertAt = currentPageRef.current + 1;
      setDesign((prev) => {
        const sourcePage = prev.pages[currentPageRef.current];
        if (!sourcePage) return prev;
        const newVariants: Record<
          string,
          { pixels: (string | null)[]; annotations?: Annotation[] }
        > = {};
        for (const presetId of Object.keys(sourcePage.variants)) {
          const sv = sourcePage.variants[presetId];
          const hw = prev.hardware[presetId];
          if (!sv || !hw) continue;
          newVariants[presetId] = {
            pixels: copy
              ? sv.pixels.slice()
              : new Array(hw.width * hw.height).fill(null),
            // Annotations describe regions of the artwork — carry them along
            // with a copied page so the labels match the inherited pixels.
            ...(copy && sv.annotations && sv.annotations.length > 0
              ? {
                  annotations: sv.annotations.map((a) => ({
                    ...a,
                    id: `anno-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  })),
                }
              : {}),
          };
        }
        const newPage = {
          label: `Page ${prev.pages.length + 1}`,
          variants: newVariants,
        };
        const nextPages = prev.pages.slice();
        nextPages.splice(insertAt, 0, newPage);
        queueMicrotask(() => pushHistory(undefined, insertAt));
        return { ...prev, pages: nextPages };
      });
      // Mirror the same insertion in the per-page active-preset array — new
      // page inherits the source page's active preset.
      setActivePresetByPage((prev) => {
        const next = prev.slice();
        const inherited = prev[currentPageRef.current] ?? DEFAULT_PRESET_ID;
        next.splice(insertAt, 0, inherited);
        return next;
      });
      setCurrentPage(insertAt);
    },
    [setDesign, setActivePresetByPage, setCurrentPage, pushHistory],
  );

  const deletePage = useCallback(
    (idx: number) => {
      setDesign((prev) => {
        if (prev.pages.length <= 1) return prev;
        const nextPages = prev.pages.slice();
        nextPages.splice(idx, 1);
        const nextCurrent = Math.min(currentPageRef.current, nextPages.length - 1);
        queueMicrotask(() => pushHistory(undefined, nextCurrent));
        if (currentPageRef.current >= nextPages.length) {
          setCurrentPage(nextPages.length - 1);
        }
        return { ...prev, pages: nextPages };
      });
      setActivePresetByPage((prev) => {
        const next = prev.slice();
        next.splice(idx, 1);
        return next;
      });
    },
    [setDesign, setActivePresetByPage, setCurrentPage, pushHistory],
  );

  const movePage = useCallback(
    (from: number, to: number) => {
      const len = designRef.current.pages.length;
      if (from === to) return;
      if (from < 0 || from >= len) return;
      if (to < 0 || to >= len) return;

      // Keep the currently-edited page tracking through the move. If the page
      // being moved is the active one, follow it to its new slot; otherwise
      // adjust the active index by the shift the move induces.
      const cur = currentPageRef.current;
      let nextCurrent = cur;
      if (cur === from) nextCurrent = to;
      else if (from < cur && to >= cur) nextCurrent = cur - 1;
      else if (from > cur && to <= cur) nextCurrent = cur + 1;

      setDesign((prev) => {
        const nextPages = prev.pages.slice();
        const [moved] = nextPages.splice(from, 1);
        if (!moved) return prev;
        nextPages.splice(to, 0, moved);
        return { ...prev, pages: nextPages };
      });
      setActivePresetByPage((prev) => {
        const next = prev.slice();
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved ?? DEFAULT_PRESET_ID);
        return next;
      });
      if (nextCurrent !== cur) setCurrentPage(nextCurrent);
      queueMicrotask(() => pushHistory(undefined, nextCurrent));
    },
    [setDesign, setActivePresetByPage, setCurrentPage, pushHistory],
  );

  /** Remove only one variant from one page, leaving the page (and any other
   *  variants on it) in place. */
  const deletePageVariant = useCallback(
    (pageIdx: number, presetId: string) => {
      setDesign((prev) => ({
        ...prev,
        pages: prev.pages.map((p, i) => {
          if (i !== pageIdx) return p;
          const { [presetId]: _dropped, ...remaining } = p.variants;
          return { ...p, variants: remaining };
        }),
      }));
      queueMicrotask(() => pushHistory());
    },
    [setDesign, pushHistory],
  );

  const renamePage = useCallback((idx: number, label: string) => {
    setPages((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], label };
      return next;
    });
  }, []);

  /** Patch a page's metadata (title/description/duration/fadeInTime).
   *  `undefined` clears the field. Only keys present in the patch object
   *  are touched — pass `{ duration: 3000 }` to set just that one. */
  const setPageMeta = useCallback(
    (idx: number, patch: PageMetaPatch) => {
      setDesign((prev) => ({
        ...prev,
        pages: prev.pages.map((p, i) =>
          i === idx
            ? {
                ...p,
                ...("title" in patch ? { title: patch.title } : {}),
                ...("description" in patch
                  ? { description: patch.description }
                  : {}),
                ...("duration" in patch ? { duration: patch.duration } : {}),
                ...("fadeInTime" in patch
                  ? { fadeInTime: patch.fadeInTime }
                  : {}),
              }
            : p,
        ),
      }));
      queueMicrotask(() => pushHistory());
    },
    [setDesign, pushHistory],
  );

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
      const resolved = spritePixelsByKey(spriteSets, symbol);
      if (!resolved) return null;
      const points = spritePointsAt(
        resolved.pixels,
        resolved.size,
        c.x,
        c.y,
        resolved.colorful,
      );
      return {
        points: points.map((p) => ({
          x: p.x,
          y: p.y,
          color: p.color ?? color,
          ghost: true,
        })),
      };
    },
    [symbol, color, spriteSets],
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
          const resolved = spritePixelsByKey(spriteSets, symbol);
          if (resolved) {
            const pts = spritePointsAt(
              resolved.pixels,
              resolved.size,
              end.x,
              end.y,
              resolved.colorful,
            );
            writePixels((px) => {
              for (const p of pts) {
                if (
                  p.x < 0 ||
                  p.x >= config.width ||
                  p.y < 0 ||
                  p.y >= config.height
                )
                  continue;
                px[p.y * config.width + p.x] = p.color ?? color;
              }
            });
          }
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
    spriteSets,
    symbol,
    text,
    tool,
    writePixels,
  ]);

  // ============ header actions ============

  const handleClear = useCallback(() => {
    setSelection(null);
    // Clear annotations on the current page's active variant first. setDesign's
    // updater syncs designRef.current synchronously, so the pushHistory that
    // writePixels schedules picks up the annotation-cleared design AND the
    // pixel-cleared pages in a single snapshot — one undo step restores both.
    const pi = currentPageRef.current;
    const presetId = resolveActivePresetFor(
      designRef.current,
      activePresetByPageRef.current,
      pi,
    );
    setDesign((prev) => ({
      ...prev,
      pages: prev.pages.map((p, i) => {
        if (i !== pi) return p;
        const v = p.variants[presetId];
        if (!v || !v.annotations || v.annotations.length === 0) return p;
        return {
          ...p,
          variants: { ...p.variants, [presetId]: { ...v, annotations: [] } },
        };
      }),
    }));
    writePixels((px) => {
      px.fill(null);
    });
  }, [setDesign, writePixels]);

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
        setMode((m) => {
          // Cycle pixel → led → mask (when available) → pixel. With mask
          // unavailable (display isn't 8×8) the cycle reduces to pixel ↔ led.
          if (m === "pixel") return "led";
          if (m === "led") return maskAvailable ? "mask" : "pixel";
          return "pixel";
        });
      else if (k === "x") setColor("#000000");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, maskAvailable, redo, undo, handleSetTool, commitSelection, pushHistory]);

  // ============ variants ============

  const handleAddVariant = useCallback(
    (
      pageIdx: number,
      targetPresetId: string,
      init: AddVariantInit,
      applyToAll: boolean,
    ) => {
      const baseDesign = designRef.current;
      // Source for the copy is whichever variant the user is currently
      // looking at on the page where they clicked "+ Add".
      const sourcePresetId = resolveActivePresetFor(
        baseDesign,
        activePresetByPageRef.current,
        pageIdx,
      );
      const sourceHw = baseDesign.hardware[sourcePresetId];

      // Resolve target hardware up-front (same logic for single-page and bulk).
      const existingTargetHw = baseDesign.hardware[targetPresetId];
      const preset = HARDWARE_PRESETS.find((p) => p.id === targetPresetId);
      const targetHw: Hardware | null =
        existingTargetHw ??
        (preset && sourceHw
          ? {
              presetId: preset.id,
              width: preset.width,
              height: preset.height,
              origin: sourceHw.origin,
              axis: sourceHw.axis,
              serpentine: sourceHw.serpentine,
              letterMask: "",
            }
          : null);
      if (!targetHw || !sourceHw) return;

      // Pure pre-computation: figure out which pages succeed and which skip.
      // Doing this outside setDesign keeps the updater free of side-effects
      // (important for React strict-mode double-invocation).
      const targetIndices = applyToAll
        ? baseDesign.pages.map((_, i) => i)
        : [pageIdx];
      const newPixelsByPage = new Map<number, (string | null)[]>();
      const skippedDetails: AddVariantResult["skippedDetails"] = [];
      let skippedAlreadyHad = 0;
      let skippedNoSource = 0;
      let skippedTooBig = 0;

      for (const i of targetIndices) {
        const p = baseDesign.pages[i];
        if (!p) continue;
        if (p.variants[targetPresetId]) {
          skippedAlreadyHad++;
          skippedDetails.push({
            pageIdx: i,
            pageLabel: p.label,
            reason: `already had ${targetHw.width}×${targetHw.height} variant`,
          });
          continue;
        }
        if (init === "blank") {
          newPixelsByPage.set(
            i,
            new Array(targetHw.width * targetHw.height).fill(null),
          );
          continue;
        }
        const sourceVariant = p.variants[sourcePresetId];
        if (!sourceVariant) {
          skippedNoSource++;
          skippedDetails.push({
            pageIdx: i,
            pageLabel: p.label,
            reason: `no ${sourceHw.width}×${sourceHw.height} source variant`,
          });
          continue;
        }
        const src: VariantSource = {
          width: sourceHw.width,
          height: sourceHw.height,
          pixels: sourceVariant.pixels,
        };
        const fn = init === "scale" ? scaleVariant : centerVariant;
        const newPixels = fn(src, {
          width: targetHw.width,
          height: targetHw.height,
        });
        if (!newPixels) {
          skippedTooBig++;
          skippedDetails.push({
            pageIdx: i,
            pageLabel: p.label,
            reason: `source ${sourceHw.width}×${sourceHw.height} doesn't fit in ${targetHw.width}×${targetHw.height}`,
          });
          continue;
        }
        newPixelsByPage.set(i, newPixels);
      }

      const created = newPixelsByPage.size;
      if (created > 0) {
        setDesign((prev) => ({
          ...prev,
          hardware: { ...prev.hardware, [targetPresetId]: targetHw },
          pages: prev.pages.map((p, i) =>
            newPixelsByPage.has(i)
              ? {
                  ...p,
                  variants: {
                    ...p.variants,
                    [targetPresetId]: {
                      pixels: newPixelsByPage.get(i)!,
                    },
                  },
                }
              : p,
          ),
        }));
        // For each page that just got a new variant, switch its active
        // preset to the new one so the canvas reflects what was created.
        setActivePresetByPage((prev) => {
          const next = prev.slice();
          for (const i of newPixelsByPage.keys()) {
            next[i] = targetPresetId;
          }
          return next;
        });
        queueMicrotask(() => pushHistory());
      }

      // Bulk apply always shows a summary so the user sees what happened.
      // Single-page apply closes immediately if it worked, otherwise reports.
      const anySkipped =
        skippedAlreadyHad + skippedNoSource + skippedTooBig > 0;
      if (applyToAll || (anySkipped && created === 0)) {
        setAddVariantResult({
          created,
          skippedAlreadyHad,
          skippedNoSource,
          skippedTooBig,
          skippedDetails,
        });
      } else {
        setAddVariantFor(null);
      }
    },
    [setDesign, setActivePresetByPage, pushHistory],
  );

  // ============ design adoption helpers ============
  // Declared up here (rather than alongside the rest of the library handlers
  // further down) because handleImport needs to call them.

  /** Drop a fresh Design into the editor: reset pixel buffer, per-page active
   *  variants, current page, selection, history. Shared by Open / New /
   *  Import so all code paths leave the editor in a known state. */
  const adoptDesign = useCallback(
    (next: Design) => {
      setDesign(cloneDesign(next));
      const presetByPage = next.pages.map((p) => {
        const ordered = presetIdsInOrder(Object.keys(p.variants));
        return ordered[0] ?? DEFAULT_PRESET_ID;
      });
      setActivePresetByPage(
        presetByPage.length > 0 ? presetByPage : [DEFAULT_PRESET_ID],
      );
      setCurrentPage(0);
      setSelection(null);
      setColor(getDefaultColor(next.colorMode));
      setHistory([{ design: cloneDesign(next), activePage: 0 }]);
      setHistoryIndex(0);
    },
    [setDesign, setActivePresetByPage, setCurrentPage],
  );

  /** Before switching away from the current design, make sure its latest edits
   *  are flushed to its library slot. Otherwise the debounced autosave could
   *  land in the wrong slot after the switch. */
  const flushAutosaveSync = useCallback(() => {
    const lib = libraryRef.current;
    if (!lib) return;
    const flushed = autosave(lib, designRef.current);
    libraryRef.current = flushed;
    _setLibraryBase(flushed);
  }, []);

  // ============ shared-link autoload ============
  // If the page was opened with #d=<payload>, decode the design and add it to
  // the library as a new entry. Runs once on mount, after the library has
  // hydrated (libraryRef is set synchronously in the mount effect above, so
  // it's already populated by the time this effect's callback runs).
  useEffect(() => {
    const payload = parseShareHash(window.location.hash);
    if (!payload) return;
    let cancelled = false;
    (async () => {
      const decoded = await decodeDesign(payload);
      if (cancelled || !decoded || !libraryRef.current) return;
      // Strip the hash so a reload doesn't re-import (and so the URL bar
      // stops showing a 6 KB blob the moment we've consumed it).
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
      const next = importIntoLibrary(
        libraryRef.current,
        decoded,
        "Shared design",
      );
      libraryRef.current = next;
      _setLibraryBase(next);
      adoptDesign(next.designs[next.currentId].data);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============ JSON import ============
  // (Export lives in ExportModal; this side covers paste-and-import only.)

  const handleImport = useCallback(() => {
    try {
      const result = parseImport(jsonValue, design);
      // Add the imported design as a new library entry rather than
      // replacing the current one. The user can switch back via Open… if
      // the import wasn't what they wanted, and we keep their current
      // work intact regardless.
      flushAutosaveSync();
      const lib = libraryRef.current;
      if (!lib) return;
      const next = importIntoLibrary(lib, result.design, "Imported design");
      libraryRef.current = next;
      _setLibraryBase(next);
      adoptDesign(next.designs[next.currentId].data);
      setImportError(null);
      setImportOpen(false);
      setJsonValue("");
    } catch (err) {
      setImportError(`Import error: ${(err as Error).message}`);
    }
  }, [jsonValue, design, flushAutosaveSync, adoptDesign]);

  // ============ image import ============

  const handleImageImport = useCallback(
    async (file: File) => {
      const currentDesign = designRef.current;
      const presetId = activePresetByPageRef.current[currentPageRef.current];
      const hw = currentDesign.hardware[presetId];
      if (!hw) {
        setImportError("Active hardware variant is missing — cannot import.");
        return;
      }
      let frames;
      try {
        frames = await importImageForHardware(file, hw.width, hw.height);
      } catch (err) {
        setImportError(`Image import error: ${(err as Error).message}`);
        return;
      }
      if (frames.length === 0) {
        setImportError("Image had no frames.");
        return;
      }
      const insertAt = currentPageRef.current + 1;
      setDesign((prev) => {
        const newPages = frames.map((f) => ({
          label: f.label,
          ...(f.durationMs !== undefined ? { duration: f.durationMs } : {}),
          variants: {
            [presetId]: { pixels: f.pixels.slice() },
          },
        }));
        const nextPages = prev.pages.slice();
        nextPages.splice(insertAt, 0, ...newPages);
        queueMicrotask(() => pushHistory(undefined, insertAt));
        return { ...prev, pages: nextPages };
      });
      setActivePresetByPage((prev) => {
        const next = prev.slice();
        next.splice(insertAt, 0, ...frames.map(() => presetId));
        return next;
      });
      // Focus on the first newly-inserted page — for a GIF that means the
      // user lands on frame 1 of the animation rather than the last frame.
      setCurrentPage(insertAt);
      setImportError(null);
      setImportOpen(false);
    },
    [setDesign, setActivePresetByPage, setCurrentPage, pushHistory],
  );

  // ============ config save ============

  const handleConfigSave = useCallback(
    (next: Config) => {
      // setConfig already routes through applyConfigToDesign — that handles
      // colorMode, the active preset's hardware entry, and pixel-buffer
      // resizing for every page in one pass. We just need to deal with the
      // side effects (palette swap, mode reset, history reset, persist).
      setConfig(next);
      const pal = COLOR_MODES[next.colorMode]?.palette ?? [];
      const norm = (c: string) => c.toLowerCase();
      if (!pal.map(norm).includes(norm(color))) {
        setColor(getDefaultColor(next.colorMode));
      }
      setSelection(null);
      // Persist + reset history once the design state has settled. The
      // debounced autosave effect would catch this too, but config changes
      // are deliberate "save points" — flushing immediately avoids a
      // 500ms window where a tab close could lose the new config.
      queueMicrotask(() => {
        const latest = designRef.current;
        setLibrary((lib) => autosave(lib, latest));
        setHistory([
          {
            design: cloneDesign(latest),
            activePage: 0,
          },
        ]);
        setHistoryIndex(0);
      });
      setCurrentPage((c) => Math.min(c, designRef.current.pages.length - 1));
      if (!isMaskAvailable(next) && mode === "mask") setMode("pixel");
      setConfigOpen(false);
    },
    [setConfig, setCurrentPage, setLibrary, color, mode],
  );

  // ============ design library handlers ============

  const handleNewDesign = useCallback(() => {
    if (!libraryRef.current) return;
    flushAutosaveSync();
    setLibrary((lib) => newDesign(lib));
    adoptDesign(DEFAULT_DESIGN);
  }, [flushAutosaveSync, setLibrary, adoptDesign]);

  const handleSaveAs = useCallback(
    (name: string) => {
      if (!libraryRef.current) return;
      flushAutosaveSync();
      setLibrary((lib) => saveAs(lib, name, designRef.current));
      setSaveAsOpen(false);
    },
    [flushAutosaveSync, setLibrary],
  );

  const handleOpenDesign = useCallback(
    (id: string) => {
      const lib = libraryRef.current;
      if (!lib || !lib.designs[id]) return;
      flushAutosaveSync();
      const opened = openDesign(libraryRef.current!, id);
      libraryRef.current = opened;
      _setLibraryBase(opened);
      adoptDesign(opened.designs[id].data);
    },
    [flushAutosaveSync, adoptDesign],
  );

  const handleRenameDesign = useCallback(
    (name: string) => {
      const lib = libraryRef.current;
      if (!lib) return;
      setLibrary((l) => renameDesign(l, l.currentId, name));
      setRenameOpen(false);
    },
    [setLibrary],
  );

  const handleDeleteDesign = useCallback(() => {
    const lib = libraryRef.current;
    if (!lib) return;
    const deletedId = lib.currentId;
    const next = deleteDesign(lib, deletedId);
    libraryRef.current = next;
    _setLibraryBase(next);
    // After deletion, currentId falls back to scratch. Adopt that design.
    adoptDesign(next.designs[next.currentId].data);
    setDeleteDesignOpen(false);
  }, [adoptDesign]);

  /** From the Open modal — delete a design without necessarily switching to
   *  it. Distinct from handleDeleteDesign which always targets currentId. */
  const handleDeleteFromList = useCallback(
    (id: string) => {
      const lib = libraryRef.current;
      if (!lib) return;
      const next = deleteDesign(lib, id);
      libraryRef.current = next;
      _setLibraryBase(next);
      // If we just deleted the design we were editing, adopt the new current.
      if (id === lib.currentId) {
        adoptDesign(next.designs[next.currentId].data);
      }
    },
    [adoptDesign],
  );

  // ============ palette library handlers ============

  const handleSavePalette = useCallback(
    (name: string) => {
      if (!paletteLibraryRef.current) return;
      const { library: nextLib, id } = savePaletteRecord(
        paletteLibraryRef.current,
        name,
        palette,
      );
      paletteLibraryRef.current = nextLib;
      _setPaletteLibraryBase(nextLib);
      setPaletteSource(`custom:${id}`);
      setSavePaletteOpen(false);
    },
    [palette],
  );

  const handleRenamePalette = useCallback(
    (name: string) => {
      if (!paletteLibraryRef.current) return;
      if (!paletteSource.startsWith("custom:")) return;
      const id = paletteSource.slice("custom:".length);
      setPaletteLibrary((lib) => renamePaletteRecord(lib, id, name));
      setRenamePaletteOpen(false);
    },
    [paletteSource, setPaletteLibrary],
  );

  const handleDeletePalette = useCallback(() => {
    if (!paletteLibraryRef.current) return;
    if (!paletteSource.startsWith("custom:")) return;
    const id = paletteSource.slice("custom:".length);
    setPaletteLibrary((lib) => deletePaletteRecord(lib, id));
    setPaletteSource("default");
    setDeletePaletteOpen(false);
  }, [paletteSource, setPaletteLibrary]);

  // ============ derived UI ============

  const stCell = hover ? `${hover.x},${hover.y}` : "—";
  const stLed = hover ? computeLedIndex(hover.x, hover.y, config) : "—";
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const headerSlot = useHeaderActionsSlot();
  const currentRecord = library ? getCurrent(library) : null;
  const onScratch = library ? libIsScratch(library) : true;
  const savedDesigns = library ? listDesigns(library) : [];
  const headerActions = (
    <>
      {currentRecord && (
        <>
          <DesignsMenu
            currentName={currentRecord.name}
            isScratch={onScratch}
            onNew={handleNewDesign}
            onSaveAs={() => setSaveAsOpen(true)}
            onOpen={() => setOpenListOpen(true)}
            onRename={() => setRenameOpen(true)}
            onDelete={() => setDeleteDesignOpen(true)}
          />
          <div className="w-px h-5 bg-edge mx-1" />
        </>
      )}
      <div className="flex gap-1.5">
        <IconBtn title="Undo (⌘Z)" disabled={!canUndo} onClick={undo}>
          ↶
        </IconBtn>
        <IconBtn title="Redo (⌘⇧Z)" disabled={!canRedo} onClick={redo}>
          ↷
        </IconBtn>
      </div>
      <div className="w-px h-5 bg-edge mx-1" />
      <VariantPicker
        design={design}
        activePreset={activePreset}
        onChange={setActivePreset}
      />
      <div className="w-px h-5 bg-edge mx-1" />
      <div className="flex gap-1.5">
        <HeaderBtn onClick={handleClear} title="Clear all (⌘⌫)">
          Clear
        </HeaderBtn>
        <HeaderBtn
          onClick={() => {
            setImportError(null);
            setImportOpen(true);
          }}
          title="Import design JSON"
        >
          Import…
        </HeaderBtn>
        <HeaderBtn
          onClick={() => setExportOpen(true)}
          title="Export JSON or PNG"
        >
          Export…
        </HeaderBtn>
        <IconBtn title="Variant settings" onClick={() => setConfigOpen(true)}>
          <svg
            viewBox="0 0 24 24"
            width={16}
            height={16}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26" />
          </svg>
        </IconBtn>
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full min-h-[480px]">
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
              const pageActivePreset = resolveActivePresetFor(
                design,
                activePresetByPage,
                pi,
              );
              const pageConfig = activeConfig(design, pageActivePreset);
              const pageCellSize = computeCellSize(
                pageConfig.width,
                pageConfig.height,
              );
              const pageVariant = design.pages[pi]?.variants[pageActivePreset];
              const pageHasVariant = !!pageVariant;
              const pageAnnotations = pageVariant?.annotations ?? [];
              const pageLabelForPreset =
                HARDWARE_PRESETS.find((p) => p.id === pageActivePreset)?.label ??
                `${pageConfig.width}×${pageConfig.height}`;
              const isDragSource = dragFromIdx === pi;
              const showDropAbove =
                dragFromIdx !== null &&
                dragOverIdx === pi &&
                dragFromIdx !== pi &&
                dragFromIdx !== pi - 1;
              const showDropBelow =
                dragFromIdx !== null &&
                pi === pages.length - 1 &&
                dragOverIdx === pages.length &&
                dragFromIdx !== pi;
              const canReorder = pages.length > 1;
              return (
                <div
                  key={pi}
                  onDragOver={(e) => {
                    if (dragFromIdxRef.current === null) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    const rect = (
                      e.currentTarget as HTMLDivElement
                    ).getBoundingClientRect();
                    const gap =
                      e.clientY - rect.top < rect.height / 2 ? pi : pi + 1;
                    if (gap !== dragOverIdx) setDragOverIdx(gap);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = dragFromIdxRef.current;
                    if (from === null) {
                      setDragFromIdx(null);
                      setDragOverIdx(null);
                      return;
                    }
                    const rect = (
                      e.currentTarget as HTMLDivElement
                    ).getBoundingClientRect();
                    const gap =
                      dragOverIdx ??
                      (e.clientY - rect.top < rect.height / 2 ? pi : pi + 1);
                    const finalIdx = from < gap ? gap - 1 : gap;
                    setDragFromIdx(null);
                    setDragOverIdx(null);
                    if (finalIdx !== from) movePage(from, finalIdx);
                  }}
                  className={`relative flex flex-col gap-2 items-stretch rounded-xl p-1.5 border-2 transition-colors ${
                    isActive
                      ? "border-accent/40 bg-accent/[0.04]"
                      : "border-transparent"
                  } ${isDragSource ? "opacity-40" : ""}`}
                >
                  {showDropAbove && (
                    <div className="absolute -top-2 left-2 right-2 h-0.5 bg-cta rounded-full pointer-events-none" />
                  )}
                  {showDropBelow && (
                    <div className="absolute -bottom-2 left-2 right-2 h-0.5 bg-cta rounded-full pointer-events-none" />
                  )}
                  <div className="flex items-center gap-2 px-1.5">
                    <span
                      draggable={canReorder}
                      onDragStart={(e) => {
                        if (!canReorder) {
                          e.preventDefault();
                          return;
                        }
                        e.dataTransfer.effectAllowed = "move";
                        // Safari/Firefox require data to be set for the drag
                        // to actually fire.
                        e.dataTransfer.setData("text/plain", String(pi));
                        setDragFromIdx(pi);
                      }}
                      onDragEnd={() => {
                        setDragFromIdx(null);
                        setDragOverIdx(null);
                      }}
                      title={
                        canReorder
                          ? "Drag to reorder"
                          : "Add another page to enable reordering"
                      }
                      aria-label="Drag to reorder page"
                      className={`select-none leading-none px-1 text-[14px] ${
                        canReorder
                          ? "cursor-grab active:cursor-grabbing text-fg-faint hover:text-foreground"
                          : "cursor-not-allowed text-line-stronger"
                      }`}
                    >
                      ⋮⋮
                    </span>
                    <span
                      className={`font-mono text-[11px] font-bold min-w-[24px] ${
                        isActive ? "text-accent" : "text-fg-faint"
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
                      aria-label={`Label for page ${pi + 1}`}
                      className="flex-1 bg-transparent border border-transparent text-foreground px-2 py-1 rounded text-xs outline-none hover:border-line-strong focus:bg-sunken focus:border-cta select-text"
                    />
                    <button
                      type="button"
                      onClick={() => movePage(pi, pi - 1)}
                      disabled={pi === 0}
                      title="Move page up"
                      aria-label="Move page up"
                      className="w-6 h-6 rounded text-[10px] leading-none border border-line-strong bg-transparent text-muted cursor-pointer hover:bg-raised hover:text-foreground hover:border-line-stronger disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted disabled:hover:border-line-strong"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => movePage(pi, pi + 1)}
                      disabled={pi === pages.length - 1}
                      title="Move page down"
                      aria-label="Move page down"
                      className="w-6 h-6 rounded text-[10px] leading-none border border-line-strong bg-transparent text-muted cursor-pointer hover:bg-raised hover:text-foreground hover:border-line-stronger disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted disabled:hover:border-line-strong"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetaModalFor(pi)}
                      title="Page metadata"
                      className="w-8 h-8 rounded text-sm leading-none border border-line-strong bg-transparent text-muted cursor-pointer hover:bg-raised hover:text-foreground hover:border-line-stronger"
                    >
                      ⓘ
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletePromptFor(pi)}
                      disabled={
                        pages.length <= 1 &&
                        Object.keys(design.pages[pi]?.variants ?? {}).length <= 1
                      }
                      title="Delete page or variant"
                      className="w-8 h-8 rounded text-sm leading-none border border-line-strong bg-transparent text-muted cursor-pointer hover:bg-danger-soft hover:text-danger hover:border-danger-line disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted disabled:hover:border-line-strong"
                    >
                      ✕
                    </button>
                  </div>
                  {design.pages[pi]?.title && (
                    <div className="px-2 -mt-1 text-[11px] text-fg-2 italic">
                      {design.pages[pi].title}
                    </div>
                  )}
                  <VariantsStrip
                    design={design}
                    pageIdx={pi}
                    activePreset={pageActivePreset}
                    onSelectVariant={(id) => {
                      setActivePresetForPage(pi, id);
                      if (pi !== currentPage) setActivePage(pi);
                    }}
                    onAddClicked={() => setAddVariantFor(pi)}
                  />
                  {pageHasVariant ? (
                    <div
                      onMouseDown={(e) => onMouseDown(e, pi)}
                      onContextMenu={(e) => {
                        if ((e.target as HTMLElement).closest(".pd-grid"))
                          e.preventDefault();
                      }}
                    >
                      <PixelGrid
                        ref={setGridRef(pi)}
                        config={pageConfig}
                        pixels={page.pixels}
                        mode={mode}
                        cellSize={pageCellSize}
                        preview={isActive ? preview : null}
                        selection={isActive ? selection : null}
                        isActive={isActive}
                        annotations={pageAnnotations}
                        showAnnotations={showAnnotations}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-line-stronger rounded-lg bg-sunken/40 px-6 py-8 min-h-[140px]">
                      <div className="text-[12px] text-fg-faint text-center max-w-[280px] leading-[1.5]">
                        No variant for{" "}
                        <span className="font-mono text-fg-2">
                          {pageLabelForPreset}
                        </span>{" "}
                        on this page yet.
                      </div>
                      <button
                        type="button"
                        onClick={() => setAddVariantFor(pi)}
                        className="px-3 py-1.5 rounded text-xs bg-cta text-cta-fg border border-cta font-semibold hover:bg-cta-hover cursor-pointer"
                      >
                        + Add variant for {pageLabelForPreset}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setAddPageOpen(true)}
            className="px-3 py-1.5 rounded text-xs cursor-pointer bg-cta text-cta-fg border border-cta font-semibold hover:bg-cta-hover mt-1"
          >
            + Add page
          </button>

          <div className="font-mono text-[11px] text-fg-faint flex gap-[18px] flex-wrap justify-center">
            <span>
              <b className="text-fg-2 font-medium">Page:</b>{" "}
              {currentPage + 1}/{pages.length}
            </span>
            <span>
              <b className="text-fg-2 font-medium">Cell:</b> {stCell}
            </span>
            <span>
              <b className="text-fg-2 font-medium">LED:</b> {String(stLed)}
            </span>
            <span>
              <b className="text-fg-2 font-medium">Tool:</b> {tool}
            </span>
            <span>
              <b className="text-fg-2 font-medium">Mode:</b> {mode}
            </span>
          </div>
        </section>

        {/* Sidepanel: inline column at lg+, off-canvas drawer below lg. The
            same component renders in both modes — wrapper handles positioning,
            SidePanel keeps its own dimensions and overflow. */}
        <div
          id="designer-side-panel"
          className={`fixed top-14 bottom-0 right-0 z-30 shrink-0 transition-transform duration-200 ease-out lg:static lg:transform-none lg:transition-none ${
            drawerOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
          }`}
        >
          <SidePanel
            mode={mode}
            maskAvailable={maskAvailable}
            onMode={setMode}
            color={color}
            palette={palette}
            paletteSource={paletteSource}
            paletteOptions={paletteOptions}
            onPaletteSource={setPaletteSource}
            onSavePalette={() => setSavePaletteOpen(true)}
            onRenamePalette={() => setRenamePaletteOpen(true)}
            onDeletePalette={() => setDeletePaletteOpen(true)}
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
            spriteSets={spriteSets}
            maxSpriteSize={Math.min(config.width, config.height)}
            annotations={currentAnnotations}
            selection={selection}
            showAnnotations={showAnnotations}
            onShowAnnotations={setShowAnnotations}
            onAddAnnotation={addAnnotationFromSelection}
            onUpdateAnnotation={updateAnnotationText}
            onDeleteAnnotation={deleteAnnotation}
            previewablePages={design.pages}
            previewPresetId={activePreset}
            previewConfig={config}
            openPanels={panelState.open}
            onTogglePanel={togglePanel}
          />
        </div>
      </div>

      {/* Drawer trigger + backdrop, only shown below lg. */}
      <button
        type="button"
        onClick={() => setDrawerOpen((v) => !v)}
        aria-label={drawerOpen ? "Close tools panel" : "Open tools panel"}
        aria-expanded={drawerOpen}
        aria-controls="designer-side-panel"
        className="lg:hidden fixed bottom-4 right-4 z-40 h-12 px-4 rounded-full bg-panel border border-edge text-foreground text-[12px] font-semibold tracking-[0.04em] shadow-[0_4px_16px_rgba(0,0,0,0.4)] hover:border-accent hover:text-accent transition-colors cursor-pointer"
      >
        {drawerOpen ? "Close ✕" : "Tools ▸"}
      </button>
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close tools panel"
          onClick={() => setDrawerOpen(false)}
          className="lg:hidden fixed inset-0 z-20 bg-black/40 cursor-default"
        />
      )}

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
      <AddVariantModal
        open={addVariantFor !== null}
        design={design}
        pageIdx={addVariantFor ?? 0}
        sourcePreset={activePreset}
        result={addVariantResult}
        onClose={() => {
          setAddVariantFor(null);
          setAddVariantResult(null);
        }}
        onAdd={(targetId, init, applyToAll) => {
          if (addVariantFor !== null) {
            handleAddVariant(addVariantFor, targetId, init, applyToAll);
          }
        }}
      />
      <ExportModal
        open={exportOpen}
        design={design}
        designName={currentRecord?.name ?? "Untitled animation"}
        activePage={currentPage}
        activePreset={activePreset}
        mode={mode}
        onClose={() => setExportOpen(false)}
      />
      <ImportModal
        open={importOpen}
        value={jsonValue}
        onValueChange={(v) => {
          setJsonValue(v);
          if (importError) setImportError(null);
        }}
        onImport={handleImport}
        onImageImport={handleImageImport}
        error={importError}
        onClose={() => {
          setImportOpen(false);
          setImportError(null);
        }}
      />
      <PageMetaModal
        open={metaModalFor !== null}
        pageIndex={metaModalFor ?? 0}
        page={metaModalFor !== null ? design.pages[metaModalFor] : undefined}
        onClose={() => setMetaModalFor(null)}
        onSave={(patch) => {
          if (metaModalFor !== null) setPageMeta(metaModalFor, patch);
        }}
      />
      <DeletePageModal
        open={deletePromptFor !== null}
        pageLabel={
          deletePromptFor !== null
            ? (design.pages[deletePromptFor]?.label ?? "")
            : ""
        }
        pageIndex={deletePromptFor ?? 0}
        variantCount={
          deletePromptFor !== null
            ? Object.keys(design.pages[deletePromptFor]?.variants ?? {}).length
            : 0
        }
        activePresetLabel={activePresetLabel}
        canDeleteVariant={
          deletePromptFor !== null &&
          Object.keys(design.pages[deletePromptFor]?.variants ?? {}).length >
            1 &&
          design.pages[deletePromptFor]?.variants[activePreset] !== undefined
        }
        canDeletePage={design.pages.length > 1}
        onClose={() => setDeletePromptFor(null)}
        onDeletePage={() => {
          if (deletePromptFor !== null) deletePage(deletePromptFor);
          setDeletePromptFor(null);
        }}
        onDeleteVariant={() => {
          if (deletePromptFor !== null)
            deletePageVariant(deletePromptFor, activePreset);
          setDeletePromptFor(null);
        }}
      />
      <DesignNameModal
        open={saveAsOpen}
        title="Save as"
        initialValue={
          currentRecord && !onScratch
            ? currentRecord.name
            : library
              ? nextUntitledName(library)
              : "Untitled"
        }
        confirmLabel="Save"
        onClose={() => setSaveAsOpen(false)}
        onConfirm={handleSaveAs}
      />
      <DesignNameModal
        open={renameOpen}
        title="Rename design"
        initialValue={currentRecord?.name ?? ""}
        confirmLabel="Rename"
        onClose={() => setRenameOpen(false)}
        onConfirm={handleRenameDesign}
      />
      <OpenDesignModal
        open={openListOpen}
        designs={savedDesigns}
        currentId={library?.currentId ?? ""}
        onClose={() => setOpenListOpen(false)}
        onOpen={handleOpenDesign}
        onDelete={handleDeleteFromList}
      />
      {deleteDesignOpen && currentRecord && (
        <DeleteDesignConfirm
          name={currentRecord.name}
          onCancel={() => setDeleteDesignOpen(false)}
          onConfirm={handleDeleteDesign}
        />
      )}
      <PaletteNameModal
        open={savePaletteOpen}
        title="Save palette as"
        initialValue={
          paletteLibrary ? nextUntitledPaletteName(paletteLibrary) : "Untitled palette"
        }
        confirmLabel="Save"
        onClose={() => setSavePaletteOpen(false)}
        onConfirm={handleSavePalette}
      />
      <PaletteNameModal
        open={renamePaletteOpen}
        title="Rename palette"
        initialValue={activeCustomPalette?.name ?? ""}
        confirmLabel="Rename"
        onClose={() => setRenamePaletteOpen(false)}
        onConfirm={handleRenamePalette}
      />
      {deletePaletteOpen && activeCustomPalette && (
        <DeletePaletteConfirm
          name={activeCustomPalette.name}
          onCancel={() => setDeletePaletteOpen(false)}
          onConfirm={handleDeletePalette}
        />
      )}
    </div>
  );
}

function DeleteDesignConfirm({
  name,
  onCancel,
  onConfirm,
}: {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell onClose={onCancel} label="Delete design" width={400}>
      <h2 className="m-0 mb-2 text-[13px] font-semibold">Delete design?</h2>
      <p className="text-[12px] text-muted leading-relaxed mb-4">
        Removes{" "}
        <span className="font-mono text-fg-2">&ldquo;{name}&rdquo;</span> from
        your library. You&apos;ll land on the scratch canvas. This can&apos;t
        be undone.
      </p>
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-danger-soft border border-danger-line text-danger font-semibold hover:bg-danger-soft hover:border-danger"
        >
          Delete
        </button>
      </div>
    </ModalShell>
  );
}

function DeletePaletteConfirm({
  name,
  onCancel,
  onConfirm,
}: {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell onClose={onCancel} label="Delete palette" width={400}>
      <h2 className="m-0 mb-2 text-[13px] font-semibold">Delete palette?</h2>
      <p className="text-[12px] text-muted leading-relaxed mb-4">
        Removes{" "}
        <span className="font-mono text-fg-2">&ldquo;{name}&rdquo;</span> from
        your palette library. The swatch grid will switch back to the default
        palette. This can&apos;t be undone.
      </p>
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="px-3 py-1.5 rounded text-xs cursor-pointer bg-danger-soft border border-danger-line text-danger font-semibold hover:bg-danger-soft hover:border-danger"
        >
          Delete
        </button>
      </div>
    </ModalShell>
  );
}

function pointInSel(p: Point, sel: Selection): boolean {
  return p.x >= sel.x && p.x < sel.x + sel.w && p.y >= sel.y && p.y < sel.y + sel.h;
}

function HeaderBtn({
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
      className="px-3 py-1.5 rounded text-xs cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-raised"
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
      className="w-8 h-8 p-0 inline-flex items-center justify-center rounded text-xs cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-raised"
    >
      {children}
    </button>
  );
}
