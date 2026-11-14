// 后台上传的图片，存在 R2。文件名带内容哈希，浏览器可以一直缓存；不进边缘缓存，删掉的图马上读不到。
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const key = params.key ?? '';
  if (!/^[A-Za-z0-9_-]{3,90}\/[0-9a-f]{12}(-s)?\.jpg$/.test(key)) return new Response(null, { status: 404 });
  const object = await env.IMAGES.get(key);
  if (!object) return new Response(null, { status: 404 });
  return new Response(object.body, {
    headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable', etag: object.httpEtag },
  });
};
