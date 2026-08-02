import { describe, expect, it } from 'vitest';

import { normalizeTemplateDocument, prepareTemplateForSave } from './templates.helpers.js';

describe('template helpers', () => {
  it('normalizes a persisted template document', () => {
    expect(
      normalizeTemplateDocument({
        schemaVersion: '1.0.0',
        id: 'template-1',
        name: 'Grid 2x2',
        page: { sizePreset: 'A4', orientation: 'portrait', dpi: 300 },
        rootNode: { id: 'root', type: 'grid' },
      }),
    ).toMatchObject({
      id: 'template-1',
      name: 'Grid 2x2',
      page: { sizePreset: 'A4', orientation: 'portrait', dpi: 300 },
    });
  });

  it('preserves createdAt and refreshes updatedAt on save preparation', () => {
    const prepared = prepareTemplateForSave(
      {
        schemaVersion: '1.0.0',
        id: 'template-1',
        name: '  Grid 2x2  ',
        page: { sizePreset: 'A4', orientation: 'portrait', dpi: 300 },
        rootNode: { id: 'root', type: 'grid' },
      },
      {
        schemaVersion: '1.0.0',
        id: 'template-1',
        name: 'Old',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        page: { sizePreset: 'A4', orientation: 'portrait', dpi: 300 },
        rootNode: { id: 'root', type: 'grid' },
      },
    );

    expect(prepared.name).toBe('Grid 2x2');
    expect(prepared.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(typeof prepared.updatedAt).toBe('string');
  });
});

