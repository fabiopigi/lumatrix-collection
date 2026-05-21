# Collapsible side panels (and preview in the sidebar)

**Status:** raw idea
**Tags:** web-toolkit, lumen-designer, ux, sidebar, layout

## What

Turn LumenDesigner's right-hand `Section`s into **collapsible panels** — each section's header is a click target that toggles its body open/closed — and move the **Play preview** out of its floating draggable window into a new panel in the same sidebar. The sidebar becomes a vertical accordion-style stack you can groom to taste; the preview lives alongside the colour, text, symbols, etc., panels instead of overlapping the canvas.

## Why

The right sidebar has grown:

- Mode, Color (now with palette source + actions + swatch grid), Text, Symbols, Annotations, Shortcuts — that's six sections, and the new color palette work pushed Color noticeably taller.
- The Play preview is a floating window over the canvas, which is great when you want to compare preview ↔ artwork side-by-side, but it also means a separate "where did I leave that?" surface, plus drag UX, plus the awkward middle state where it covers something you wanted to see.

Two payoffs from making sections collapsible:

1. **Self-prioritisation.** You're text-heavy today? Collapse Symbols and Color, expand Text. You're tweaking a palette? Collapse everything else. The user reshapes the panel to whatever they're doing instead of scrolling past six full sections.
2. **Room to grow.** Once collapse-by-default is normal, adding new panels (like the preview, like a future layers panel, like keyboard shortcut customization) doesn't cost the user a screenful of scroll.

Folding the Play preview in as a panel also kills the bespoke "floating draggable window" affordance — one less thing to learn, one fewer surface to maintain. The cost is "can't see preview and canvas at the same time on small screens"; on a wide layout the sidebar is always visible anyway, and on narrow layouts the off-canvas drawer is the right home for it.

## Sketch

Two pieces, both small:

**Collapsible Section component.**

The existing `Section` (in `side-panel.tsx`) becomes a `<details>`-like component:

- Header is a button (chevron + title + optional hint).
- Click toggles a local `open` boolean.
- Closed state hides the body and removes the bottom margin / divider line so collapsed sections stack tightly.
- Open/closed is **persisted to localStorage** under a section key (e.g. `lumen-designer:panel-open:color`), so refreshing keeps your layout.
- A small "Expand all / Collapse all" link at the top of the sidebar would be nice quality-of-life — defer if it bloats v1.

Defaults:

- **Open:** Mode, Color, Preview (when there's something to preview).
- **Closed:** Symbols, Annotations, Shortcuts. (Text is in the middle — open seems fine since it's small.)

`<details>` / `<summary>` natively does collapse/expand, but it skips the persistence and the chevron animation we'll want, so probably worth a small custom component. Either way the keyboard contract (Enter / Space on header toggles, focusable header) needs to hold.

**Play preview becomes a panel.**

Today: `PlayPreviewPanel` is mounted as a `position: fixed` draggable window, opened/closed by a header button (`previewOpen` state in `designer.tsx`).

Tomorrow: a new `Section` titled "Preview" inside `side-panel.tsx`. The same animation grid + play/pause + loop/pingpong controls + frame indicator, just embedded. Constraints:

- Sidebar is 340px wide; current preview maxes at ~220px. Comfortably fits with margins, no resizing math needed.
- When there's only one page (or pages don't share the active variant), the section can still be present but show a "Add another page to enable preview" hint — keeps the spot stable so collapsed/open state doesn't shuffle around as pages come and go.
- Drop the drag handle entirely (position is now determined by the panel order).
- Header "Play preview" button can go away, OR become a "scroll to / expand the Preview panel" shortcut. Probably remove it — one less affordance to reason about, and the panel is visible by default.

Panel order (top → bottom) — proposal:

1. Mode
2. Preview ← new
3. Color
4. Text
5. Symbols
6. Annotations
7. Shortcuts

Preview belongs near the top because it's *the* thing you look at while iterating. Putting it above Color also means painting-then-glance is a short eye movement.

A few details:

- The drawer behaviour on `<lg` viewports stays as-is; the same collapsible sections work inside the drawer.
- `previewOpen` state in `designer.tsx` becomes redundant once the panel is always-mounted — it can be replaced by the Preview section's own open/closed state, which is the same shape (collapsed = no playback, expanded = playing).
- Playback should pause automatically when the panel is collapsed — no point ticking a timer rendering frames nobody sees.

Likely storage shape (mirrors the design library / palette library patterns):

```
lumen-designer:panels -> {
  schemaVersion: 1,
  open: {
    mode: true,
    preview: true,
    color: true,
    text: true,
    symbols: false,
    annotations: false,
    shortcuts: false,
  }
}
```

## Open questions

- **Persist or not?** Probably yes; "I closed Symbols once, why is it open again?" is exactly the friction this idea is meant to remove.
- **Schema for the persisted open-state:** key it by section id (stable) rather than title (translation-fragile, refactor-fragile). Add `schemaVersion` from day one.
- **Annotations on collapse:** Annotations section grows with the number of annotations on the current page. Should collapse remember its state per-design or globally? Global is simpler; per-design fits the use case better. Probably global to start.
- **What about the floating window?** Drop it entirely (cleaner), or keep it behind a "pop out" button on the Preview panel (lets people who liked the overlay still use it)? Pop-out is two days of work for an edge case; drop unless someone shouts.
- **Should "Expand all" / "Collapse all" exist?** Quality-of-life win, but adds clutter near the section list. Defer to a follow-up.
- **Keyboard shortcut to toggle Preview?** Currently no shortcut to open the play overlay; the new panel could pick up something like `Shift+P` or just rely on click.
- **Performance:** seven sections, each rendering on every design / palette / annotation change — still trivial, but worth noting that collapsed sections should *unmount* their bodies (not just `display: none`) so the Preview's `setTimeout` loop actually stops.

## Notes

- Today's sidebar: `web-toolkit/src/app/designer/_components/side-panel.tsx`. The `Section` function near the bottom of that file is the single place collapse logic plugs into.
- Today's preview: `web-toolkit/src/app/designer/_components/play-preview-panel.tsx`, mounted from `designer.tsx` near the end of the JSX, triggered by `previewOpen` + the "Play preview" header button. The component itself doesn't need to change much — strip the drag handle and outer `position: fixed` wrapper, keep the grid + controls.
- Related: this idea sets up the shape for any future sidebar panels — a future layers panel, a future "design metadata" panel, or moving Shortcuts to a help modal could all reuse the same collapsible chrome.
- Pairs nicely with [[color-palettes]] — the bigger Color section is part of what motivated this idea, and the persisted-open-state pattern matches the palette / design library localStorage approach.
