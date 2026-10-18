// The native share sheet keeps existing export buttons useful inside WebKit.
let exporting = false;
export async function exportJSON(value, filename) {
  if (exporting) return;
  exporting = true;
  try {
    const native = globalThis.webkit?.messageHandlers?.exportJSON;
    if (globalThis.__MM_NATIVE__ === true && native) {
      if (['medical-mysteries-story-history.json', 'medical-mysteries-learning-journal.json'].includes(filename)) {
        // Stream every committed record natively; no smaller export cap or large
        // JSON round-trip through WebKit can make an accepted history unexportable.
        await native.postMessage({ filename, backup: true });
      } else await native.postMessage({ filename, text: JSON.stringify(typeof value === 'function' ? value() : value, null, 2) });
      return;
    }
    const text = JSON.stringify(typeof value === 'function' ? value() : value, null, 2);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // Exports never remove or replace a saved route.
    globalThis.dispatchEvent?.(new CustomEvent('mm-export-error'));
  } finally { exporting = false; }
}
