# LUMATRIX Pixel Designer — Usage Guide

A pixel-art designer for LED matrix displays, originally written for the ZHAW **LUMATRIX** 8×8 NeoPixel kit but configurable for any matrix size, color mode, and LED-chain layout.

Lives in `web-toolkit/src/app/pixel-designer/` as **LumenDesigner**, a route in the LumenLab Next.js app. Run `cd web-toolkit && npm run dev` and visit [http://localhost:3000/pixel-designer](http://localhost:3000/pixel-designer).

![LUMATRIX Pixel Designer — main view with two pages](docs/images/pixel-designer-basic.png)

---

## Table of Contents

1. [Quick start](#quick-start)
2. [UI tour](#ui-tour)
3. [Drawing tools](#drawing-tools)
4. [Selection](#selection)
5. [Color palette and color modes](#color-palette-and-color-modes)
6. [Text and pixel fonts](#text-and-pixel-fonts)
7. [Symbols](#symbols)
8. [Pages (multi-frame designs)](#pages-multi-frame-designs)
9. [Letter mask mode](#letter-mask-mode)
10. [Matrix configuration](#matrix-configuration)
11. [JSON export & import](#json-export--import)
12. [PNG export](#png-export)
13. [Hardware integration (MicroPython / NeoPixel)](#hardware-integration-micropython--neopixel)
14. [Keyboard shortcuts](#keyboard-shortcuts)
15. [Tips and tricks](#tips-and-tricks)
16. [Troubleshooting](#troubleshooting)

---

## Quick start

1. Start the LumenLab dev server: `cd web-toolkit && npm run dev`.
2. Open [http://localhost:3000/pixel-designer](http://localhost:3000/pixel-designer) in a current Chrome, Safari, or Firefox.
3. Pick a color from the palette on the right.
4. Click and drag on the grid to paint pixels.
5. Hit **Export** in the side panel to dump JSON, or **PNG** in the header for an image.

That's it for the minimum loop. Everything else is convenience: more tools, more pages, more configuration.

---

## UI tour

![Annotated UI overview](docs/images/pixel-designer-basic.png)

- **Header**: title, undo/redo, clear, PNG export, and the **⚙ Config** button.
- **Left column**: drawing tools (pencil, eraser, fill, eyedropper, line, rect outline/fill, ellipse outline/fill, selection, text).
- **Canvas area** (center): one or more page grids stacked vertically with their labels above them. The active page has a cyan border. Status bar below shows hovered cell, LED index, active tool, page index, and mode.
- **Side panel** (right): mode toggle, color picker + palette, font/text input, symbols, and the JSON I/O area with a shortcuts cheat sheet at the bottom.

---

## Drawing tools

The tool strip on the left:

| Icon | Tool | Shortcut | Behavior |
|------|------|----------|----------|
| ✏    | **Pencil** | `P` | Click/drag to paint pixels in the current color. Drag draws a continuous line through cells the cursor passes over. |
| ⌫    | **Eraser** | `E` | Click/drag to clear pixels (set to off). |
| 🪣    | **Fill bucket** | `F` | Flood-fills the connected region of the same state with the current color. |
| 💧   | **Eyedropper** | `I` | Click a lit pixel to set the current color to its color. Clicking unlit pixels does nothing. |
| ╱    | **Line** | `L` | Click and drag to draw a Bresenham line between two cells. Preview updates while dragging. |
| ▢    | **Rectangle outline** | `R` | Drag to draw the outline of a rectangle. |
| ▣    | **Rectangle filled** | `Shift+R` | Drag to draw a filled rectangle. |
| ○    | **Ellipse outline** | `O` | Drag to draw an ellipse outline. |
| ●    | **Ellipse filled** | `Shift+O` | Drag to draw a filled ellipse. |
| ⛶    | **Selection** | `S` | Drag to define a selection rectangle. See [Selection](#selection). |
| T    | **Text** | `T` | Stamp typed text onto the canvas. See [Text](#text-and-pixel-fonts). |

Drawing always operates on the **active page** (the one with the cyan border). Clicking on a different page's grid makes it active and starts a drag in one motion.

### Shape tools and previews

For line / rect / ellipse, the cells you're about to paint show as a live preview while you drag — release the mouse to commit. Shapes are confined to the grid (no out-of-bounds artifacts).

---

## Selection

The selection tool is the most powerful editing primitive.

**Creating a selection**

- Pick the **⛶** tool (`S`).
- Click and drag to define a rectangle. On release, the pixels inside the rectangle are **cut** from the grid and start floating inside the selection (you'll see the dashed marching border).

**Moving the floating selection**

- Click and drag inside the selection to move it.
- Or use the **arrow keys** (`← ↑ → ↓`) to nudge by one cell at a time.

**Committing**

- Press **Enter** or **Esc**, switch to a different tool, or click outside the selection — the floating pixels are pasted at the current position and the selection clears.

**Dropping (discarding the floating pixels)**

- Press **Delete** / **Backspace** — the selection's contents are thrown away (effectively erasing the selected area).

**Copying instead of cutting**

- Hold **Alt** while creating the selection. The original pixels remain in place; the selection floats above as a copy.

The selection only exists on the active page. Switching pages commits the current selection automatically.

---

## Color palette and color modes

### Picking a color

- **Click any swatch** in the palette to select that color.
- **Click the small color square** next to the hex field to open the native browser color picker for custom hex values.
- **Type a hex value** directly into the `#RRGGBB` text field (the swatches auto-highlight if your hex matches a palette entry).

The palette is always **8 columns wide** so all swatches keep a consistent size regardless of how many colors the active color mode provides.

### Color modes (configured in ⚙)

| Mode | What it is | Use case |
|------|------------|----------|
| **RGB (full color)** | 32-color general palette spanning the full hue/saturation/brightness space. | Default for full-color matrices. |
| **Single white (brightness)** | 16-step grayscale ramp from black to white. | Designs for single-color white matrices. |
| **Single red / green / blue / amber** | 16-step brightness ramp of one channel. | Single-channel matrices. |
| **Red / Green (2-color)** | Fixed palette of R/G at a few brightnesses + black. | Two-channel hardware. |
| **Red / Orange / Green (3-color)** | Status-board palette. | Stoplights, alerts. |
| **Red / Green / Blue (3-color)** | Three primary channels + black/white. | Hardware that can only drive RGB-3 channels independently. |

Changing color mode resets the selected color to the mode's default and rebuilds the palette swatches. Existing pixel colors in the design are kept as-is — but if you want them constrained to the new palette, clear and redraw.

---

## Text and pixel fonts

The **TEXT** section in the side panel:

1. Pick a font: **3×5** (compact) or **5×8** (legible, with lowercase).
2. Type into the **Type to preview…** field. The Text tool becomes active automatically.
3. Hover the grid — a ghost preview shows where the text will land.
4. Click to stamp it at that position (top-left of the first glyph).

### Font coverage

- **3×5**: uppercase A–Z, digits 0–9, `space . , ! ? : - +`. Lowercase falls back to uppercase glyphs.
- **5×8**: uppercase A–Z, lowercase a–z, digits 0–9, `space . , ! ? : - + @ #`. Ascenders (`b d f h k l t`) reach the top; descenders (`g j p q y`) drop below the baseline. Bottom row of each glyph is blank for vertical line spacing.

Glyphs are separated by 1 blank column when rendering multi-character text. The 5×8 font's blank baseline row already handles vertical spacing between lines if you stack text vertically.

### Using the fonts in your own code

`shared/fonts.json` contains both fonts in a machine-readable form (rows of `"X"`/`"."` strings) with embedded usage examples and case-fallback hints. Load it directly in Python/JavaScript/MicroPython to render the same text on hardware that the designer previews on screen.

---

## Symbols

The **SYMBOLS** section has 18 ready-to-stamp shapes laid out in a 6×3 grid:

```
♥  ☺  ★  +  ✕  ✓
↑  ↓  ←  →  ◆  #
●  ○  🔔  △  ☀  ♪
```

Click a symbol button → it becomes selected and the tool switches to **stamp**. Click on the grid to place the symbol at the top-left of that cell. Click another tool (or another symbol) to exit stamp mode.

All symbols are designed to fit within an 8×8 grid; if your matrix is smaller, parts may be clipped.

---

## Pages (multi-frame designs)

![Two pages stacked vertically, "1 2" on top in warm colors and "3 4" below in blues/yellows. The active page has a cyan border.](docs/images/pixel-designer-basic.png)

A page is one frame/screen of your design. Use multiple pages when you want sequential states like:
- A 3-frame animation (page 1 → 2 → 3 in a loop).
- A slideshow: "FIRST", "SHOW", "THIS", "THEN", "THAT".
- A word-clock with multiple time phrases.

### Adding a page

Click the **+ Add page** button below the grid → a small modal asks:

- **Empty page** — adds a blank page after the current one.
- **Copy current** — adds a copy of the current page (great for animations that evolve frame-by-frame).
- **Cancel** — closes the modal without adding.

The new page is inserted directly after the active page and scrolls into view.

### Switching pages

Click anywhere on a page (its grid or its label) to make it active. The active page has a cyan border and tinted background.

### Editing page labels

Click the label text in a page's header and type. Labels are saved with the design in the JSON export. Empty labels fall back to `"Page N"`.

### Deleting a page

Click the **✕** in a page's header. A confirmation dialog appears. The last remaining page cannot be deleted (the **✕** is disabled).

### Page count and order

All pages share the **same matrix configuration** — you cannot mix an 8×8 page with a 16×16 page in the same file. Changing config resets the pixels of every page but preserves page count and labels.

The **status bar** shows `Page: N/M` so you always know where you are.

---

## Letter mask mode

![Same two-page design rendered in mask mode — each cell shows its assigned LUMATRIX word-clock letter; lit cells glow in color, unlit letters are dim grey.](docs/images/pixel-designer-mask.png)

A "letter mask" assigns a letter (or blank) to every LED on the matrix. In **mask mode** the cells render as their letter glyph instead of a colored square. This is the model used by word clocks (e.g., the LUMATRIX 8×8 ships with `FOURNINE / TWELEVEN / SIXTHREE / FIVEIGHT / WTPASTOR / AHALFIVE / HQUARTER / ZATWENTY` so a single lit pattern spells a time).

### Switching modes

In the side panel, toggle **Pixel** ↔ **Letter mask**.

- In **Pixel** mode, cells render as colored squares.
- In **Letter mask** mode, each cell shows its assigned letter (or a small middle-dot `·` if blank). Lit letters glow in their pixel color; unlit letters are dim grey.

Drawing in mask mode still operates per-pixel — clicking a single cell only lights that one cell. The mask is purely visual.

### Defining the mask

Open **⚙ Config** → scroll to **Letter mask**. The textarea takes one character per cell, one line per row, top-to-bottom. Rules:

- Empty space, `.`, or end-of-line → blank cell (renders as middle-dot).
- Each character is uppercased automatically.
- Lines longer than the matrix width have their extras ignored.
- Fewer rows than the matrix height → the missing rows are all blank.

The info line below the textarea shows expected vs actual rows/cols and how many cells will be filled. Two quick buttons:

- **Clear** — empty the textarea (disables mask mode).
- **Use LUMATRIX preset** — fill with the default 8×8 word-clock layout.

If the mask is empty, the **Letter mask** mode toggle is disabled in the side panel.

---

## Matrix configuration

![The Matrix configuration modal — dimensions with quick presets, color mode dropdown, LED indexing controls with a live index preview grid (cell 0 highlighted in cyan), and the letter-mask textarea pre-filled with the LUMATRIX word-clock layout.](docs/images/pixel-designer-settings.png)

The **⚙ Config** button opens a modal with three sections.

### Dimensions

- **Width** and **Height** number inputs (1–64).
- Quick presets: **8×8** (default LUMATRIX), **16×16**, **32×8**, **16×8**, **32×32**.
- Cell size auto-scales — large matrices use smaller cells so the grid fits the canvas area.

Changing dimensions **resets all pixels** (because they'd no longer be addressable correctly). Page count and labels are preserved.

### Color mode

A dropdown of the modes listed under [Color palette](#color-palette-and-color-modes). Changing the mode swaps the palette.

### LED indexing

Three knobs that describe how your physical LED chain is wired:

| Setting | Options | What it means |
|---------|---------|---------------|
| **Origin (LED 0 corner)** | top-left, top-right, bottom-left, bottom-right | Where the chain's index 0 LED is physically located. |
| **Primary axis** | rows (horizontal strips) / columns (vertical strips) | Whether the chain runs row-by-row or column-by-column. |
| **Serpentine** | on / off | Whether each strip alternates direction (zigzag) or all strips run the same way. |

The **Index preview** grid below shows the resulting LED index in every cell, with index `0` highlighted in cyan. Verify by checking that `0` is in the expected corner and that consecutive indices follow the path you expect.

#### Common configurations

| Hardware | Origin | Axis | Serpentine |
|----------|--------|------|------------|
| LUMATRIX 8×8 NeoPixel | bottom-left | row | off |
| Adafruit NeoPixel matrix (row-major) | top-left | row | off |
| WS2812 strip wired snake-pattern starting bottom-right | bottom-right | row | on |
| Wall of vertical LED strips | top-left | column | usually on |

### Persistence

Configuration is saved to `localStorage` under `lumatrix-pixel-designer-config`. It persists across browser sessions on the same machine. **Cancel** discards changes; **Reset to LUMATRIX defaults** repopulates the form with defaults but does not apply them until you click **Save**.

---

## JSON export & import

### Exporting

Click **Export** in the side panel. The JSON appears in the textarea above the button. **Copy** copies it to the clipboard.

### Format (version 3)

```json
{
  "version": 3,
  "config": {
    "width": 8,
    "height": 8,
    "colorMode": "rgb",
    "origin": "bottom-left",
    "axis": "row",
    "serpentine": false,
    "letterMask": "ZATWENTY\nHQUARTER\n…"
  },
  "pages": [
    {
      "label": "Page 1",
      "pixels": [
        { "index": 0, "x": 0, "y": 7, "color": "#ff4000" },
        { "index": 7, "x": 7, "y": 7, "color": "#ff4000" }
      ]
    }
  ],
  "instructions": {
    "purpose": "…",
    "schema": "…",
    "pages_meaning": "…",
    "coordinates": "…",
    "led_indexing": "…",
    "index_formula_pseudocode": "def visual_to_led_index(x, y): …",
    "index_examples_visual_to_chain": { "(0, 0) — top-left corner": 56, … },
    "color_format": "…",
    "color_mode_note": "…",
    "rendering_hint_micropython": "…"
  }
}
```

Notes:

- Only **lit cells** are listed in `pages[i].pixels`. Anything not in the array is OFF (`#000000`).
- Each pixel entry has both `index` (the LED chain position for the configured matrix) and `(x, y)` (visual coordinates, with `y=0` at the top). Use whichever your driver needs.
- The `instructions` block is **regenerated on every export** based on the current config — it always describes how THIS file's indices should be interpreted. Feed the whole JSON to an LLM/agent and it can produce correct driver code without external context.

### Importing

Paste any of these into the textarea and click **Import**:

- A v3 multi-page export (`pages: […]`).
- A v2 single-page export (`pixels: […]` at the top level, with a `config` block).
- A v1 single-page export (just `{ version: 1, size, pixels }`).
- A raw array of pixel objects (`[{ index, color }, …]`).

If the imported config differs from your current one (dimensions, color mode, indexing), you're asked whether to apply it. Choose **OK** to switch your designer to match the imported file, or **Cancel** to import only the pixels onto your current config.

---

## PNG export

![Example PNG export — two pages stacked, each with its "#N Label" header and the grid below with the glow baked in.](docs/images/pixel-designer-png-export.png)

The **PNG** button in the header renders all pages stacked vertically into a single image:

- 2× pixel ratio for a crisp result.
- Each page gets its **title** centered above it (page number in cyan, label in light grey).
- Each grid sits in the same dark rounded wrapper you see in the app.
- Lit pixels include the soft outer **glow** (`shadowBlur` in two passes for the bloomed look).
- In mask mode, letters glow at full intensity and blank cells render as small middle-dots.
- Filename: `pixel-design-{W}x{H}-{N}p.png` (with `-mask` suffix if exported in mask mode).

Use it for sharing on Discord/Slack, embedding in docs, or printing reference sheets.

---

## Hardware integration (MicroPython / NeoPixel)

Below is a minimal MicroPython driver that consumes the JSON export and plays through the pages on a Raspberry Pi Pico + 8×8 NeoPixel matrix.

```python
import json
import time
from machine import Pin
from neopixel import NeoPixel

# Load the design
with open('design.json') as f:
    design = json.load(f)

cfg = design['config']
NUM_LEDS = cfg['width'] * cfg['height']
np = NeoPixel(Pin(19, Pin.OUT), NUM_LEDS)

BRIGHTNESS = 0.25  # NeoPixels are very bright; scale down

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def scale(rgb, k):
    return tuple(int(c * k) for c in rgb)

def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)

def render_page(page):
    clear()
    for p in page['pixels']:
        np[p['index']] = scale(hex_to_rgb(p['color']), BRIGHTNESS)
    np.write()

# Play through pages, 2s each
while True:
    for page in design['pages']:
        render_page(page)
        time.sleep(2)
```

The `instructions` block in the JSON includes a `rendering_hint_micropython` field with this same idea inline — useful when prompting an LLM to write a driver for non-standard hardware.

### Driving the same design through serial

If you have an agent or backend pushing designs to a Pico over USB serial:

1. Send the JSON over the wire.
2. The Pico parses it (`json.loads(line)`).
3. Render each page on demand or step through them on a timer.

The `config.colorMode` lets the device know how to interpret colors — for a single-white display, only the brightness component of each RGB matters; for RGB hardware, send all three channels.

---

## Keyboard shortcuts

### Tools

| Key | Tool |
|-----|------|
| `P` | Pencil |
| `E` | Eraser |
| `F` | Fill bucket |
| `I` | Eyedropper |
| `L` | Line |
| `R` | Rectangle outline |
| `Shift+R` | Rectangle filled |
| `O` | Ellipse outline |
| `Shift+O` | Ellipse filled |
| `S` | Selection |
| `T` | Text (focuses the text input) |
| `X` | Set color to black (quick eraser-color shortcut) |
| `M` | Toggle pixel ↔ mask mode |

### Selection

| Key | Action |
|-----|--------|
| `← ↑ → ↓` | Nudge floating selection 1 cell |
| `Enter` / `Esc` | Commit selection (paste at current pos) and clear |
| `Delete` / `Backspace` | Drop selection contents (erases that area) |

### Editing

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + Backspace` | Clear current page |

While focus is in any text input (label, hex, JSON, text input, etc.), single-key shortcuts are suppressed so you can type freely. **Esc** in any input blurs the field.

---

## Tips and tricks

- **Hold Alt while creating a selection** to duplicate instead of cut — great for repeating a motif across the grid.
- **Use the eyedropper for color matching** when you've drawn over a swatch and want to recover the exact color.
- **Mask mode is your sanity check for word clocks** — switch between pixel and mask views to confirm you're lighting the right cells without having to count LEDs.
- **The PNG export is high-resolution** — pull it into a vector tool, scale up, and you have a poster.
- **Pages can be used as animation frames**. Export, then iterate `pages[]` on hardware with a fixed delay → animation.
- **The JSON `instructions` block is LLM-ready**. Drop the export into ChatGPT/Claude with "write me a MicroPython driver for this design" and you'll get working code, because the formula and indexing rules travel with the file.
- **Custom letter masks unlock new ideas**. Word clock for a different language, a Wordle-style 5×6 grid, a stylized status board with letter cells per zone — all just textarea content.
- **Resize cells with config presets** — the cell size auto-scales so you don't need to zoom your browser for large matrices.
- **Designs can be partially shared via copy-paste of the JSON** — no need to host files; the JSON is self-describing.

---

## Troubleshooting

**The mask mode toggle is greyed out.**
Open ⚙ Config → Letter mask and type at least one letter, or click **Use LUMATRIX preset**.

**Changing dimensions cleared my design.**
That's intentional — pixel addresses change when the grid resizes, so the old design wouldn't map correctly. Export to JSON before changing dimensions if you want to keep it.

**The side panel feels cramped / icons are cut off.**
Widen your browser window. The app is designed for ~900px or wider. The middle (canvas) area shrinks first when space is tight; the side panel stays 340px.

**Colors look different on the LED matrix vs the screen.**
NeoPixels render very brightly at full intensity. Scale all RGB values down to ~20–25% before writing them to the strip (`BRIGHTNESS = 0.25` in the driver above).

**Imported JSON has wrong colors / wrong positions.**
Check that the imported `config` matches your physical hardware. If your driver and the file disagree on `origin`/`axis`/`serpentine`, your indices will be permuted. Either import the config (the prompt offers this) or fix one side.

**`ctx.roundRect is not a function` on PNG export.**
Your browser is too old. `ctx.roundRect` was added across all major browsers in 2022–2023. Update to a current Chrome, Safari, or Firefox.

**Selection won't move.**
You need to drag from inside the dashed rectangle. Click outside it (or press Esc) to commit the current selection first.

**The text I typed in the side panel doesn't appear on the grid.**
The Text tool stamps on **click**. Type in the field → hover the grid to see a ghost preview → click to commit. The text input alone doesn't paint anything.

---

## File overview

```
LumaMatrix/
├── web-toolkit/                # LumenLab Next.js app
│   └── src/
│       ├── app/pixel-designer/ # LumenDesigner route (this tool)
│       ├── app/simulator/      # LumenSimulator route
│       └── lib/pixel-designer/ # designer libs (palette, geometry, fonts, …)
├── shared/
│   └── fonts.json              # both pixel fonts in a machine-readable form
├── docs/
│   ├── pixel-designer-usage.md # this document
│   └── images/                 # screenshots referenced from this doc
├── python/
│   ├── main.py                 # MicroPython launcher flashed to the Pico
│   └── apps/                   # MicroPython app modules (snake, breakout, …)
└── README.md                   # top-level project readme
```

The designer runs entirely client-side: `npm run dev` is only there for Hot Module Reload while you iterate — once built (`npm run build`), the route is a single statically-rendered page.
