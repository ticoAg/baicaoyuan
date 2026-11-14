// 申请成为维护者。申请记在 users 表里，等管理员通过。
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { ADMIN, adminEnabled, hashPassword, newSalt, reply, sameOrigin } from '../../../lib/admin';
import { bump, today, used, visitor } from '../../../lib/usage';

export const prerender = false;

const PER_VISITOR = 3;
const MAX_PENDING = 200;
const RESERVED = [ADMIN, 'administrator', 'root', '管理员', '百草园'];

export const POST: APIRoute = async ({ request, url, clientAddress }) => {
  if (!sameOrigin(request, url)) return reply({ error: 'forbidden' }, 403);
  if (!adminEnabled()) return reply({ error: 'disabled' }, 503);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const field = (k: string, max: number) => String(body[k] ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
  const name = field('name', 21);
  const password = String(body.password ?? '');
  const contact = field('contact', 100);
  const reason = field('reason', 500);
  if (!/^[\p{L}\p{N}_-]{2,20}$/u.test(name) || RESERVED.includes(name.toLowerCase())) return reply({ error: 'invalid', field: 'name' }, 400);
  if (password.length < 8 || password.length > 200) return reply({ error: 'invalid', field: 'password' }, 400);
  if (!contact) return reply({ error: 'invalid', field: 'contact' }, 400);
  if (!reason) return reply({ error: 'invalid', field: 'reason' }, 400);

  const day = today();
  const who = `apply:${await visitor(request, clientAddress, day)}`;
  if (((await used(day, [who])).get(who) ?? 0) >= PER_VISITOR) return reply({ error: 'locked' }, 429);
  const taken = await env.DB.prepare(`SELECT (SELECT 1 FROM users WHERE name = ?1) AS taken, (SELECT COUNT(*) FROM users WHERE status = 'pending') AS pending`)
    .bind(name)
    .first<{ taken: number | null; pending: number }>();
  if (taken?.taken) return reply({ error: 'taken' }, 409);
  if ((taken?.pending ?? 0) >= MAX_PENDING) return reply({ error: 'full' }, 429);

  const salt = newSalt();
  await env.DB.prepare(`INSERT INTO users (name, salt, hash, contact, reason, status, created) VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6)`)
    .bind(name, salt, await hashPassword(password, salt), contact, reason, new Date().toISOString())
    .run();
  await bump(day, [who]);
  return reply({ ok: true }, 200);
};
