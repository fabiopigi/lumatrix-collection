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

export interface App {
  readonly NAME: string;
  run(np: NeoPixel, joy: Joystick): Promise<void>;
}
