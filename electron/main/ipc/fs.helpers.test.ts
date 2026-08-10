import { describe, expect, it } from 'vitest';

import {
  applyRegeneratedImage,
  computeCoverDecodeSize,
  normalizeProjectDocument,
  prepareProjectForSave,
  type PersistedImageAsset,
} from './fs.helpers.js';

const PLACEHOLDER = 'data:image/svg+xml;utf8,placeholder';

function persistedAsset(overrides: Partial<PersistedImageAsset> = {}): PersistedImageAsset {
  return {
    id: 'asset-1',
    originalPath: '/tmp/photo.jpg',
    storedPath: '/tmp/photo.jpg',
    fileName: 'photo.jpg',
    widthPx: 800,
    heightPx: 600,
    ...overrides,
  };
}

describe('normalizeProjectDocument', () => {
  it('validates a well-formed project document', () => {
    const { project, imagePool } = normalizeProjectDocument({
      schemaVersion: '1.0.0',
      id: 'project-1',
      name: 'My Album',
      sheetSize: { sizePreset: 'A4' },
      pages: [
        {
          id: 'page-1',
          pageConfig: { orientation: 'portrait', dpi: 300 },
          rootNode: { id: 'root', type: 'imageSlot' },
          assignments: { root: 'asset-1' },
        },
      ],
      imagePool: [
        { id: 'asset-1', originalPath: '/tmp/a.jpg', storedPath: '/tmp/a.jpg', fileName: 'a.jpg', widthPx: 800, heightPx: 600 },
      ],
    });

    expect(project).toMatchObject({ id: 'project-1', name: 'My Album', sheetSize: { sizePreset: 'A4' } });
    expect(project.pages).toHaveLength(1);
    expect(imagePool).toEqual([
      { id: 'asset-1', originalPath: '/tmp/a.jpg', storedPath: '/tmp/a.jpg', fileName: 'a.jpg', widthPx: 800, heightPx: 600, dpiOriginal: undefined },
    ]);
  });

  it('derives sheetSize from the first page for a legacy document with no top-level sheetSize', () => {
    const { project } = normalizeProjectDocument({
      schemaVersion: '1.0.0',
      id: 'project-1',
      name: 'My Album',
      pages: [
        {
          id: 'page-1',
          pageConfig: { sizePreset: 'Letter', orientation: 'portrait', dpi: 300 },
          rootNode: { id: 'root', type: 'imageSlot' },
          assignments: {},
        },
        {
          id: 'page-2',
          pageConfig: { sizePreset: 'A3', orientation: 'landscape', dpi: 300 },
          rootNode: { id: 'root', type: 'imageSlot' },
          assignments: {},
        },
      ],
      imagePool: [],
    });

    expect(project.sheetSize).toEqual({ sizePreset: 'Letter', customSizeMm: undefined });
    expect(project.pages[0].pageConfig).toEqual({ orientation: 'portrait', dpi: 300 });
    expect(project.pages[1].pageConfig).toEqual({ orientation: 'landscape', dpi: 300 });
  });

  it('rejects a document with an invalid image pool entry', () => {
    expect(() =>
      normalizeProjectDocument({
        schemaVersion: '1.0.0',
        id: 'project-1',
        name: 'My Album',
        sheetSize: { sizePreset: 'A4' },
        pages: [],
        imagePool: [{ id: 'asset-1', originalPath: '/tmp/a.jpg' }],
      }),
    ).toThrow();
  });
});

describe('prepareProjectForSave', () => {
  it('strips thumbnailDataUrl and missing from every image pool entry', () => {
    const prepared = prepareProjectForSave({
      schemaVersion: '1.0.0',
      id: 'project-1',
      name: 'My Album',
      sheetSize: { sizePreset: 'A4' },
      pages: [],
      imagePool: [
        { ...persistedAsset(), thumbnailDataUrl: 'data:image/png;base64,AA==', missing: true },
      ],
    }) as { imagePool: unknown[] };

    expect(prepared.imagePool[0]).toEqual(persistedAsset());
  });
});

describe('applyRegeneratedImage', () => {
  it('merges a successful decode into the persisted asset without flagging it missing', () => {
    const asset = applyRegeneratedImage(
      persistedAsset(),
      { widthPx: 1024, heightPx: 768, thumbnailDataUrl: 'data:image/png;base64,AA==' },
      PLACEHOLDER,
    );

    expect(asset).toEqual({
      ...persistedAsset(),
      widthPx: 1024,
      heightPx: 768,
      thumbnailDataUrl: 'data:image/png;base64,AA==',
    });
    expect(asset.missing).toBeUndefined();
  });

  it('flags the asset missing and keeps its persisted dimensions when decoding fails', () => {
    const asset = applyRegeneratedImage(persistedAsset({ widthPx: 640, heightPx: 480 }), null, PLACEHOLDER);

    expect(asset.missing).toBe(true);
    expect(asset.thumbnailDataUrl).toBe(PLACEHOLDER);
    expect(asset.widthPx).toBe(640);
    expect(asset.heightPx).toBe(480);
    expect(asset.originalPath).toBe(persistedAsset().originalPath);
  });

  it('a mix of successful and failed decodes marks only the failed entries missing', () => {
    const assets = [
      persistedAsset({ id: 'good-1' }),
      persistedAsset({ id: 'bad', originalPath: '/tmp/gone.jpg' }),
      persistedAsset({ id: 'good-2' }),
    ].map((persisted) =>
      applyRegeneratedImage(
        persisted,
        persisted.id === 'bad' ? null : { widthPx: 1, heightPx: 1, thumbnailDataUrl: 'data:image/png;base64,AA==' },
        PLACEHOLDER,
      ),
    );

    expect(assets.map((asset) => asset.missing ?? false)).toEqual([false, true, false]);
  });
});

describe('computeCoverDecodeSize', () => {
  it('scales a landscape source down, preserving aspect, when the height axis is the binding constraint', () => {
    expect(computeCoverDecodeSize(4000, 2000, 1000, 800)).toEqual({ width: 1600, height: 800 });
  });

  it('scales a portrait source down, preserving aspect, when the width axis is the binding constraint', () => {
    expect(computeCoverDecodeSize(2000, 4000, 800, 1000)).toEqual({ width: 800, height: 1600 });
  });

  it('clamps to the native size instead of upscaling when the requested minimum exceeds it', () => {
    expect(computeCoverDecodeSize(500, 500, 2000, 1000)).toEqual({ width: 500, height: 500 });
  });

  it('scales down aspect-preserving when the requested minimum is smaller than native in both dimensions', () => {
    expect(computeCoverDecodeSize(3000, 2000, 300, 150)).toEqual({ width: 300, height: 200 });
  });

  it('throws for non-positive native dimensions', () => {
    expect(() => computeCoverDecodeSize(0, 100, 10, 10)).toThrow();
    expect(() => computeCoverDecodeSize(100, 0, 10, 10)).toThrow();
  });
});
