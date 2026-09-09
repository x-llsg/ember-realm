import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TREE_ROLES } from '../lib/skill-tree-data.ts';
import { REGIONS } from '../lib/realm-data.ts';
import { GUARDIANS } from '../lib/guardian-data.ts';
import { embedLocalArtwork, assertSelfContainedCss } from './make-portable.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(
  await readFile(path.join(root, 'public/art/manifest.json'), 'utf8'),
);
const css = await readFile(path.join(root, 'app/game-art.css'), 'utf8');
const component = await readFile(
  path.join(root, 'components/game-art.tsx'),
  'utf8',
);
const regionIds = ['forest', 'ruins', 'desert', 'abyss', 'dragon', 'heaven'];
const byId = (id) => manifest.assets.find((asset) => asset.id === id);
const normalizeName = (name) => name.replace(/[\s·]/g, '');
const componentIds = (name) =>
  [
    ...component
      .match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\]`))[1]
      .matchAll(/['"]([^'"]+)['"]/g),
  ].map((match) => match[1]);

function webpSize(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  assert.equal(
    bytes.readUInt32LE(4) + 8,
    bytes.length,
    'WebP must not be truncated',
  );
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const chunk = bytes.toString('ascii', offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    assert.ok(
      start + length <= bytes.length,
      'WebP chunk must stay inside file',
    );
    if (chunk === 'VP8X')
      return {
        width: bytes.readUIntLE(start + 4, 3) + 1,
        height: bytes.readUIntLE(start + 7, 3) + 1,
      };
    if (chunk === 'VP8 ') {
      assert.deepEqual(
        bytes.subarray(start + 3, start + 6),
        Buffer.from([0x9d, 0x01, 0x2a]),
      );
      return {
        width: bytes.readUInt16LE(start + 6) & 0x3fff,
        height: bytes.readUInt16LE(start + 8) & 0x3fff,
      };
    }
    if (chunk === 'VP8L') {
      assert.equal(bytes[start], 0x2f);
      const bits = bytes.readUInt32LE(start + 1);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
    offset = start + length + (length % 2);
  }
  assert.fail('WebP has no image dimensions');
}

test('art manifest contains unique documented atlases and all 51 illustrated subjects', () => {
  assert.match(manifest.generator, /imagegen/i);
  assert.equal(manifest.assets.length, 8);
  assert.equal(new Set(manifest.assets.map((asset) => asset.id)).size, 8);
  assert.equal(new Set(manifest.assets.map((asset) => asset.file)).size, 8);
  assert.equal(
    manifest.assets.reduce((sum, asset) => sum + asset.entries.length, 0),
    51,
  );
  for (const asset of manifest.assets) {
    assert.match(asset.file, /^[a-z0-9][a-z0-9_-]*\.webp$/);
    assert.ok(
      asset.prompt.length > 80,
      asset.id + ' must retain its generation description',
    );
    assert.equal(asset.entries.length, asset.columns * asset.rows, asset.id);
    assert.equal(
      new Set(asset.entries.map((entry) => entry.id)).size,
      asset.entries.length,
      asset.id,
    );
    for (const entry of asset.entries)
      assert.match(
        entry.name,
        /[\u3400-\u9fff]/,
        entry.id + ' needs a Chinese label',
      );
  }
});

test('portrait atlas covers every current profession in the exact displayed order', () => {
  const portraits = byId('portraits');
  assert.equal(portraits.columns, 3);
  assert.equal(portraits.rows, 3);
  assert.equal(TREE_ROLES.length, 9);
  assert.deepEqual(
    portraits.entries.map((entry) => entry.id),
    TREE_ROLES.map((role) => role.id),
  );
  assert.deepEqual(
    portraits.entries.map((entry) => entry.name),
    TREE_ROLES.map((role) => role.name),
  );
  assert.deepEqual(
    componentIds('roles'),
    portraits.entries.map((entry) => entry.id),
  );
});

test('every chapter has all five guardian portraits followed by its final boss', () => {
  assert.equal(REGIONS.length, 6);
  assert.deepEqual(componentIds('regions'), regionIds);
  for (const [region, id] of regionIds.entries()) {
    const atlas = byId('enemies-' + id);
    assert.equal(atlas.columns, 3);
    assert.equal(atlas.rows, 2);
    assert.deepEqual(
      atlas.entries.map((entry) => entry.id),
      Array.from({ length: 6 }, (_, node) => `${region}-${node}`),
    );
    const enemies = [
      ...GUARDIANS[region].map((guardian) => guardian.name),
      REGIONS[region].boss,
    ];
    assert.deepEqual(
      atlas.entries.map((entry) => normalizeName(entry.name)),
      enemies.map(normalizeName),
      'chapter ' + (region + 1),
    );
  }
});

test('landscape atlas covers all six chapters in navigation order', () => {
  const atlas = byId('regions');
  assert.equal(atlas.columns, 3);
  assert.equal(atlas.rows, 2);
  assert.deepEqual(
    atlas.entries.map((entry) => entry.id),
    REGIONS.map((_, index) => 'region-' + index),
  );
  assert.deepEqual(
    atlas.entries.map((entry) => entry.name),
    REGIONS.map((region) => region.name),
  );
});

test('all atlas source files are complete WebP images with valid usable cell geometry', async () => {
  for (const asset of manifest.assets) {
    const bytes = await readFile(path.join(root, 'public/art', asset.file));
    const { width, height } = webpSize(bytes);
    const cellWidth = width / asset.columns;
    const cellHeight = height / asset.rows;
    assert.ok(
      cellWidth >= 240 && cellHeight >= 240,
      asset.id + ' must remain readable',
    );
    const expectedRatio = asset.id === 'regions' ? 2 : 1;
    assert.ok(
      Math.abs(cellWidth / cellHeight - expectedRatio) < 0.015,
      asset.id + ' cell aspect ratio',
    );
    // Generated atlas dimensions can be fractional per cell. CSS percentage
    // positioning permits the subpixel boundaries; no integer cropping occurs.
    for (let index = 0; index < asset.entries.length; index++) {
      const column = index % asset.columns;
      const row = Math.floor(index / asset.columns);
      const left = column * cellWidth;
      const top = row * cellHeight;
      assert.ok(left >= 0 && top >= 0);
      assert.ok(
        left + cellWidth <= width + 1 && top + cellHeight <= height + 1,
        asset.id + ':' + index,
      );
      assert.ok(
        column / (asset.columns - 1) <= 1 && row / (asset.rows - 1) <= 1,
      );
    }
  }
});

test('every published atlas is connected to a CSS variable and no unknown atlas is referenced', () => {
  const references = [
    ...css.matchAll(/--art-([a-z-]+):\s*url\(['"]?\/art\/([^'"\s)]+)/g),
  ];
  assert.equal(references.length, manifest.assets.length);
  for (const [, id, file] of references) assert.equal(byId(id)?.file, file, id);
  assert.deepEqual(
    new Set(references.map(([, , file]) => file)),
    new Set(manifest.assets.map((asset) => asset.file)),
  );
});

test('portable build embeds byte-identical art for all atlases and keeps legacy valley art', async () => {
  const embedded = await embedLocalArtwork(
    css + '\n.legacy{background:url(/valley.png)}',
  );
  assertSelfContainedCss(embedded);
  assert.doesNotMatch(embedded, /url\(['"]?\/art\//);
  assert.match(embedded, /\.legacy\{background:var\(--valley-art\)\}/);
  const images = [
    ...embedded.matchAll(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/g),
  ].map((match) => Buffer.from(match[1], 'base64'));
  assert.equal(images.length, manifest.assets.length);
  for (const asset of manifest.assets) {
    const source = await readFile(path.join(root, 'public/art', asset.file));
    assert.ok(
      images.some((image) => image.equals(source)),
      asset.file + ' must be included without re-encoding',
    );
  }
  const valley = Buffer.from(
    embedded.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/)[1],
    'base64',
  );
  assert.ok(
    valley.equals(await readFile(path.join(root, 'public/valley.png'))),
  );
});

test('portable build rejects network images, unpacked local files and imports', async () => {
  for (const url of [
    'https://example.com/picture.webp',
    '//example.com/picture.webp',
    '/new-picture.png',
    '../picture.webp',
    '/art/../private.webp',
    '/art/portrait.webp?other=1',
  ]) {
    await assert.rejects(
      () => embedLocalArtwork(`.picture{background:url("${url}")}`),
      /not an approved local asset/,
    );
    assert.throws(
      () => assertSelfContainedCss(`.picture{background:url('${url}')}`),
      /external or unpacked URL/,
    );
  }
  await assert.rejects(
    () => embedLocalArtwork('@import "https://example.com/art.css";'),
    /imports/,
  );
  assert.throws(
    () => assertSelfContainedCss('@import url(data:text/css;base64,e30=);'),
    /imports/,
  );
});

test('portable build fails for a referenced missing atlas instead of emitting broken images', async () => {
  await assert.rejects(
    () =>
      embedLocalArtwork('.picture{background:url(/art/missing-art-test.webp)}'),
    { code: 'ENOENT' },
  );
});

test('existing embedded artwork and local SVG filter references remain self-contained', async () => {
  const original =
    '.icon{background:url("data:image/svg+xml,%3Csvg/%3E");filter:url(#warm-filter)}';
  const embedded = await embedLocalArtwork(original);
  assert.ok(embedded.endsWith(original));
  assertSelfContainedCss(embedded);
});
