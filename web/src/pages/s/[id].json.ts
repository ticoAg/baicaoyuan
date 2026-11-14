// 每个物种一份 JSON，供别的应用直接调用。
import type { APIRoute } from 'astro';
import { loadSpecies, unavailable } from '../../lib/species';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const headers = { 'access-control-allow-origin': '*' };
  try {
    const sp = await loadSpecies(params.id ?? '');
    if (!sp) return Response.json({ error: 'not_found' }, { status: 404, headers });
    return Response.json(sp, { headers: { ...headers, 'cache-control': 'public, max-age=600, s-maxage=3600' } });
  } catch (err) {
    return unavailable(err, true);
  }
};
