/**
 * Delay `fn` until `delay` ms have passed without another call.
 * `chrome.storage.sync` has a per-minute write quota, so a keystroke must not
 * become a write.
 */
export function debounce(fn, delay = 300) {
  let timer = null;
  let pendingArgs = null;

  function debounced(...args) {
    pendingArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const args = pendingArgs;
      pendingArgs = null;
      fn(...args);
    }, delay);
  }

  debounced.flush = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    const args = pendingArgs;
    pendingArgs = null;
    fn(...args);
  };

  return debounced;
}
