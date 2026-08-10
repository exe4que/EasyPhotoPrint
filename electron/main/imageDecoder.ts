import { nativeImage } from 'electron';

/** A decoded, in-memory bitmap. Every operation here mirrors Electron's `NativeImage` exactly --
 * the only implementation this contract has to satisfy today (see design.md, Decision 1) -- so
 * `createElectronImageDecoder`'s `decodeFromPath` can return a `NativeImage` directly without any
 * wrapping. */
export interface DecodedImage {
  getSize(): { width: number; height: number };
  resize(options: { width: number; height: number; quality?: 'good' | 'better' | 'best' }): DecodedImage;
  crop(rect: { x: number; y: number; width: number; height: number }): DecodedImage;
  toDataURL(): string;
  toJPEG(quality: number): Buffer;
}

/** The single contract Main-process code uses to decode image bytes -- see the `image-decoding`
 * capability's "Pixel Operations Go Through a Single Decoder Contract" requirement. Decoding from
 * a path is async (the one genuinely I/O-bound, platform-variable step); everything else on
 * `DecodedImage` operates on an already-decoded bitmap and stays synchronous. */
export interface ImageDecoder {
  decodeFromPath(filePath: string): Promise<DecodedImage>;
}

/** A pass-through, not a wrapper: `nativeImage.createFromPath` already returns something that
 * satisfies `DecodedImage`'s shape, so there's no re-encoding or re-implementation here -- PDF,
 * thumbnail, and print-preview output stays byte-for-byte identical to before this contract
 * existed (see the `image-decoding` capability's "Behavior-Preserving Pass-Through" requirement). */
export function createElectronImageDecoder(): ImageDecoder {
  return {
    decodeFromPath: async (filePath) => nativeImage.createFromPath(filePath),
  };
}
