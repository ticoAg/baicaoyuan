// 构建完成后生成 service worker（dist/sw.js）。由 astro.config.mjs 里的集成调用。
//
// 只缓存应用外壳：急救、蘑菇特征检索、毒蘑菇专题、离线提示页，以及这几页用到的 /_astro/ 文件。
// 物种页、搜索索引、图片都不缓存。版本号取这些文件内容的哈希，内容变了才会装新版本。
//
//   外壳页面：先用缓存，同时在后台更新
//   /_astro/：文件名带哈希，先用缓存
//   其他页面：走网络，断网时显示离线提示页

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const SHELL = ['/aid/', '/finder/', '/topics/poisonous-mushrooms/', '/offline/'];
const EXTRA = ['/favicon.svg', '/manifest.webmanifest'];

const assetRefs = (text) => [...text.matchAll(/\/_astro\/[\w.@~-]+\.(?:js|css|woff2?|svg|png|webp)/g)].map((m) => m[0]);
// 打包后的脚本之间用相对路径互相引用
const jsImports = (text) => [...text.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']\.\/([\w.@~-]+\.js)["']/g)].map((m) => `/_astro/${m[1]}`);

export async function writeServiceWorker(dir) {
  const file = (url) => path.join(dir, url.endsWith('/') ? `${url}index.html` : url);
  const assets = new Set();
  const queue = [];
  for (const page of SHELL) {
    if (!existsSync(file(page))) throw new Error(`service worker：找不到 ${page} 的构建结果`);
    queue.push(...assetRefs(await readFile(file(page), 'utf8')));
  }
  while (queue.length) {
    const url = queue.pop();
    if (assets.has(url)) continue;
    assets.add(url);
    if (url.endsWith('.js') || url.endsWith('.css')) {
      const text = await readFile(file(url), 'utf8');
      queue.push(...assetRefs(text), ...(url.endsWith('.js') ? jsImports(text) : []));
    }
  }
  const precache = [...SHELL, ...EXTRA.filter((u) => existsSync(file(u))), ...[...assets].sort()];
  const hash = createHash('sha256');
  for (const url of precache) hash.update(url).update(await readFile(file(url)));
  const version = hash.digest('hex').slice(0, 12);
  await writeFile(path.join(dir, 'sw.js'), source(version, precache));
  return { version, files: precache.length };
}

const source = (version, precache) => `// 由 scripts/sw.mjs 生成，不要手改。
const CACHE = 'bcy-${version}';
const PRECACHE = ${JSON.stringify(precache)};
const SHELL = new Set(${JSON.stringify(SHELL)});

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bcy-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith('/_astro/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })),
    );
    return;
  }

  if (req.mode !== 'navigate') return;
  const page = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
  if (SHELL.has(page)) {
    const fresh = fetch(req).then((res) => {
      if (res.ok && !res.redirected) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(page, copy));
      }
      return res;
    });
    event.waitUntil(fresh.catch(() => {}));
    event.respondWith(caches.match(page).then((hit) => hit || fresh).catch(() => caches.match('/offline/')));
    return;
  }
  event.respondWith(fetch(req).catch(() => caches.match('/offline/').then((hit) => hit || Response.error())));
});
`;
