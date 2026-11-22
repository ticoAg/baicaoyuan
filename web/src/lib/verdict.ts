// 物种数据的类型，以及由它算出的安全结论、部位表。网站和 App 共用，不依赖运行环境。

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
  /** 人工审核过的食用部位（data/reviewed/foods.csv），第一条是平常吃的部位，safety 取它的等级。 */
  eat?: { part: string; v: keyof typeof LEVELS; note?: string; ref?: string }[];
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
  reviewed: '本站审核',
};
export const src = (id: string) => SOURCE_SHORT[id] ?? id;

export const REDLIST: Record<string, string> = {
  EX: '灭绝', EW: '野外灭绝', CR: '极危', EN: '濒危', VU: '易危', NT: '近危', LC: '无危', DD: '数据缺乏',
};

/** 有毒、致命、可能有毒：页面上要给急救入口。 */
export const isDanger = (safety: string) => safety === 'deadly' || safety === 'toxic' || safety === 'suspect';

/**
 * 物种页顶部的安全结论。
 * 审核过的常见食物只说平常吃的部位；其余的取各条记录里最严的一档，再点明另有的记录。
 */
export function verdict(sp: Species) {
  const lv = LEVELS[sp.safety] ?? LEVELS.unknown;
  if (sp.eat?.length) {
    const lines = sp.eat.map((e) => `${e.v === sp.safety ? '' : `${LEVELS[e.v].label}：`}${e.part}${e.note ? ` · ${e.note}` : ''}`);
    return { lv, lines, tail: '', reviewed: true };
  }
  const hazards = (sp.hazards ?? []).filter((h) => h.lv);
  const foodSources = [...new Set([
    ...(sp.flags ?? []).filter((f) => f.f === '食用').flatMap((f) => f.src),
    ...(sp.parts ?? []).filter((p) => p.v === 'food_record').map((p) => p.src),
  ])];
  const okParts = [...new Set((sp.parts ?? []).filter((p) => p.v === 'food_record' && p.part).map((p) => p.part!))];
  const lines: string[] = [];
  let tail = '';
  if (isDanger(sp.safety)) {
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

export interface PartTableRow { part?: string; level?: string; label?: string; use: string; note?: string; src: string; ref?: string }

/**
 * 部位表：毒性记录和按部位的食用记录放在一张表里。
 * 审核过的常见食物先列食用部位（说明已经写在顶部结论里，不重复），再列有等级的毒性记录，不列用途记录。
 */
export function partRows(sp: Species): PartTableRow[] {
  const hazards = sp.hazards ?? [];
  if (sp.eat?.length)
    return [
      ...sp.eat.map((e) => ({ part: e.part, level: e.v as string, use: '', src: 'reviewed', ref: e.ref })),
      ...hazards.filter((h) => h.lv).map((h) => ({ part: h.part, level: h.lv, label: h.label, use: '', note: h.note, src: h.src, ref: h.ref })),
    ];
  return [
    ...hazards.map((h) => ({ part: h.part, level: h.lv, label: h.label, use: h.toxins ? `含 ${h.toxins}` : '', note: h.note, src: h.src, ref: h.ref })),
    ...(sp.parts ?? []).map((p) => ({ part: p.part, level: p.v, use: p.use ?? '', note: p.note, src: p.src, ref: p.ref })),
  ];
}

/** 纠错：跳到预填好的 GitHub issue。 */
export const issueUrl = (repo: string, origin: string, sp: Pick<Species, 'id' | 'sci' | 'zh'>) =>
  `${repo}/issues/new?title=${encodeURIComponent(`纠错：${sp.zh ?? sp.sci}（${sp.sci}）`)}&body=${encodeURIComponent(`页面：${origin}/s/${sp.id}\n\n哪里不对：\n\n依据（文献、链接）：\n`)}`;
