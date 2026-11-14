// 按天计数（D1 的 usage 表）：拍照识别的每日上限、后台登录的试错上限。

import { env } from 'cloudflare:workers';

export const today = () => new Date().toISOString().slice(0, 10);

/** 访客标识：当天日期和 IP 的哈希，不存 IP 本身。 */
export async function visitor(request: Request, clientAddress: string | undefined, day: string): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') ?? clientAddress ?? '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day}|${ip}`));
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function used(day: string, keys: string[]): Promise<Map<string, number>> {
  const { results } = await env.DB.prepare(`SELECT who, n FROM usage WHERE day = ?1 AND who IN (${keys.map((_, i) => `?${i + 2}`).join(', ')})`)
    .bind(day, ...keys)
    .all<{ who: string; n: number }>();
  return new Map(results.map((r) => [r.who, r.n]));
}

/** 各记一次；sweep 为真时顺手清掉往日的行。 */
export async function bump(day: string, keys: string[], sweep = false): Promise<void> {
  const add = env.DB.prepare('INSERT INTO usage (day, who, n) VALUES (?1, ?2, 1) ON CONFLICT (day, who) DO UPDATE SET n = n + 1');
  const batch = keys.map((k) => add.bind(day, k));
  if (sweep) batch.push(env.DB.prepare('DELETE FROM usage WHERE day < ?1').bind(day));
  await env.DB.batch(batch);
}
