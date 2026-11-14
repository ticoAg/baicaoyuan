// 每个物种一份 JSON，供别的应用直接调用。
import type { APIRoute } from 'astro';
import { loadSpecies } from '../../lib/species';

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  const sp = await loadSpecies(params.id ?? '', url);
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'public, max-age=3600, s-maxage=86400',
  };
  if (!sp) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers });
  return new Response(JSON.stringify(sp), { headers });
};
