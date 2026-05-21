# Share design via URL

**Status:** shipped (PR #16)
**Tags:** web-toolkit, lumen-designer, sharing, ux

## What

Encode a design (config + per-page pixel data) into a shareable URL so opening the link loads the design directly in someone else's browser-based LumenDesigner. No account, no server-side storage, no upload step — just a link.

## Why

Sharing today means JSON-export → send file → recipient imports. That's fine for one-on-one, but it's friction-heavy for the things you actually want to share casually: showing a friend, posting in a chat, embedding in docs, asking for feedback. A URL collapses that to a single action.

Pairs naturally with [[local-design-storage]]: same JSON format, just transported instead of persisted.

## Sketch

The numbers work out easily:

- 8×8 RGB design: ~192 bytes raw.
- 10-frame animation: ~2 KB raw.
- With indexed-palette encoding (palette + nibble-per-pixel for ≤16 colors) + deflate + base64url, typical animated designs fit in **well under 1 KB of URL**.
- Modern browsers handle 8 KB+ URLs comfortably (Chrome ~32 KB).

Likely shape:

- A `#d=<payload>` fragment on a deep-link route (e.g. `/pixel-designer#d=…`) — the `#` keeps the payload client-side and out of server logs.
- "Copy share link" button in the designer. Opens to the design preloaded; recipient can fork into their library if [[local-design-storage]] exists.
- Version byte at the start of the payload so future format changes don't break old links.
- **Fallback for huge designs:** if the encoded payload exceeds a threshold (say 6 KB), offer a "short code" that resolves to a static JSON in the repo / CDN. Out of scope for v1 — the URL-only path covers the vast majority.

## Open questions

- **Encoding:** indexed palette + deflate is the obvious default. Worth benchmarking against straight deflate-of-raw-RGB to confirm it's actually smaller on real designs.
- **Hash fragment vs query string:** `#d=` is private (never sent to server, never logged) but invisible to most link-preview unfurlers. `?d=` is the opposite. Probably `#`.
- **Schema version byte:** how do we communicate "this link is from an old format" — silent best-effort migration, or visible "this design used an older format, results may differ"?
- **Threshold for the fallback path:** at what payload size do we stop trying to fit in the URL and switch to a short code? Tied to the worst browser/messenger/email client we care about — some chat apps truncate at ~2 KB.
- **Privacy:** the design contents live entirely in the URL — fine for sharing, but worth noting links shouldn't go to anywhere that logs full URLs if a design is sensitive (it's hard to imagine a sensitive 8×8, but worth a sentence in docs).
- **Preview image:** can we generate a small PNG thumbnail on the receiving side for `<meta>` OG tags? Probably out of scope without a server.

## Notes

- Reuses LumenDesigner's existing JSON serialization — no new format.
- Related: [[local-design-storage]] (same payload, just stored vs. transported), [[generate-app-from-design]] (a "share runnable app" link is a natural sibling).
