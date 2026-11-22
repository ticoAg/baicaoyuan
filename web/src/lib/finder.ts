// 蘑菇特征检索的筛选规则。网站和 App 共用，不依赖运行环境。
// 数据是 /data/finder.json，选项和数据里写法的对应关系见 scripts/build-data.mjs 的 FINDER。
//
// 同一项里多选是"或"，不同项之间是"且"。
// 某项没有记录的种类不排除，放进"无法排除"；只选了"没看到"菌环或菌托时，有的种类也放进"无法排除"。

import { LEVEL_CODES } from './shared.js';

export interface Facet { key: string; name: string; options: string[]; weak?: string; weakNote?: string }
/** [id, 中文名, 学名, 等级代码, 科, {特征: 选项序号[]}]，已按危险程度排好 */
export type FinderItem = [id: string, zh: string, sci: string, level: number, fam: string, traits: Record<string, number[]>];
export interface FinderData {
  facets: Facet[];
  items: FinderItem[];
  /** 有毒却没有特征记录的蘑菇：[id, 中文名, 学名, 等级代码, 科] */
  untracked: [id: string, zh: string | 0, sci: string, level: number, fam: string][];
}
/** 每一项选了哪些选项（选项序号）。 */
export type Picked = Record<string, number[]>;
export interface FinderResult {
  match: FinderItem[];
  /** [种类, 为什么不能排除] */
  maybe: [FinderItem, string][];
  /** 符合和无法排除里致命的种类 */
  deadly: FinderItem[];
}

const DEADLY = LEVEL_CODES.indexOf('deadly');

/** 什么都没选时返回 null。 */
export function filterFinder(data: Pick<FinderData, 'facets' | 'items'>, picked: Picked): FinderResult | null {
  const chosen = data.facets.map((f) => ({ f, picked: picked[f.key] ?? [] })).filter((c) => c.picked.length);
  if (!chosen.length) return null;

  const match: FinderItem[] = [];
  const maybe: [FinderItem, string][] = [];
  for (const it of data.items) {
    const missing: string[] = [];
    const weak: string[] = [];
    let excluded = false;
    for (const { f, picked: p } of chosen) {
      const have = it[5][f.key];
      if (!have) {
        missing.push(f.name);
        continue;
      }
      if (p.some((o) => have.includes(o))) continue;
      // 只选了"没看到"，它却有：不能排除
      if (f.weak && p.every((o) => f.options[o] === f.weak)) {
        weak.push(f.weakNote ?? f.name);
        continue;
      }
      excluded = true;
      break;
    }
    if (excluded) continue;
    if (!missing.length && !weak.length) match.push(it);
    else maybe.push([it, [...weak, ...(missing.length ? [`没有${missing.join('、')}记录`] : [])].join('；')]);
  }
  const deadly = [...match, ...maybe.map((m) => m[0])].filter((it) => it[3] === DEADLY);
  return { match, maybe, deadly };
}
