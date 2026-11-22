import { env } from 'cloudflare:workers';

export * from './verdict';
import type { Species } from './verdict';
import { validId } from './verdict';

/** 后台的改动盖在数据上：patch 里值为 null 的字段去掉，其余的覆盖。 */
export function applyPatch(doc: Species | null, patch: string | null): Species | null {
  if (!patch) return doc;
  const out = { ...(doc ?? {}) } as Record<string, unknown>;
  for (const [k, v] of Object.entries(JSON.parse(patch) as Record<string, unknown>)) {
    if (v === null) delete out[k];
    else out[k] = v;
  }
  return out as unknown as Species;
}

/**
 * 物种数据在 D1 里：species 表一个物种一行 JSON，来自数据管线；edits 表是后台维护的改动。
 * 数据库出错时抛出，由页面返回 503。
 */
export async function loadSpecies(id: string): Promise<Species | null> {
  if (!validId(id)) return null;
  const row = await env.DB.prepare('SELECT (SELECT doc FROM species WHERE id = ?1) AS doc, (SELECT patch FROM edits WHERE id = ?1) AS patch')
    .bind(id)
    .first<{ doc: string | null; patch: string | null }>();
  if (!row?.doc && !row?.patch) return null;
  return applyPatch(row.doc ? (JSON.parse(row.doc) as Species) : null, row.patch);
}

/** 一次读多个物种。 */
export async function loadMany(ids: string[]): Promise<Map<string, Species>> {
  const wanted = [...new Set(ids.filter(validId))];
  const out = new Map<string, Species>();
  if (!wanted.length) return out;
  const marks = wanted.map((_, i) => `?${i + 1}`).join(', ');
  const { results } = await env.DB.prepare(
    `SELECT id, doc, NULL AS patch FROM species WHERE id IN (${marks}) UNION ALL SELECT id, NULL, patch FROM edits WHERE id IN (${marks})`,
  )
    .bind(...wanted)
    .all<{ id: string; doc: string | null; patch: string | null }>();
  for (const r of results) if (r.doc) out.set(r.id, JSON.parse(r.doc) as Species);
  for (const r of results) {
    if (!r.patch) continue;
    const sp = applyPatch(out.get(r.id) ?? null, r.patch);
    if (sp) out.set(r.id, sp);
  }
  return out;
}

/** 数据库读不到（没灌数据、超出每日额度、故障）时的回应。 */
export function unavailable(err: unknown, json = false): Response {
  console.error('D1 读取失败', err);
  const headers = { 'cache-control': 'no-store', 'retry-after': '60' };
  if (json) return Response.json({ error: 'unavailable' }, { status: 503, headers });
  return new Response('数据暂时读不到，请稍后再试。', { status: 503, headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' } });
}

/** 预渲染好的 404 页，带上 404 状态码返回。 */
export async function notFound(base: URL): Promise<Response> {
  const page = await env.ASSETS.fetch(new URL('/404.html', base));
  // 开发模式下没有预渲染的 404 页
  const body = page.ok ? page.body : '没有找到这一页';
  return new Response(body, { status: 404, headers: { 'content-type': `${page.ok ? 'text/html' : 'text/plain'}; charset=utf-8` } });
}
