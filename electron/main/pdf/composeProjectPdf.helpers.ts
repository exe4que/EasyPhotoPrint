import { resolveLayout } from '@epp/layout-engine';
import type {
  BoxMm,
  EPPProjectPage,
  ImageAsset,
  ImageRotationDeg,
  LayoutNode,
  ScalingRule,
  SheetSize,
  SpecificSizeMm,
} from '@epp/layout-engine';

import { createPageBoxMm } from '../../../src/lib/page.js';

/** Same tree walk `PreviewStage.tsx` uses -- walks `.children` regardless of node type, so a
 * freeformCanvas's shadow imageSlot config-holder children (which `resolveLayout` never assigns a
 * box to, since freeform positioning goes through `freeformElements`/`transform` instead) are
 * still found here, purely so their `imageSlotConfig` can be looked up by id. */
export function collectImageSlotNodes(node: LayoutNode): LayoutNode[] {
  const nodes = node.type === 'imageSlot' ? [node] : [];
  for (const child of node.children ?? []) {
    nodes.push(...collectImageSlotNodes(child));
  }
  return nodes;
}

export function collectFreeformCanvasNodes(node: LayoutNode): LayoutNode[] {
  const nodes = node.type === 'freeformCanvas' ? [node] : [];
  for (const child of node.children ?? []) {
    nodes.push(...collectFreeformCanvasNodes(child));
  }
  return nodes;
}

export interface ImagePlacementSpec {
  asset: ImageAsset;
  /** Absolute, page-relative domain-space (mm) box of the slot/element this image is placed in --
   * also the region subsequent drawing must be clipped to. */
  boxMm: BoxMm;
  scalingRule: ScalingRule | undefined;
  specificSizeMm: SpecificSizeMm | undefined;
  /** imageSlot's own discrete pre-fit rotation (undefined for a freeform element -- its rotation
   * is a whole-box rotation applied afterward, not baked into the fit math). */
  discreteRotationDeg: ImageRotationDeg | undefined;
  /** The rotation actually applied to the final placed rect, around its own center: the same
   * discrete angle for an imageSlot, or the freeform element's own continuous transform angle. */
  finalRotationDeg: number;
}

export interface FreeformCanvasPlacements {
  /** The canvas's own padded content area -- every element below is clipped to this one shared
   * region, matching the single `overflow-hidden` wrapper `PreviewStage.tsx` uses per canvas. */
  clipBoxMm: BoxMm;
  elements: ImagePlacementSpec[];
}

export interface PagePlacements {
  pageBoxMm: BoxMm;
  dpi: number;
  imageSlots: ImagePlacementSpec[];
  freeformCanvases: FreeformCanvasPlacements[];
}

/** Pure "what to draw, and where" for one project page -- resolves layout, matches assignments to
 * pool assets, and skips anything that wouldn't actually render (no assignment, a missing asset).
 * Deliberately has no `nativeImage`/`pdf-lib` dependency so it can run in a plain Node test
 * environment; actually decoding/embedding/drawing each spec is `composeProjectPdf.ts`'s job. */
export function computePagePlacements(
  sheetSize: SheetSize,
  page: EPPProjectPage,
  imageAssetMap: Map<string, ImageAsset>,
): PagePlacements {
  const pageBoxMm = createPageBoxMm(sheetSize, page.pageConfig.orientation);
  const layout = resolveLayout(page.rootNode, pageBoxMm);
  const dpi = page.pageConfig.dpi;

  const imageSlotNodes = collectImageSlotNodes(page.rootNode);
  const imageSlotMap = new Map(imageSlotNodes.map((node) => [node.id, node]));

  const imageSlots: ImagePlacementSpec[] = [];
  for (const node of imageSlotNodes) {
    const boxMm = layout.get(node.id);
    const assetId = page.assignments[node.id];
    const asset = assetId ? imageAssetMap.get(assetId) : undefined;
    if (!boxMm || !asset || asset.missing) {
      continue;
    }

    imageSlots.push({
      asset,
      boxMm,
      scalingRule: node.imageSlotConfig?.scalingRule,
      specificSizeMm: node.imageSlotConfig?.specificSizeMm,
      discreteRotationDeg: node.imageSlotConfig?.imageRotationDeg,
      finalRotationDeg: node.imageSlotConfig?.imageRotationDeg ?? 0,
    });
  }

  const freeformCanvases: FreeformCanvasPlacements[] = [];
  for (const canvasNode of collectFreeformCanvasNodes(page.rootNode)) {
    const canvasBoxMm = layout.get(canvasNode.id);
    if (!canvasBoxMm) {
      continue;
    }

    const padding = canvasNode.paddingMm ?? {};
    const clipBoxMm: BoxMm = {
      x: canvasBoxMm.x + (padding.left ?? 0),
      y: canvasBoxMm.y + (padding.top ?? 0),
      w: canvasBoxMm.w - (padding.left ?? 0) - (padding.right ?? 0),
      h: canvasBoxMm.h - (padding.top ?? 0) - (padding.bottom ?? 0),
    };

    const elements: ImagePlacementSpec[] = [];
    for (const element of canvasNode.freeformElements ?? []) {
      const assetId = page.assignments[element.imageNodeId];
      const asset = assetId ? imageAssetMap.get(assetId) : undefined;
      const elementBoxMm = layout.get(element.id);
      if (!asset || asset.missing || !elementBoxMm) {
        continue;
      }

      const imageSlotConfig = imageSlotMap.get(element.imageNodeId)?.imageSlotConfig;
      elements.push({
        asset,
        boxMm: elementBoxMm,
        scalingRule: imageSlotConfig?.scalingRule,
        specificSizeMm: imageSlotConfig?.specificSizeMm,
        discreteRotationDeg: undefined,
        finalRotationDeg: element.transform.rotationDeg,
      });
    }

    freeformCanvases.push({ clipBoxMm, elements });
  }

  return { pageBoxMm, dpi, imageSlots, freeformCanvases };
}
