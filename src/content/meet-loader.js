/**
 * Classic content script: manifest v3 cannot inject a module directly, so this
 * one bootstraps the real (module) entry point through a dynamic import.
 * `src/content/*.js` and `src/lib/*.js` are web accessible for that reason.
 */

(async () => {
  try {
    const module = await import(chrome.runtime.getURL('src/content/meet-auto-join.js'));
    module.start();
  } catch (error) {
    console.error('[browser-tool] failed to start the Meet auto join', error);
  }
})();
