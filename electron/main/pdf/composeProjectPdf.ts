import { nativeImage } from 'electron';
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

import { computeImageRenderRectMm } from '../../../src/lib/imageDisplay.js';
import { computePdfImagePlacement } from '../../../src/lib/pdfPlacement.js';
import { domainToPdfCoords, mmToPt, mmToPx } from '../../../src/lib/units.js';
import { computeCoverDecodeSize } from '../ipc/fs.helpers.js';
import { computePagePlacements, type ImagePlacementSpec } from './composeProjectPdf.helpers.js';

const JPEG_QUALITY = 92;

/** Restricts subsequent drawing on `page` to `boxMm` (converted to PDF space) until `unclip` is
 * called -- mirrors the `overflow-hidden` wrapper `PreviewStage.tsx` uses per imageSlot and per
 * freeformCanvas, so an oversized `specificSize` image or a freeform element dragged past its
 * canvas's padding is cut off the same way in PDF/print output as it already is in preview. */
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

/** Decodes, crops (for `envelopeParent`), and draws one placed image -- an unassigned slot or a
 * missing asset never reaches this point (`computePagePlacements` already filtered those out),
 * leaving the page's own blank background, matching print-preview's "renders blank" behavior. */
async function embedPlacedImage(pdfDoc: PDFDocument, page: PDFPage, spec: ImagePlacementSpec, dpi: number, pageHeightMm: number): Promise<void> {
  const slotBox: BoxMm = { x: 0, y: 0, w: spec.boxMm.w, h: spec.boxMm.h };
  const renderRect = computeImageRenderRectMm(spec.asset, slotBox, spec.scalingRule, spec.specificSizeMm, spec.discreteRotationDeg);
  if (renderRect.widthMm <= 0 || renderRect.heightMm <= 0) {
    return;
  }

  let bitmap = nativeImage.createFromPath(spec.asset.storedPath);
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
  const resized = bitmap.resize({ width: decodeSize.width, height: decodeSize.height, quality: 'good' });
  const jpegBytes = resized.toJPEG(JPEG_QUALITY);
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

/** Composes an entire project into a single, multi-page PDF: one page per `project.pages` entry,
 * all sharing the project's single `sheetSize` but each at its own configured orientation, with every placed image drawn directly via
 * `pdf-lib` (no browser rendering pass) using the same pure fit/crop/rotation math print-preview's
 * on-screen rendering already uses. Used by both `pdf:export` (written straight to disk) and
 * `print:document` (written to a temp file and handed to Chromium's built-in PDF viewer). */
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
