import { env } from 'cloudflare:workers';
import { LEVELS } from './shared.js';

export interface PartRow { part?: string; v: string; use?: string; note?: string; src: string; ref?: string }
export interface HazardRow { lv?: string; part?: string; label: string; note?: string; toxins?: string; src: string; ref?: string }
export interface Species {
  id: string; k: 'plant' | 'fungus'; sci: string; au?: string; zh?: string; alias?: string[];
  fam?: string; famZh?: string; gen: string; genZh?: string; ord?: string;
  lf?: string; cl?: string; cn?: boolean; nat?: boolean; cult?: boolean; rl?: string;
  safety: keyof typeof LEVELS; powo?: string; wd?: string; zhwiki?: string;
  dist?: [string, 'n' | 'i'][];
  parts?: PartRow[]; hazards?: HazardRow[];
  uses?: { c: string; texts?: string[]; refs?: number[] }[]; refs?: string[];
  flags?: { f: string; src: string[]; ref?: string }[];
  traits?: [string, string][];
  /** 后台新建的词条，不来自数据管线。 */
  manual?: boolean;
  /** 数据里带的图。 */
  img?: Img;
  /** 后台上传的图，按显示顺序。 */
  imgs?: Img[];
}
export interface Img { url: string; thumb: string; page?: string; author: string; license: string; licenseUrl?: string; src: string }

/** 一个物种的全部图片：后台上传的在前，数据里带的在后。第一张是首图。 */
export const imagesOf = (sp: Pick<Species, 'img' | 'imgs'>): Img[] => [...(sp.imgs ?? []), ...(sp.img ? [sp.img] : [])];

export const validId = (id: string) => /^[A-Za-z0-9_-]{3,90}$/.test(id);

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

export const SOURCE_SHORT: Record<string, string> = {
  wcvp: 'WCVP',
  wikidata: 'Wikidata',
  taicol: 'TaiCOL',
  cn_useful: '中国有用植物数据集',
  wcfp: 'WCFP',
  tw_fda: '台湾食药署',
  tppt: 'TPPT',
  cn_toxic_1997: '中国有毒植物参考种（1997）',
  xsbn: '西双版纳数据集',
  commons: 'Wikimedia Commons',
  inat: 'iNaturalist',
};
export const src = (id: string) => SOURCE_SHORT[id] ?? id;

export const REDLIST: Record<string, string> = {
  EX: '灭绝', EW: '野外灭绝', CR: '极危', EN: '濒危', VU: '易危', NT: '近危', LC: '无危', DD: '数据缺乏',
};

/** 物种页顶部的安全结论：取各条记录里最严的一档，再点明另有的记录。 */
export function verdict(sp: Species) {
  const lv = LEVELS[sp.safety] ?? LEVELS.unknown;
  const hazards = (sp.hazards ?? []).filter((h) => h.lv);
  const foodSources = [...new Set([
    ...(sp.flags ?? []).filter((f) => f.f === '食用').flatMap((f) => f.src),
    ...(sp.parts ?? []).filter((p) => p.v === 'food_record').map((p) => p.src),
  ])];
  const okParts = [...new Set((sp.parts ?? []).filter((p) => p.v === 'food_record' && p.part).map((p) => p.part!))];
  const lines: string[] = [];
  let tail = '';

  if (sp.safety === 'deadly' || sp.safety === 'toxic' || sp.safety === 'suspect') {
    for (const h of hazards) {
      const where = [h.part, h.note].filter(Boolean).join('，');
      lines.push(h.lv === 'suspect' ? `${h.label}：${h.note}。没有毒性记录，不要吃。` : `${where ? where + '：' : ''}${h.label}（${src(h.src)}）`);
    }
    if (foodSources.length)
      tail = `另有食用记录（${foodSources.map(src).join('、')}）。不同部位、不同处理方式的结论可能不同，这里按最严的显示。`;
  } else if (sp.safety === 'restricted') {
    lines.push('台湾食药署：未确认食用安全性前，不得作为食品原料使用。');
    if (foodSources.length) tail = `另有食用记录（${foodSources.map(src).join('、')}）。`;
  } else if (sp.safety === 'food_record') {
    lines.push(`有文献或清单记载食用（${foodSources.map(src).join('、')}）。有记载不等于安全，不能据此食用。`);
    if (okParts.length) tail = `清单里列出的部位：${okParts.join('；')}。`;
  } else {
    lines.push('没有证据说明它能不能吃。');
  }
  return { lv, lines, tail, reviewed: false };
}
