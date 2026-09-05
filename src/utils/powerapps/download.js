// Browser download helper — triggers a file download from a Blob.
// Used by the Power Apps Build Hub to deliver generated files.

export function downloadText(filename, content, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  triggerDownload(blob, filename);
}

export function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
  triggerDownload(blob, filename);
}

export function downloadMarkdown(filename, content) {
  downloadText(filename, content, 'text/markdown');
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Keep the link long enough for the browser to register the click,
  // then clean up. Longer timeout for large files.
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}