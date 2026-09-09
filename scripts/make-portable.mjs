import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const CSS_URL = /url\(\s*(?:"([^"\n]*)"|'([^'\n]*)'|([^)'"\n]*))\s*\)/gi;
const cssUrls = (css) =>
  [...css.matchAll(CSS_URL)].map((match) => ({
    expression: match[0],
    value: (match[1] ?? match[2] ?? match[3]).trim(),
  }));
const inlineUrl = (url) => /^data:/i.test(url) || /^#[a-z0-9_-]+$/i.test(url);

/** Check final CSS so newly added art cannot silently break offline launch. */
export function assertSelfContainedCss(css) {
  if (/@import\b/i.test(css))
    throw Error('Portable CSS must not load external imports.');
  for (const { value } of cssUrls(css)) {
    if (!inlineUrl(value))
      throw Error(
        `Portable CSS contains an external or unpacked URL: ${value}`,
      );
  }
}

export async function embedLocalArtwork(
  css,
  publicDirectory = path.join(root, 'public'),
) {
  if (/@import\b/i.test(css))
    throw Error('Portable CSS must not load external imports.');
  const assets = new Map();
  // Keep the legacy scene variable available for old views and saved UI routes.
  const valley = (
    await readFile(path.join(publicDirectory, 'valley.png'))
  ).toString('base64');
  for (const { value } of cssUrls(css)) {
    if (inlineUrl(value) || assets.has(value)) continue;
    if (value === '/valley.png') {
      assets.set(value, 'var(--valley-art)');
      continue;
    }
    // Unknown local paths, traversal, network paths and queries fail explicitly.
    if (!/^\/art\/[a-z0-9][a-z0-9_-]*\.webp$/i.test(value)) {
      throw Error(`Portable artwork is not an approved local asset: ${value}`);
    }
    const bytes = await readFile(path.join(publicDirectory, value.slice(1)));
    if (
      bytes.toString('ascii', 0, 4) !== 'RIFF' ||
      bytes.toString('ascii', 8, 12) !== 'WEBP'
    ) {
      throw Error(`Portable artwork is not a valid WebP container: ${value}`);
    }
    assets.set(
      value,
      `url("data:image/webp;base64,${bytes.toString('base64')}")`,
    );
  }
  const embedded = css.replace(CSS_URL, (expression, quoted, single, bare) => {
    const value = (quoted ?? single ?? bare).trim();
    return assets.get(value) ?? expression;
  });
  const result = `:root{--valley-art:url("data:image/png;base64,${valley}")}\n${embedded}`;
  assertSelfContainedCss(result);
  return result;
}

async function main() {
  const { version } = JSON.parse(
    await readFile(path.join(root, 'package.json'), 'utf8'),
  );
  const js = await readFile(path.join(root, '.portable-build/game.js'), 'utf8');
  const css = await embedLocalArtwork(
    await readFile(path.join(root, '.portable-build/game.css'), 'utf8'),
  );
  new vm.Script(js, { filename: 'portable-game.js' });
  const html = `<!doctype html><html lang="zh-CN" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#111a17"><title>余烬之境 · V${version}</title><meta name="description" content="穿越异世，建造城镇、雇佣冒险者，走向魔王、巨龙与神明的终局。"><style>${css.replaceAll('</style', '<\\/style')}</style></head><body><div id="root"></div><noscript>请在浏览器设置中允许 JavaScript，以继续这段旅程。</noscript><script>${js.replaceAll('</script', '<\\/script')}</script></body></html>`;
  if (/<script\b[^>]*\bsrc=|<link\b[^>]*\bhref=|\bimport\s*\(/.test(html)) {
    throw Error('Portable game must not load external scripts or styles.');
  }
  if (
    /<(?:img|source|video)\b[^>]*(?:src|srcset|poster)\s*=\s*["']?(?!data:)[^\s"'>]+/i.test(
      html,
    )
  ) {
    throw Error('Portable game must not load external image or media files.');
  }
  await writeFile(path.join(root, 'play.html'), html);
  console.log(
    `Offline game ready: ${Math.round(Buffer.byteLength(html) / 1024)} KB. Embedded art, styles and code; no server required.`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
