// 物种页和物种 JSON 的边缘缓存。
//
// 用 Cache API：命中时不读数据库、不渲染。它只在自定义域名上生效，workers.dev 上是空操作；
// 而且命中时 Worker 仍会执行，所以省的是 D1 读取和 CPU，不是请求次数。
// 过期时间取响应的 s-maxage（一小时），数据更新后最多一小时生效。

import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url } = context;
  if (request.method !== 'GET' || !url.pathname.startsWith('/s/')) return next();

  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  if (!cache) return next();
  const key = new Request(url.origin + url.pathname, { method: 'GET' });
  const hit = await cache.match(key).catch(() => undefined);
  if (hit) return hit;

  const response = await next();
  if (response.status === 200) {
    const copy = response.clone();
    const store = cache.put(key, copy).catch(() => {});
    context.locals.cfContext?.waitUntil(store);
  }
  return response;
});
