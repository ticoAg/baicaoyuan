// 维护后台的账号。
//
// 两种人：管理员只有一个，名字是 admin，密码是 Worker 的 secret ADMIN_PASSWORD；
// 维护者自己申请（users 表），管理员通过后才能登录。
// 登录后发一个带签名和过期时间的 cookie，不存会话；维护者每次请求再查一遍是否仍然有效，所以移除立刻生效。

import { env } from 'cloudflare:workers';

export const SESSION = 'bcy_admin';
/** 给页面脚本看的标记：有它就显示"编辑"入口。不代表已登录。 */
export const MARK = 'bcy_m';
export const ADMIN = 'admin';
const DAYS = 30;
export const COOKIE = { path: '/', secure: true, sameSite: 'strict', maxAge: DAYS * 86400 } as const;

export interface Who { role: 'admin' | 'maintainer'; name: string }

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sign(text: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

/** 两个字符串是否相同；比较的是各自的签名，耗时与内容无关。 */
async function same(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sign(a, 'compare'), sign(b, 'compare')]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export const adminEnabled = () => !!env.ADMIN_PASSWORD && !!env.SESSION_SECRET;
/** 管理员的签名带上密码：改密码后旧的登录失效。 */
const secretFor = (role: string) => (role === 'admin' ? `${env.SESSION_SECRET}|${env.ADMIN_PASSWORD}` : env.SESSION_SECRET!);

export const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(12)).buffer);

/** 密码的哈希：PBKDF2 之后再用 SESSION_SECRET 签一次，光拿到数据库算不出来。 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 10_000 }, key, 256);
  return sign(hex(bits), env.SESSION_SECRET!);
}

/** 核对名字和密码。pending 表示申请还没通过。 */
export async function login(name: string, password: string): Promise<Who | 'pending' | null> {
  if (name === ADMIN) return (await same(password, env.ADMIN_PASSWORD!)) ? { role: 'admin', name } : null;
  const user = await env.DB.prepare('SELECT salt, hash, status FROM users WHERE name = ?1').bind(name).first<{ salt: string; hash: string; status: string }>();
  // 没有这个人时也算一遍，耗时不透露名字是否存在
  const ok = await same(await hashPassword(password, user?.salt ?? 'none'), user?.hash ?? '');
  if (!user || !ok) return null;
  return user.status === 'active' ? { role: 'maintainer', name } : 'pending';
}

const b64 = (s: string) => btoa(String.fromCharCode(...enc.encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

export async function newSession(who: Who): Promise<string> {
  const body = `${who.role}:${b64(who.name)}:${Date.now() + DAYS * 86400_000}`;
  return `${body}.${await sign(body, secretFor(who.role))}`;
}

export async function whoIs(cookie: string | undefined): Promise<Who | null> {
  if (!cookie || !adminEnabled()) return null;
  const dot = cookie.lastIndexOf('.');
  const body = cookie.slice(0, dot);
  const [role, name64, expires] = body.split(':');
  if ((role !== 'admin' && role !== 'maintainer') || !name64 || !(Number(expires) > Date.now())) return null;
  if (!(await same(cookie.slice(dot + 1), await sign(body, secretFor(role))))) return null;
  if (role === 'admin') return { role, name: ADMIN };
  let name: string;
  try {
    name = unb64(name64);
  } catch {
    return null;
  }
  const user = await env.DB.prepare(`SELECT 1 AS ok FROM users WHERE name = ?1 AND status = 'active'`).bind(name).first();
  return user ? { role, name } : null;
}

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
export const reply = json;
export const sameOrigin = (request: Request, url: URL) => request.headers.get('origin') === url.origin;

/** 后台接口的门：同源、已登录；adminOnly 的还得是管理员。不通过时返回要直接回给浏览器的响应。 */
export async function guard(request: Request, url: URL, cookie: string | undefined, adminOnly = false): Promise<Who | Response> {
  if (request.method !== 'GET' && !sameOrigin(request, url)) return json({ error: 'forbidden' }, 403);
  const who = await whoIs(cookie);
  if (!who) return json({ error: 'login' }, 401);
  if (adminOnly && who.role !== 'admin') return json({ error: 'admin_only' }, 403);
  return who;
}

/** 改动保存后，清掉这个物种在边缘缓存里的页面（只清得到当前节点，其他节点最多一小时后过期）。 */
export async function purge(url: URL, id: string): Promise<void> {
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  if (!cache) return;
  await Promise.all([`/s/${id}`, `/s/${id}.json`].map((p) => cache.delete(new Request(url.origin + p)).catch(() => false)));
}
