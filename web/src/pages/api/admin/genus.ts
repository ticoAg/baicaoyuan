// 填学名时，按属名带出已有的科属信息。
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { guard, reply, SESSION } from '../../../lib/admin';
import type { Species } from '../../../lib/species';

export const prerender = false;

export const GET: APIRoute = async ({ request, url, cookies }) => {
  const who = await guard(request, url, cookies.get(SESSION)?.value);
  if (who instanceof Response) return who;
  const name = url.searchParams.get('name') ?? '';
  if (!/^[A-Za-z][A-Za-z-]{1,40}$/.test(name)) return reply({}, 200);
  // id 是"属名_种加词"，按主键范围取同属的第一个
  const row = await env.DB.prepare('SELECT doc FROM species WHERE id >= ?1 AND id < ?2 LIMIT 1').bind(`${name}_`, `${name}\``).first<{ doc: string }>();
  if (!row) return reply({}, 200);
  const sp = JSON.parse(row.doc) as Species;
  return reply({ k: sp.k, fam: sp.fam, famZh: sp.famZh, genZh: sp.genZh }, 200);
};
