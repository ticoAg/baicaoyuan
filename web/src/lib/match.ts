// 名称搜索：中文名、别名、拼音（全拼 / 首字母）、学名。网站和 App 共用，不依赖运行环境。
// 索引是 /data/search.json，见 scripts/build-data.mjs。

import { slugOf } from './shared.js';

/** 索引的一行：[学名, 中文名, 别名（| 分隔）, 科, 等级代码, 是否真菌] */
export type Row = [sci: string, zh: string | 0, alias: string | 0, fam: string | 0, level: number, kingdom: number];
/** 后台改过、还没进索引的词条（/api/overlay.json）。 */
export type Patch = [id: string, ...Row];
export interface IndexFile { rows: Row[]; py: Record<string, string> }

export interface Entry {
  /** 只有后台改过的词条带；其余的由学名算出。 */
  id?: string;
  sci: string;
  sciLower: string;
  zh: string;
  alias: string[];
  fam: string;
  level: number;
  fungus: boolean;
}
export interface Hit {
  e: Entry;
  score: number;
  /** 命中的是别名时，显示它 */
  via?: string;
}
export interface SearchIndex { entries: Entry[]; py: Record<string, string[]> }

const entry = (r: Row, id?: string): Entry => ({
  id,
  sci: r[0],
  sciLower: r[0].toLowerCase(),
  zh: r[1] || '',
  alias: r[2] ? r[2].split('|') : [],
  fam: r[3] || '',
  level: r[4],
  fungus: r[5] === 1,
});

/** 物种页的 id。 */
export const entryId = (e: Entry) => e.id ?? slugOf(e.sci);

export function buildIndex(data: IndexFile, overlay: Patch[] = []): SearchIndex {
  const entries = data.rows.map((r) => entry(r));
  if (overlay.length) {
    const at = new Map(entries.map((e, i) => [slugOf(e.sci), i]));
    for (const [id, ...row] of overlay) {
      const i = at.get(id);
      if (i == null) entries.push(entry(row, id));
      else entries[i] = entry(row, id);
    }
  }
  return { entries, py: Object.fromEntries(Object.entries(data.py).map(([k, v]) => [k, v.split(',')])) };
}

/** 拼音匹配：从名称开头起，每个字可以用全拼或首字母；最后一个音节可以只打一半。 */
export function pinyinMatch(name: string, q: string, py: Record<string, string[]>): boolean {
  const first = py[name[0]];
  if (!first || !first.some((r) => r[0] === q[0])) return false;
  const walk = (i: number, j: number): boolean => {
    if (j >= q.length) return true;
    if (i >= name.length) return false;
    const readings = py[name[i]];
    if (!readings) return false;
    for (const r of readings) {
      if (q.startsWith(r, j) && walk(i + 1, j + r.length)) return true;
      if (r.startsWith(q.slice(j))) return true;
      if (q[j] === r[0] && walk(i + 1, j + 1)) return true;
    }
    return false;
  };
  return walk(0, 0);
}

export function searchIndex({ entries, py }: SearchIndex, query: string, limit = 12): Hit[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return [];
  const latin = /^[a-z .×-]+$/.test(q);
  const compact = q.replace(/[ .-]/g, '');
  const hits: Hit[] = [];

  for (const e of entries) {
    let score = 0;
    let via: string | undefined;
    if (latin) {
      if (e.sciLower === q) score = 100;
      else if (e.sciLower.startsWith(q)) score = 90;
      else if (e.sciLower.includes(' ' + q)) score = 70;
      else if (q.length >= 4 && e.sciLower.includes(q)) score = 30;
      if (score < 66 && compact.length >= 2 && /^[a-z]+$/.test(compact)) {
        if (e.zh && pinyinMatch(e.zh, compact, py)) score = Math.max(score, 66 - Math.min(e.zh.length, 6));
        else {
          for (const a of e.alias) {
            if (pinyinMatch(a, compact, py)) {
              if (score < 44) { score = 44; via = a; }
              break;
            }
          }
        }
      }
    } else {
      if (e.zh === q) score = 100;
      else if (e.zh.startsWith(q)) score = 82 - Math.min(e.zh.length - q.length, 8);
      else if (e.zh.includes(q)) score = 62 - Math.min(e.zh.length - q.length, 8);
      for (const a of e.alias) {
        let s = 0;
        if (a === q) s = 74;
        else if (a.startsWith(q)) s = 52;
        else if (a.includes(q)) s = 40;
        if (s > score) { score = s; via = a; }
      }
    }
    if (score) {
      score += e.level > 0 ? 2 + e.level / 10 : 0; // 有内容的排前，越危险越靠前
      hits.push({ e, score, via });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
