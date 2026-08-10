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

  it('rejects a project with no top-level sheetSize', () => {
    expect(() =>
      migrateProject({
        schemaVersion: '1.0.0',
        id: 'project-1',
        name: 'Album',
        pages: [],
        imagePool: [],
      }),
    ).toThrow(/sheetSize/i);
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

