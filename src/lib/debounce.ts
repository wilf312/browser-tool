/**
 * Delay `fn` until `delay` ms have passed without another call.
 * `chrome.storage.sync` has a per-minute write quota, so a keystroke must not
 * become a write.
 */
export interface Debounced<Args extends unknown[]> {
  (...args: Args): void;
  /** Run a pending call right away (nothing happens when none is pending). */
  flush(): void;
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay = 300,
): Debounced<Args> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Args | null = null;

  function run() {
    const args = pendingArgs;
    pendingArgs = null;
    if (args) fn(...args);
  }

  const debounced = ((...args: Args) => {
    pendingArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      run();
    }, delay);
  }) as Debounced<Args>;

  debounced.flush = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    run();
  };

  return debounced;
}
