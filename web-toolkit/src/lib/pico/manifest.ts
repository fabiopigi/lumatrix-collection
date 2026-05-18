/**
 * Pico bundle manifest — produced by web-toolkit/scripts/build-pico-bundle.mjs
 * and served from /pico-bundle/manifest.json. The wizard fetches this once
 * on /flash load.
 */

export interface BundleFile {
  /** Path under /pico-bundle/ on the web server. */
  readonly src: string;
  /** Absolute path on the Pico filesystem. */
  readonly pico: string;
}

export interface BundleApp extends BundleFile {
  readonly id: string;
  readonly name: string;
  /** True if this app is in main.py's canonical launcher order. */
  readonly default: boolean;
}

export interface HardwarePreset {
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

export interface PicoBundleManifest {
  readonly generated_at: string;
  readonly core: readonly BundleFile[];
  readonly data: readonly BundleFile[];
  readonly apps: readonly BundleApp[];
  readonly hardware_presets: readonly HardwarePreset[];
}

export async function fetchManifest(): Promise<PicoBundleManifest> {
  const res = await fetch("/pico-bundle/manifest.json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load Pico bundle manifest (${res.status})`);
  }
  return res.json();
}

export async function fetchBundleFile(src: string): Promise<Uint8Array> {
  const res = await fetch(`/pico-bundle/${src}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load /pico-bundle/${src} (${res.status})`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
