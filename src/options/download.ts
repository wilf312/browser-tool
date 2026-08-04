/** Hand a generated file to the browser's downloader. */

export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Chrome reads the blob after the click returns, so release it one tick later.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
