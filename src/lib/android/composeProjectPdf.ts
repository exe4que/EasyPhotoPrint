import {
  PDFDocument,
  clip,
  closePath,
  degrees,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  type PDFPage,
} from 'pdf-lib';

import { computeEnvelopeCrop, type BoxMm, type EPPProject } from '@epp/layout-engine';

import { computePagePlacements, type ImagePlacementSpec } from '../../../electron/main/pdf/composeProjectPdf.helpers.js';
import { computeImageRenderRectMm } from '../imageDisplay.js';
import { computePdfImagePlacement } from '../pdfPlacement.js';
import { domainToPdfCoords, mmToPt, mmToPx } from '../units.js';
import { decodeImageFromBlob } from './imageDecode.js';
import { computeCoverDecodeSize } from './thumbnailSize.js';
import { workingStorage } from './workingStorage.js';

const JPEG_QUALITY = 92;

/** Restricts subsequent drawing on `page` to `boxMm` (converted to PDF space) until `unclip` is
 * called -- mirrors Electron's `composeProjectPdf.ts`, which mirrors `PreviewStage.tsx`'s own
 * `overflow-hidden` wrapper per imageSlot/freeformCanvas. */
function clipToDomainBox(page: PDFPage, boxMm: BoxMm, pageHeightMm: number): void {
  const pdfBox = domainToPdfCoords(boxMm, pageHeightMm);
  page.pushOperators(
    pushGraphicsState(),
    moveTo(pdfBox.x, pdfBox.y),
    lineTo(pdfBox.x + pdfBox.width, pdfBox.y),
    lineTo(pdfBox.x + pdfBox.width, pdfBox.y + pdfBox.height),
    lineTo(pdfBox.x, pdfBox.y + pdfBox.height),
    closePath(),
    clip(),
    endPath(),
  );
}

function unclip(page: PDFPage): void {
  page.pushOperators(popGraphicsState());
}

/** Decodes (from IndexedDB working storage, keyed by `spec.asset.storedPath` -- the Android
 * meaning of that field, see design.md Decision 3a), crops (for `envelopeParent`), and draws one
 * placed image. Mirrors Electron's `embedPlacedImage` exactly in placement math; only the
 * decode/crop/resize/encode backend differs (`AndroidDecodedImage` instead of `nativeImage`). */
async function embedPlacedImage(pdfDoc: PDFDocument, page: PDFPage, spec: ImagePlacementSpec, dpi: number, pageHeightMm: number): Promise<void> {
  const slotBox: BoxMm = { x: 0, y: 0, w: spec.boxMm.w, h: spec.boxMm.h };
  const renderRect = computeImageRenderRectMm(spec.asset, slotBox, spec.scalingRule, spec.specificSizeMm, spec.discreteRotationDeg);
  if (renderRect.widthMm <= 0 || renderRect.heightMm <= 0) {
    return;
  }

  const blob = await workingStorage.get(spec.asset.storedPath);
  if (blob == null) {
    return;
  }

  let bitmap = await decodeImageFromBlob(blob);
  const nativeSize = bitmap.getSize();
  if (nativeSize.width <= 0 || nativeSize.height <= 0) {
    return;
  }

  if (spec.scalingRule === 'envelopeParent') {
    const crop = computeEnvelopeCrop(spec.asset, renderRect.widthMm / renderRect.heightMm);
    bitmap = bitmap.crop({
      x: Math.round(crop.left),
      y: Math.round(crop.top),
      width: Math.max(1, Math.round(crop.width)),
      height: Math.max(1, Math.round(crop.height)),
    });
  }

  const croppedSize = bitmap.getSize();
  const minWidthPx = mmToPx(renderRect.widthMm, 1, dpi);
  const minHeightPx = mmToPx(renderRect.heightMm, 1, dpi);
  const decodeSize = computeCoverDecodeSize(croppedSize.width, croppedSize.height, minWidthPx, minHeightPx);
  const resized = bitmap.resize({ width: decodeSize.width, height: decodeSize.height });
  const jpegBytes = await resized.toJPEG(JPEG_QUALITY);
  const pdfImage = await pdfDoc.embedJpg(jpegBytes);

  const placement = computePdfImagePlacement(
    spec.boxMm.x + spec.boxMm.w / 2,
    spec.boxMm.y + spec.boxMm.h / 2,
    pageHeightMm,
    renderRect.widthMm,
    renderRect.heightMm,
    spec.finalRotationDeg,
  );

  page.drawImage(pdfImage, {
    x: placement.xPt,
    y: placement.yPt,
    width: placement.widthPt,
    height: placement.heightPt,
    rotate: degrees(placement.rotateDegrees),
  });
}

/** The Android counterpart to `electron/main/pdf/composeProjectPdf.ts`'s `composeProjectPdf` --
 * same placement math (imported directly, not duplicated, from `composeProjectPdf.helpers.ts`;
 * see design.md, Decision 4 / Non-Goals), decoding/cropping/resizing/encoding images via
 * `imageDecode.ts`'s `OffscreenCanvas`-backed implementation instead of `nativeImage`. Runs
 * entirely in the WebView -- no native PDF/image plugin. Used by both `pdf.export` and
 * `print.document`. */
export async function composeProjectPdf(project: EPPProject): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const imageAssetMap = new Map(project.imagePool.map((asset) => [asset.id, asset]));

  for (const page of project.pages) {
    const { pageBoxMm, dpi, imageSlots, freeformCanvases } = computePagePlacements(project.sheetSize, page, imageAssetMap);
    const pdfPage = pdfDoc.addPage([mmToPt(pageBoxMm.w), mmToPt(pageBoxMm.h)]);
    const pageHeightMm = pageBoxMm.h;

    for (const spec of imageSlots) {
      clipToDomainBox(pdfPage, spec.boxMm, pageHeightMm);
      await embedPlacedImage(pdfDoc, pdfPage, spec, dpi, pageHeightMm);
      unclip(pdfPage);
    }

    for (const canvas of freeformCanvases) {
      clipToDomainBox(pdfPage, canvas.clipBoxMm, pageHeightMm);
      for (const spec of canvas.elements) {
        await embedPlacedImage(pdfDoc, pdfPage, spec, dpi, pageHeightMm);
      }
      unclip(pdfPage);
    }
  }

  return pdfDoc.save();
}
