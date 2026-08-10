import { describe, expect, it } from 'vitest';

import { migrateProject, migrateTemplate } from './index.js';

describe('migrations', () => {
  it('accepts current template documents', () => {
    expect(
      migrateTemplate({
        schemaVersion: '1.0.0',
        id: 'template-1',
        name: 'Grid 2x2',
        page: { sizePreset: 'A4', orientation: 'portrait', dpi: 300 },
        rootNode: { id: 'root', type: 'grid' },
      }),
    ).toMatchObject({
      schemaVersion: '1.0.0',
      id: 'template-1',
      name: 'Grid 2x2',
    });
  });

  it('accepts current project documents, passing a top-level sheetSize through untouched', () => {
    expect(
      migrateProject({
        schemaVersion: '1.0.0',
        id: 'project-1',
        name: 'Album',
        sheetSize: { sizePreset: 'A3' },
        pages: [],
        imagePool: [],
      }),
    ).toMatchObject({
      schemaVersion: '1.0.0',
      id: 'project-1',
      name: 'Album',
      sheetSize: { sizePreset: 'A3' },
    });
  });

  it('derives sheetSize from the first page for a legacy project with no top-level sheetSize', () => {
    const migrated = migrateProject({
      schemaVersion: '1.0.0',
      id: 'project-1',
      name: 'Album',
      pages: [
        { id: 'page-1', pageConfig: { sizePreset: 'Legal', customSizeMm: undefined, orientation: 'portrait', dpi: 300 } },
        { id: 'page-2', pageConfig: { sizePreset: 'A3', orientation: 'landscape', dpi: 300 } },
      ],
      imagePool: [],
    });

    expect(migrated.sheetSize).toEqual({ sizePreset: 'Legal' });
  });

  it('derives sheetSize from a legacy Custom preset first page, carrying its customSizeMm', () => {
    const migrated = migrateProject({
      schemaVersion: '1.0.0',
      id: 'project-1',
      name: 'Album',
      pages: [{ id: 'page-1', pageConfig: { sizePreset: 'Custom', customSizeMm: { widthMm: 80, heightMm: 120 }, orientation: 'portrait', dpi: 300 } }],
      imagePool: [],
    });

    expect(migrated.sheetSize).toEqual({ sizePreset: 'Custom', customSizeMm: { widthMm: 80, heightMm: 120 } });
  });

  it('falls back to A4 when a legacy project has no pages to derive a sheetSize from', () => {
    const migrated = migrateProject({
      schemaVersion: '1.0.0',
      id: 'project-1',
      name: 'Album',
      pages: [],
      imagePool: [],
    });

    expect(migrated.sheetSize).toEqual({ sizePreset: 'A4' });
  });

  it('rejects unsupported versions', () => {
    expect(() =>
      migrateTemplate({
        schemaVersion: '2.0.0',
        id: 'template-1',
        name: 'Grid 2x2',
        page: {},
        rootNode: {},
      }),
    ).toThrow(/not supported/i);
  });
});

