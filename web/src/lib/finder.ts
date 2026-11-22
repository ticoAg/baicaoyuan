// 特征检索的筛选规则。网站和 App 共用，不依赖运行环境。
// 先选植物还是蘑菇，再按这一类的特征筛。各物种的特征码在搜索索引里（/data/search.json），
// 选项和数据里写法的对应关系见 scripts/build-data.mjs 的 FINDER。
//
// 同一项里多选是"或"，不同项之间是"且"。
// 某项没有记录的种类不排除，放进"无法排除"；只选了"没看到"菌环或菌托时，有的种类也放进"无法排除"。

import type { Entry } from './match';
import { LEVEL_CODES } from './shared.js';

export type Group = 'plant' | 'fungus';
export const GROUPS: [Group, string][] = [
  ['plant', '植物'],
  ['fungus', '蘑菇'],
];
export const isGroup = (g: unknown): g is Group => g === 'plant' || g === 'fungus';

export interface Facet { key: string; name: string; options: string[]; weak?: string; weakNote?: string }
export type Facets = Record<Group, Facet[]>;
/** 每一项选了哪些选项（选项序号）。 */
export type Picked = Record<string, number[]>;
export interface FinderResult {
  match: Entry[];
  /** [种类, 为什么不能排除] */
  maybe: [Entry, string][];
  /** 符合和无法排除里致命的种类 */
  deadly: Entry[];
}
type Index = { entries: Entry[]; facets: Facets };

const DEADLY = LEVEL_CODES.indexOf('deadly');

/**
 * 特征码 → {项: 选项序号[]}。码是这一类的各项依次排开，用 | 分隔；
 * 每项是选项序号（36 进制，一位一个），"-" 是有记录但不属于任何选项，空着是没有记录（不出现在结果里）。
 */
export function decodeTraits(facets: Facet[], code: string): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  if (!code) return out;
  code.split('|').forEach((part, i) => {
    const f = facets[i];
    if (f && part) out[f.key] = part === '-' ? [] : [...part].map((ch) => parseInt(ch, 36));
  });
  return out;
}

const prepared = new WeakMap<Index, Record<Group, [Entry, Record<string, number[]>][]>>();

/** 一类物种，按危险程度排好、特征码解开。同一份索引只算一次。 */
function groupOf(index: Index, group: Group) {
  let all = prepared.get(index);
  if (!all) {
    const sorted = [...index.entries].sort(
      (a, b) => b.level - a.level || Number(!a.zh) - Number(!b.zh) || (a.sci < b.sci ? -1 : a.sci > b.sci ? 1 : 0),
    );
    const make = (g: Group) =>
      sorted.filter((e) => e.fungus === (g === 'fungus')).map((e): [Entry, Record<string, number[]>] => [e, decodeTraits(index.facets[g], e.feat)]);
    all = { plant: make('plant'), fungus: make('fungus') };
    prepared.set(index, all);
  }
  return all[group];
}

/** 这一类里有特征记录的种数。 */
export const recordedCount = (index: Index, group: Group) => groupOf(index, group).filter(([, t]) => Object.keys(t).length).length;

/** 这一类什么特征都没选时返回 null。 */
export function filterFinder(index: Index, group: Group, picked: Picked): FinderResult | null {
  const chosen = index.facets[group].map((f) => ({ f, picked: picked[f.key] ?? [] })).filter((c) => c.picked.length);
  if (!chosen.length) return null;

  const match: Entry[] = [];
  const maybe: [Entry, string][] = [];
  for (const [e, traits] of groupOf(index, group)) {
    const missing: string[] = [];
    const weak: string[] = [];
    let excluded = false;
    for (const { f, picked: p } of chosen) {
      const have = traits[f.key];
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
    if (!missing.length && !weak.length) match.push(e);
    else maybe.push([e, [...weak, ...(missing.length ? [`没有${missing.join('、')}记录`] : [])].join('；')]);
  }
  const deadly = [...match, ...maybe.map((m) => m[0])].filter((e) => e.level === DEADLY);
  return { match, maybe, deadly };
}
