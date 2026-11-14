// 维护后台的登录。只有一个密码（Worker 的 secret ADMIN_PASSWORD）；
// 登录后发一个带签名和过期时间的 cookie，不存会话。改密码后旧的 cookie 全部失效。

import { env } from 'cloudflare:workers';

export const SESSION = 'bcy_admin';
/** 给页面脚本看的标记：有它就显示"编辑"入口。不代表已登录。 */
export const MARK = 'bcy_m';
const DAYS = 30;
export const COOKIE = { path: '/', secure: true, sameSite: 'strict', maxAge: DAYS * 86400 } as const;

/** 上传图片时可选的许可。 */
export const LICENSES: Record<string, string | undefined> = {
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'CC0 1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  公有领域: undefined,
};

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sign(text: string, password: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

/** 两个字符串是否相同；比较的是各自的签名，耗时与内容无关。 */
async function same(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sign(a, 'compare'), sign(b, 'compare')]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export const adminEnabled = () => !!env.ADMIN_PASSWORD;

export async function checkPassword(given: string): Promise<boolean> {
  return !!env.ADMIN_PASSWORD && (await same(given, env.ADMIN_PASSWORD));
}

export async function newSession(): Promise<string> {
  const expires = String(Date.now() + DAYS * 86400_000);
  return `${expires}.${await sign(expires, env.ADMIN_PASSWORD!)}`;
}

export async function isAdmin(cookie: string | undefined): Promise<boolean> {
  if (!cookie || !env.ADMIN_PASSWORD) return false;
  const [expires, mac] = cookie.split('.');
  if (!expires || !mac || !(Number(expires) > Date.now())) return false;
  return same(mac, await sign(expires, env.ADMIN_PASSWORD));
}

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
export const reply = json;

/** 后台接口的门：同源、已登录。不通过时返回要直接回给浏览器的响应。 */
export async function guard(request: Request, url: URL, cookie: string | undefined): Promise<Response | null> {
  if (request.method !== 'GET' && request.headers.get('origin') !== url.origin) return json({ error: 'forbidden' }, 403);
  if (!(await isAdmin(cookie))) return json({ error: 'login' }, 401);
  return null;
}

/** 改动保存后，清掉这个物种在边缘缓存里的页面（只清得到当前节点，其他节点最多一小时后过期）。 */
export async function purge(url: URL, id: string): Promise<void> {
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  if (!cache) return;
  await Promise.all([`/s/${id}`, `/s/${id}.json`].map((p) => cache.delete(new Request(url.origin + p)).catch(() => false)));
}
