// 管理员处理维护者：通过申请，拒绝或移除。
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { guard, reply, SESSION } from '../../../lib/admin';

export const prerender = false;

export const POST: APIRoute = async ({ request, url, cookies }) => {
  const who = await guard(request, url, cookies.get(SESSION)?.value, true);
  if (who instanceof Response) return who;
  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  await env.DB.prepare(`UPDATE users SET status = 'active' WHERE name = ?1`).bind(String(body.name ?? '')).run();
  return reply({ ok: true }, 200);
};

export const DELETE: APIRoute = async ({ request, url, cookies }) => {
  const who = await guard(request, url, cookies.get(SESSION)?.value, true);
  if (who instanceof Response) return who;
  await env.DB.prepare('DELETE FROM users WHERE name = ?1').bind(url.searchParams.get('name') ?? '').run();
  return reply({ ok: true }, 200);
};
