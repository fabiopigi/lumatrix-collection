/**
 * Pack a Design into a shareable URL fragment and back out. The encoded shape
 * is `v1:<base64url>` where the base64url decodes to a raw-deflate-compressed
 * UTF-8 JSON.stringify of the Design.
 *
 * - Hash fragment (not query string) so the payload never reaches the server
 *   and never ends up in access logs.
 * - "v1:" prefix is the format version. Future format changes (e.g. swapping
 *   to indexed-palette encoding) bump to v2 etc. and we can keep decoding old
 *   links best-effort.
 * - CompressionStream("deflate-raw") is native in modern browsers — no
 *   pako dependency.
 *
 * Length budget (rule-of-thumb, encoded base64url):
 *   < 2 KB   safe everywhere (SMS, Discord embeds, link previews)
 *   < 6 KB   safe in most chat / email contexts; Chrome handles ~32 KB
 *   > 6 KB   warn the user — link will work in browsers but may break in
 *            chat apps that truncate URLs
 */
import type { Design } from "./types";

export const SHARE_HASH_PREFIX = "d=";
export const SHARE_VERSION = "v1";
export const SHARE_WARN_BYTES = 6_000;

/** Encode a design as the URL payload (no `#d=` prefix — just the value). */
export async function encodeDesign(design: Design): Promise<string> {
  const json = JSON.stringify(design);
  const utf8 = new TextEncoder().encode(json);
  const compressed = await deflateRaw(utf8);
  return `${SHARE_VERSION}:${bytesToBase64url(compressed)}`;
}

/** Decode a URL payload back to a Design. Returns null on any parse or
 *  format error — callers treat that as "this link wasn't a valid share". */
export async function decodeDesign(payload: string): Promise<Design | null> {
  const colon = payload.indexOf(":");
  if (colon < 0) return null;
  const version = payload.slice(0, colon);
  const body = payload.slice(colon + 1);
  if (version !== SHARE_VERSION) return null;
  try {
    const compressed = base64urlToBytes(body);
    const utf8 = await inflateRaw(compressed);
    const json = new TextDecoder().decode(utf8);
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && parsed.version === 4) {
      return parsed as Design;
    }
    return null;
  } catch {
    return null;
  }
}

export interface ShareUrl {
  /** Full absolute URL, e.g. https://example.com/pixel-designer#d=v1:abc */
  url: string;
  /** Byte length of the encoded payload (after `v1:` prefix) — what callers
   *  should display + use to drive the size warning. */
  bytes: number;
  /** True when bytes >= SHARE_WARN_BYTES. */
  oversize: boolean;
}

/** Build the full shareable URL for the current page origin + designer path.
 *  Caller passes `origin` + `pathname` so this is testable without window. */
export async function buildShareUrl(
  design: Design,
  origin: string,
  pathname: string,
): Promise<ShareUrl> {
  const payload = await encodeDesign(design);
  const bytes = new TextEncoder().encode(payload).length;
  return {
    url: `${origin}${pathname}#${SHARE_HASH_PREFIX}${payload}`,
    bytes,
    oversize: bytes >= SHARE_WARN_BYTES,
  };
}

/** Pull the `d=…` value out of a hash fragment. Returns null if absent or
 *  malformed. Accepts both "#d=foo" and "d=foo" — Next router can hand us
 *  either depending on how we read it. */
export function parseShareHash(hash: string | null | undefined): string | null {
  if (!hash) return null;
  const stripped = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!stripped.startsWith(SHARE_HASH_PREFIX)) return null;
  return stripped.slice(SHARE_HASH_PREFIX.length);
}

// =============================================================
// Compression + base64url primitives
// =============================================================

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

function bytesToBase64url(bytes: Uint8Array): string {
  // btoa works on binary strings, so we feed it one char per byte. Chunked
  // to avoid call-stack limits on large buffers (each char is one arg if we
  // use String.fromCharCode(...bytes); chunking keeps it bounded).
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + CHUNK) as unknown as number[],
    );
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  // atob ignores missing padding, so we don't have to re-add it.
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
