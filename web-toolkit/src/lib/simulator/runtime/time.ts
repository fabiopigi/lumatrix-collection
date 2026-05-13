let currentSignal: AbortSignal | null = null;

export function setRuntimeSignal(signal: AbortSignal | null): void {
  currentSignal = signal;
}

export function isAborted(): boolean {
  return currentSignal?.aborted ?? false;
}

export function ticks_ms(): number {
  return Math.floor(performance.now());
}

export function ticks_diff(a: number, b: number): number {
  return a - b;
}

export function sleep_ms(ms: number): Promise<void> {
  const signal = currentSignal;
  if (signal?.aborted) return Promise.reject(makeAbortError());
  if (ms <= 0) {
    return signal?.aborted ? Promise.reject(makeAbortError()) : Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(makeAbortError());
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function makeAbortError(): Error {
  const e = new Error("aborted");
  e.name = "AbortError";
  return e;
}
