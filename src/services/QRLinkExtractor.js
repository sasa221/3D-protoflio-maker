import jsQR from 'jsqr';

// QR links are intentionally extracted only in the browser. The importer
// remains fully local: no CV pages or images are sent to a remote service.
async function readImageData(blob) {
  if (typeof createImageBitmap !== 'function') return null;
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(bitmap.width, bitmap.height)
      : Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    bitmap.close?.();
  }
}

export async function extractQrLinkFromBlob(blob) {
  try {
    const imageData = await readImageData(blob);
    const result = imageData && jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
    const value = String(result?.data || '').trim();
    return /^(?:https?:\/\/|mailto:|tel:)/i.test(value) ? value : '';
  } catch (_) {
    return '';
  }
}

export async function extractQrLinksFromDocxEntries(entries, names) {
  if (typeof Blob === 'undefined' || typeof createImageBitmap !== 'function') return [];
  const links = await Promise.all(names
    .filter(name => /^word\/media\/.*\.(?:png|jpe?g|webp)$/i.test(name))
    .map(async name => extractQrLinkFromBlob(new Blob([entries[name]]))));
  return [...new Set(links.filter(Boolean))];
}

export async function extractQrLinkFromPdfPage(page) {
  if (typeof document === 'undefined') return '';
  try {
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    await page.render({ canvasContext: context, viewport }).promise;
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
    const value = String(result?.data || '').trim();
    return /^(?:https?:\/\/|mailto:|tel:)/i.test(value) ? value : '';
  } catch (_) {
    return '';
  }
}
