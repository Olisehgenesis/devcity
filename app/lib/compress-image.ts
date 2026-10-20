const INLINE_LIMIT = 900 * 1024;

function drawJpeg(source: ImageBitmap, maxEdge: number, quality: number) {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare that photo.');
  context.drawImage(source, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('This photo could not be prepared.'));
      else resolve(blob);
    }, 'image/jpeg', quality);
  });
}

export async function prepareChatImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  if (file.size <= INLINE_LIMIT) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This photo could not be read. Try a JPEG or PNG.');
  }

  try {
    let maxEdge = 1600;
    let quality = 0.8;
    let blob = await drawJpeg(bitmap, maxEdge, quality);
    for (let attempt = 0; attempt < 8 && blob.size > INLINE_LIMIT; attempt += 1) {
      if (quality > 0.5) quality = Math.round((quality - 0.1) * 10) / 10;
      else maxEdge = Math.round(maxEdge * 0.75);
      blob = await drawJpeg(bitmap, maxEdge, quality);
    }
    if (blob.size > INLINE_LIMIT) {
      throw new Error('That photo is still too large after compressing. Try a smaller one.');
    }
    const stem = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${stem}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
