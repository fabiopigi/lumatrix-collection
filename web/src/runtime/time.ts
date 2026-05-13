export function ticks_ms(): number {
  return Math.floor(performance.now());
}

export function ticks_diff(a: number, b: number): number {
  return a - b;
}

export function sleep_ms(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
