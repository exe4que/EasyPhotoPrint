export const SUPPORTED_SCHEMA_VERSIONS = ['1.0.0'] as const;

type SupportedSchemaVersion = (typeof SUPPORTED_SCHEMA_VERSIONS)[number];

export interface MigratedTemplateDocument {
  schemaVersion: SupportedSchemaVersion;
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  page: Record<string, unknown>;
  rootNode: Record<string, unknown>;
}

export interface MigratedProjectDocument {
  schemaVersion: SupportedSchemaVersion;
  id: string;
  name: string;
  sheetSize: Record<string, unknown>;
  pages: Record<string, unknown>[];
  imagePool: Record<string, unknown>[];
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function assertString(record: Record<string, unknown>, key: string, label: string): string {
  if (typeof record[key] !== 'string' || record[key] === '') {
    throw new Error(`${label}.${key} must be a non-empty string.`);
  }

  return record[key] as string;
}

function assertArray(record: Record<string, unknown>, key: string, label: string): Record<string, unknown>[] {
  if (!Array.isArray(record[key])) {
    throw new Error(`${label}.${key} must be an array.`);
  }

  return record[key].map((entry, index) => assertRecord(entry, `${label}.${key}[${index}]`));
}

function assertSupportedVersion(record: Record<string, unknown>, label: string): SupportedSchemaVersion {
  const version = record.schemaVersion;
  if (typeof version !== 'string') {
    throw new Error(`${label}.schemaVersion must be a string.`);
  }

  if (!SUPPORTED_SCHEMA_VERSIONS.includes(version as SupportedSchemaVersion)) {
    throw new Error(`${label}.schemaVersion "${version}" is not supported.`);
  }

  return version as SupportedSchemaVersion;
}

export function migrateTemplate(raw: unknown): MigratedTemplateDocument {
  const record = assertRecord(raw, 'template');
  const schemaVersion = assertSupportedVersion(record, 'template');
  const page = assertRecord(record.page, 'template.page');
  const rootNode = assertRecord(record.rootNode, 'template.rootNode');

  return {
    schemaVersion,
    id: assertString(record, 'id', 'template'),
    name: assertString(record, 'name', 'template'),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
    page,
    rootNode,
  };
}

const DEFAULT_SHEET_SIZE: Record<string, unknown> = { sizePreset: 'A4' };

/** Projects saved before sheet size became document-level carry no top-level `sheetSize` --
 * every page had its own `pageConfig.sizePreset`/`customSizeMm` instead, and the UI never
 * exposed a way to diverge them across pages. For such a file, the first page's size becomes
 * the document's `sheetSize`; any other page's size value is discarded (never reachable
 * downstream once `pageConfig` is narrowed to orientation/dpi only). */
function deriveSheetSize(rawSheetSize: unknown, pages: Record<string, unknown>[]): Record<string, unknown> {
  if (typeof rawSheetSize === 'object' && rawSheetSize != null && !Array.isArray(rawSheetSize)) {
    return rawSheetSize as Record<string, unknown>;
  }

  const firstPageConfig = pages[0]?.pageConfig;
  if (typeof firstPageConfig === 'object' && firstPageConfig != null && !Array.isArray(firstPageConfig)) {
    const { sizePreset, customSizeMm } = firstPageConfig as Record<string, unknown>;
    if (typeof sizePreset === 'string') {
      return customSizeMm !== undefined ? { sizePreset, customSizeMm } : { sizePreset };
    }
  }

  return DEFAULT_SHEET_SIZE;
}

export function migrateProject(raw: unknown): MigratedProjectDocument {
  const record = assertRecord(raw, 'project');
  const schemaVersion = assertSupportedVersion(record, 'project');
  const pages = assertArray(record, 'pages', 'project');

  return {
    schemaVersion,
    id: assertString(record, 'id', 'project'),
    name: assertString(record, 'name', 'project'),
    sheetSize: deriveSheetSize(record.sheetSize, pages),
    pages,
    imagePool: assertArray(record, 'imagePool', 'project'),
  };
}

