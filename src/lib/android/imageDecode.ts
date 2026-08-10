/** A decoded, in-memory bitmap backed by an `OffscreenCanvas` -- the Android counterpart to
 * `electron/main/imageDecoder.ts`'s `DecodedImage`. Shaped closely enough to keep the two
 * implementations easy to compare (same four operations: getSize/resize/crop/encode), but not
 * identical -- decoding starts from a `Blob` (there is no filesystem path to decode from on
 * Android) and encoding is necessarily async, since `OffscreenCanvas` has no synchronous
 * `toDataURL`. See design.md, Decision 4 / Non-Goals. */
export interface AndroidDecodedImage {
  getSize(): { width: number; height: number };
  resize(options: { width: number; height: number }): AndroidDecodedImage;
  crop(rect: { x: number; y: number; width: number; height: number }): AndroidDecodedImage;
  toDataURL(): Promise<string>;
  toJPEG(quality: number): Promise<Uint8Array>;
}

function wrapCanvas(canvas: OffscreenCanvas): AndroidDecodedImage {
  const draw = (targetWidth: number, targetHeight: number, drawFn: (ctx: OffscreenCanvasRenderingContext2D) => void): AndroidDecodedImage => {
    const target = new OffscreenCanvas(Math.max(1, Math.round(targetWidth)), Math.max(1, Math.round(targetHeight)));
    const ctx = target.getContext('2d');
    if (ctx == null) {
      throw new Error('Could not get a 2D rendering context for image decoding.');
    }
    drawFn(ctx);
    return wrapCanvas(target);
  };

  return {
    getSize: () => ({ width: canvas.width, height: canvas.height }),

    resize: ({ width, height }) =>
      draw(width, height, (ctx) => {
        ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height);
      }),

    crop: ({ x, y, width, height }) =>
      draw(width, height, (ctx) => {
        ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height);
      }),

    toDataURL: async () => {
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      return blobToDataUrl(blob);
    },

    toJPEG: async (quality) => {
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: Math.min(1, Math.max(0, quality / 100)) });
      return new Uint8Array(await blob.arrayBuffer());
    },
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob as a data URL.'));
    reader.readAsDataURL(blob);
  });
}

/** Decodes an image's bytes (as already read out of IndexedDB working storage, see
 * `workingStorage.ts`) into an `AndroidDecodedImage`, using `createImageBitmap` -- no native
 * decoding plugin, per this change's design (see design.md, Decision 4). */
export async function decodeImageFromBlob(blob: Blob): Promise<AndroidDecodedImage> {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (ctx == null) {
    throw new Error('Could not get a 2D rendering context for image decoding.');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return wrapCanvas(canvas);
}
