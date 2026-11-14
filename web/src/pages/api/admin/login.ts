// 后台登录、退出。
import type { APIRoute } from 'astro';
import { adminEnabled, checkPassword, COOKIE, MARK, newSession, reply, SESSION } from '../../../lib/admin';
import { bump, today, used, visitor } from '../../../lib/usage';

export const prerender = false;

const MAX_WRONG = 10;

export const POST: APIRoute = async ({ request, url, cookies, clientAddress }) => {
  if (request.headers.get('origin') !== url.origin) return reply({ error: 'forbidden' }, 403);
  if (!adminEnabled()) return reply({ error: 'disabled' }, 503);

  const day = today();
  const who = `login:${await visitor(request, clientAddress, day)}`;
  if (((await used(day, [who])).get(who) ?? 0) >= MAX_WRONG) return reply({ error: 'locked' }, 429);

  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  if (!(await checkPassword(String(body.password ?? '')))) {
    await bump(day, [who]);
    return reply({ error: 'wrong' }, 401);
  }
  cookies.set(SESSION, await newSession(), { ...COOKIE, httpOnly: true });
  cookies.set(MARK, '1', COOKIE);
  return reply({ ok: true }, 200);
};

export const DELETE: APIRoute = async ({ request, url, cookies }) => {
  if (request.headers.get('origin') !== url.origin) return reply({ error: 'forbidden' }, 403);
  cookies.delete(SESSION, { path: '/' });
  cookies.delete(MARK, { path: '/' });
  return reply({ ok: true }, 200);
};
