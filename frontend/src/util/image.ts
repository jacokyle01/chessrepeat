// Client-side avatar preparation. Uploading the original photo would be
// wasteful (phone cameras produce 3–10 MB files) and would burn through
// the Storage free quota; a 256px JPEG is ~15 KB and looks identical at
// the sizes we render.

export const AVATAR_SIZE = 256;
// Hard cap on what we'll even try to decode; anything bigger is almost
// certainly not a profile picture.
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function isSupportedImage(file: File): boolean {
  return ACCEPTED.has(file.type) && file.size > 0 && file.size <= MAX_SOURCE_BYTES;
}

// Decodes file, center-crops it to a square, scales to AVATAR_SIZE and
// re-encodes as JPEG. EXIF orientation is honoured by createImageBitmap.
export async function prepareAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unsupported');
    // fill so transparent PNGs don't come out black after JPEG encoding
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))),
        'image/jpeg',
        0.85,
      );
    });
  } finally {
    bitmap.close();
  }
}
