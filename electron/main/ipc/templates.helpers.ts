import type { EPPTemplate } from '@epp/layout-engine';
import { migrateTemplate } from '@epp/migrations';

export function assertPageConfig(value: Record<string, unknown>): EPPTemplate['page'] {
  const sizePreset = value.sizePreset;
  const orientation = value.orientation;
  const dpi = value.dpi;

  if (
    (sizePreset !== 'A4' &&
      sizePreset !== 'Letter' &&
      sizePreset !== 'Legal' &&
      sizePreset !== '4x6' &&
      sizePreset !== '5x7' &&
      sizePreset !== 'A3' &&
      sizePreset !== 'Custom') ||
    (orientation !== 'portrait' && orientation !== 'landscape') ||
    typeof dpi !== 'number'
  ) {
    throw new Error('Template page config is invalid.');
  }

  const customSizeRaw = value.customSizeMm as Record<string, unknown> | undefined;
  const customSizeMm =
    typeof customSizeRaw === 'object' &&
    customSizeRaw != null &&
    !Array.isArray(customSizeRaw) &&
    typeof customSizeRaw.widthMm === 'number' &&
    typeof customSizeRaw.heightMm === 'number'
      ? { widthMm: customSizeRaw.widthMm, heightMm: customSizeRaw.heightMm }
      : undefined;

  return {
    sizePreset,
    orientation,
    dpi,
    customSizeMm,
  };
}

export function assertLayoutNode(value: Record<string, unknown>): EPPTemplate['rootNode'] {
  const type = value.type;
  const id = value.id;
  if (
    typeof id !== 'string' ||
    (type !== 'grid' &&
      type !== 'horizontal' &&
      type !== 'vertical' &&
      type !== 'imageSlot' &&
      type !== 'freeformCanvas')
  ) {
    throw new Error('Template root node is invalid.');
  }

  return value as unknown as EPPTemplate['rootNode'];
}

export function normalizeTemplateDocument(raw: unknown): EPPTemplate {
  const migrated = migrateTemplate(raw);
  return {
    schemaVersion: migrated.schemaVersion,
    id: migrated.id,
    name: migrated.name,
    createdAt: migrated.createdAt,
    updatedAt: migrated.updatedAt,
    page: assertPageConfig(migrated.page),
    rootNode: assertLayoutNode(migrated.rootNode),
  };
}

export function prepareTemplateForSave(template: EPPTemplate, existing?: EPPTemplate): EPPTemplate {
  const now = new Date().toISOString();
  return {
    ...template,
    name: template.name.trim(),
    createdAt: existing?.createdAt ?? template.createdAt ?? now,
    updatedAt: now,
  };
}

