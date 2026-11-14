import { env } from 'cloudflare:workers';
import { LEVELS, shardOf } from './shared.js';

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
  img?: { file: string; author: string; license: string; licenseUrl?: string };
}

/** 物种数据按 id 的哈希分片存成静态文件，Worker 通过 ASSETS 读取。 */
export async function loadSpecies(id: string, base: URL): Promise<Species | null> {
  if (!/^[A-Za-z0-9_-]{3,90}$/.test(id)) return null;
  const res = await env.ASSETS.fetch(new URL(`/data/s/${shardOf(id)}.json`, base));
  if (!res.ok) return null;
  const docs = (await res.json()) as Record<string, Species>;
  return docs[id] ?? null;
}

/** 预渲染好的 404 页，带上 404 状态码返回。 */
export async function notFound(base: URL): Promise<Response> {
  const page = await env.ASSETS.fetch(new URL('/404.html', base));
  return new Response(page.body, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
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
      lines.push(h.lv === 'suspect' ? `${h.label}：${h.note}。不要吃。` : `${where ? where + '：' : ''}${h.label}（${src(h.src)}）`);
    }
    if (foodSources.length)
      tail = `另有食用记录（${foodSources.map(src).join('、')}）。同一种植物的不同部位、不同处理方式，结论可能不同；未经审核前按最严的一档显示。`;
  } else if (sp.safety === 'restricted') {
    lines.push('台湾食药署：未确认食用安全性前，不得作为食品原料使用。');
    if (foodSources.length) tail = `另有食用记录（${foodSources.map(src).join('、')}），未经审核。`;
  } else if (sp.safety === 'food_record') {
    lines.push(`有文献或清单记载食用（${foodSources.map(src).join('、')}）。记载不等于安全：本条目未经人工审核，不能据此食用。`);
    if (okParts.length) tail = `清单里列出的部位：${okParts.join('；')}。`;
  } else {
    lines.push('没有足够的证据说明它能不能吃。不要吃。');
  }
  return { lv, lines, tail, reviewed: false };
}
