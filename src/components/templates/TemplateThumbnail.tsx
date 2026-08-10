import { resolveLayout, type EPPTemplate } from '@epp/layout-engine';

import { createPageBoxMm } from '../../lib/page.js';
import { mmToPx } from '../../lib/units.js';

const THUMBNAIL_ZOOM = 0.16;

function collectImageSlotIds(node: EPPTemplate['rootNode'], into: string[] = []): string[] {
  if (node.type === 'imageSlot') {
    into.push(node.id);
  }
  for (const child of node.children ?? []) {
    collectImageSlotIds(child, into);
  }
  return into;
}

export function TemplateThumbnail({ template }: { template: EPPTemplate }) {
  const pageBox = createPageBoxMm(template.page, template.page.orientation);
  const layout = resolveLayout(template.rootNode, pageBox);
  const imageSlotIds = new Set(collectImageSlotIds(template.rootNode));

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-white shadow-inner"
      style={{
        width: mmToPx(pageBox.w, THUMBNAIL_ZOOM),
        height: mmToPx(pageBox.h, THUMBNAIL_ZOOM),
      }}
    >
      {Array.from(layout.entries())
        .filter(([id]) => id !== template.rootNode.id && imageSlotIds.has(id))
        .map(([id, box]) => (
          <div
            key={id}
            className="absolute border border-slate-300 bg-slate-200"
            style={{
              left: mmToPx(box.x, THUMBNAIL_ZOOM),
              top: mmToPx(box.y, THUMBNAIL_ZOOM),
              width: mmToPx(box.w, THUMBNAIL_ZOOM),
              height: mmToPx(box.h, THUMBNAIL_ZOOM),
            }}
          />
        ))}
    </div>
  );
}

