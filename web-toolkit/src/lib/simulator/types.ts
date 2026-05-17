export type RGB = readonly [number, number, number];

export type DisplayMode = "pixel" | "mask";

export type JoyButton = "up" | "down" | "left" | "right" | "center";

export interface Pin {
  value(): 0 | 1;
}

export interface Joystick {
  readonly up: Pin;
  readonly down: Pin;
  readonly left: Pin;
  readonly right: Pin;
  readonly center: Pin;
  /** Slide-switch pin, mirroring the Pico's `joystick["slide"]` entry. Apps
   *  that need it (flappy, watch) read `joy.slide?.value()`. Attached by the
   *  simulator host after construction. */
  slide?: Pin;
  press(button: JoyButton): void;
  release(button: JoyButton): void;
  isPressed(button: JoyButton): boolean;
  onChange(cb: (button: JoyButton, pressed: boolean) => void): () => void;
}

export interface Slide {
  value(): 0 | 1;
  toggle(): void;
  set(on: boolean): void;
  onChange(cb: (on: boolean) => void): () => void;
}

export interface NeoPixel {
  readonly length: number;
  [index: number]: RGB;
  write(): void;
  fill(color: RGB): void;
}

export type FlushCallback = (buffer: Uint8ClampedArray) => void;

export interface DisplayDims {
  readonly width: number;
  readonly height: number;
}

export interface App {
  readonly NAME: string;
  /** Opt-in: when true the app reads `display` and writes to a NeoPixel
   *  buffer sized for the actual W×H physical display, using
   *  `index = row * width + col` (row 0 = bottom).
   *  When false / unset the app writes to the native 8×8 source buffer and
   *  the simulator scales the result up. Default: false. */
  readonly RESPONSIVE?: boolean;
  /** Args:
   *  - `np` — gameplay buffer. Non-responsive: 64-LED 8×8 source.
   *    Responsive: W×H sized for the actual display.
   *  - `joy` — joystick / slide pins.
   *  - `display` — physical display dimensions. Only meaningful for
   *    responsive apps; others can ignore it.
   *  - `screensNp` — always a 64-LED 8×8 NeoPixel intended for
   *    `screens.init()` (loading_screen, game_over_screen, end_screen).
   *    Non-responsive apps can ignore it (their `np` already serves both).
   *    Responsive apps should pass it to `screens.init` so the shared
   *    loading / game-over UI keeps rendering at the 8×8 scale-up instead
   *    of getting mis-indexed into the W×H buffer. */
  run(
    np: NeoPixel,
    joy: Joystick,
    display?: DisplayDims,
    screensNp?: NeoPixel,
  ): Promise<void>;
}
