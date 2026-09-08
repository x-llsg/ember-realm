import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root=fileURLToPath(new URL('../',import.meta.url));
const js=await readFile(path.join(root,'.portable-build/game.js'),'utf8');
let css=await readFile(path.join(root,'.portable-build/game.css'),'utf8');
const art=(await readFile(path.join(root,'public/valley.png'))).toString('base64');
css=css.replace(/url\(["']?\/valley\.png["']?\)/g,'var(--valley-art)');
css=`:root{--valley-art:url("data:image/png;base64,${art}")}\n${css}`;
new vm.Script(js,{filename:'portable-game.js'});
const html=`<!doctype html><html lang="zh-CN" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0c1018"><title>余烬之境 · 从营火到诸神黄昏</title><meta name="description" content="穿越异世，建造城镇、雇佣冒险者，走向魔王、巨龙与神明的终局。"><style>${css.replaceAll('</style','<\\/style')}</style></head><body><div id="root"></div><noscript>请在浏览器设置中允许 JavaScript，以继续这段旅程。</noscript><script>${js.replaceAll('</script','<\\/script')}</script></body></html>`;
if(/<script\b[^>]*\bsrc=|<link\b[^>]*\bhref=|\bimport\s*\(/.test(html))throw Error('Portable game must not load external scripts or styles.');
await writeFile(path.join(root,'play.html'),html);
console.log(`Offline game ready: ${Math.round(Buffer.byteLength(html)/1024)} KB. Embedded art, styles and code; no server required.`);
