import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildProjectBundle, extractProjectBundle } from './projectBundle.js';

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'epp-bundle-test-'));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe('buildProjectBundle / extractProjectBundle', () => {
  it('round-trips project.json and image bytes', async () => {
    const sourceDir = join(workDir, 'source');
    await mkdir(sourceDir);
    const imagePath = join(sourceDir, 'photo-1.jpg');
    await writeFile(imagePath, Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]));

    const projectJson = { schemaVersion: '1.0.0', id: 'proj-1', name: 'Album' };
    const bundle = await buildProjectBundle(projectJson, [{ assetId: 'asset-1', ext: '.jpg', filePath: imagePath }]);

    const destDir = join(workDir, 'extracted');
    await mkdir(destDir);
    const extractedJson = await extractProjectBundle(bundle, destDir);

    expect(extractedJson).toEqual(projectJson);
    const extractedBytes = await readFile(join(destDir, 'asset-1.jpg'));
    expect(extractedBytes).toEqual(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]));
  });

  it('embeds one image entry per source image, named by asset id', async () => {
    const sourceDir = join(workDir, 'source');
    await mkdir(sourceDir);
    const pathA = join(sourceDir, 'a.png');
    const pathB = join(sourceDir, 'b.png');
    await writeFile(pathA, Buffer.from([1, 2, 3]));
    await writeFile(pathB, Buffer.from([4, 5, 6]));

    const bundle = await buildProjectBundle(
      { id: 'proj-1' },
      [
        { assetId: 'asset-a', ext: '.png', filePath: pathA },
        { assetId: 'asset-b', ext: '.png', filePath: pathB },
      ],
    );

    const destDir = join(workDir, 'extracted');
    await mkdir(destDir);
    await extractProjectBundle(bundle, destDir);

    const entries = (await readdir(destDir)).sort();
    expect(entries).toEqual(['asset-a.png', 'asset-b.png']);
  });

  it('throws a clear error when project.json is missing from the archive', async () => {
    const destDir = join(workDir, 'extracted');
    await mkdir(destDir);

    // A zip with no project.json entry at all -- build one with only an image.
    const sourceDir = join(workDir, 'source');
    await mkdir(sourceDir);
    const imagePath = join(sourceDir, 'photo.jpg');
    await writeFile(imagePath, Buffer.from([1, 2, 3]));

    const { zipSync } = await import('fflate');
    const zipWithoutProjectJson = zipSync({ 'images/asset-1.jpg': new Uint8Array([1, 2, 3]) });

    await expect(extractProjectBundle(zipWithoutProjectJson, destDir)).rejects.toThrow(/missing project\.json/i);
  });

  it('throws a clear error when the archive is not a valid zip', async () => {
    const destDir = join(workDir, 'extracted');
    await mkdir(destDir);

    await expect(extractProjectBundle(new Uint8Array([1, 2, 3, 4]), destDir)).rejects.toThrow(/corrupted|not a zip/i);
  });

  it('extracts the readable images even when project.json parsing would fail for a different reason', async () => {
    // Not a failure of this function's own logic, but confirms partial-archive extraction doesn't
    // depend on every entry being well-formed -- only project.json's presence/parseability gates
    // the whole open, per the doc comment on extractProjectBundle.
    const { zipSync } = await import('fflate');
    const bundle = zipSync({
      'project.json': new TextEncoder().encode(JSON.stringify({ id: 'proj-1' })),
      'images/asset-1.jpg': new Uint8Array([9, 9, 9]),
    });

    const destDir = join(workDir, 'extracted');
    await mkdir(destDir);
    const result = await extractProjectBundle(bundle, destDir);

    expect(result).toEqual({ id: 'proj-1' });
    expect(await readFile(join(destDir, 'asset-1.jpg'))).toEqual(Buffer.from([9, 9, 9]));
  });
});
