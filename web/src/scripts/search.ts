// 浏览器内搜索：中文名、别名、拼音（全拼 / 首字母）、学名。
// 索引是一个静态文件，第一次聚焦搜索框时才下载；不经过任何服务器。

import { glyphSvg, LEVEL_CODES, LEVELS, slugOf } from '../lib/shared.js';

type Row = [sci: string, zh: string | 0, alias: string | 0, fam: string | 0, level: number, kingdom: number];
interface Entry {
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
  via?: string; // 命中的是别名时，显示它
}

let index: Promise<{ entries: Entry[]; py: Record<string, string[]> }> | null = null;

export function loadIndex() {
  index ??= fetch('/data/search.json')
    .then((r) => {
      if (!r.ok) throw new Error(`search.json ${r.status}`);
      return r.json();
    })
    .then((d: { rows: Row[]; py: Record<string, string> }) => ({
      entries: d.rows.map((r) => ({
        sci: r[0],
        sciLower: r[0].toLowerCase(),
        zh: r[1] || '',
        alias: r[2] ? r[2].split('|') : [],
        fam: r[3] || '',
        level: r[4],
        fungus: r[5] === 1,
      })),
      py: Object.fromEntries(Object.entries(d.py).map(([k, v]) => [k, v.split(',')])),
    }))
    .catch((err) => {
      index = null;
      throw err;
    });
  return index;
}

/** 拼音匹配：从名称开头起，每个字可以用全拼或首字母；最后一个音节可以只打一半。 */
function pinyinMatch(name: string, q: string, py: Record<string, string[]>): boolean {
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

export async function search(query: string, limit = 12): Promise<Hit[]> {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return [];
  const { entries, py } = await loadIndex();
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

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function renderHit(h: Hit, i: number): string {
  const code = LEVEL_CODES[h.e.level];
  const lv = LEVELS[code as keyof typeof LEVELS];
  const name = h.e.zh ? esc(h.e.zh) : `<i class="sci">${esc(h.e.sci)}</i>`;
  const via = h.via ? `<span class="via">别名：${esc(h.via)}</span>` : '';
  const sub = [h.e.zh ? `<i class="sci">${esc(h.e.sci)}</i>` : '', esc(h.e.fam), h.e.fungus ? '真菌' : ''].filter(Boolean).join(' · ');
  return (
    `<a class="hit" role="option" id="hit-${i}" href="/s/${slugOf(h.e.sci)}">` +
    `<span class="g lv tone-${lv.tone}">${glyphSvg(code)}</span>` +
    `<span class="n">${name}${via}</span><span class="l lv tone-${lv.tone}">${lv.label}</span>` +
    `<span class="s">${sub}</span></a>`
  );
}

function attach(form: HTMLFormElement) {
  const input = form.querySelector<HTMLInputElement>('input')!;
  const panel = form.querySelector<HTMLElement>('.search-panel')!;
  let active = -1;
  let seq = 0;

  const close = () => {
    panel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    active = -1;
  };
  const select = (i: number) => {
    const items = panel.querySelectorAll<HTMLElement>('.hit');
    items.forEach((el, k) => el.setAttribute('aria-selected', String(k === i)));
    active = i;
    if (i >= 0) {
      items[i]?.scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', `hit-${i}`);
    } else input.removeAttribute('aria-activedescendant');
  };
  const run = async () => {
    const q = input.value;
    const mine = ++seq;
    if (!q.trim()) return close();
    try {
      const hits = await search(q);
      if (mine !== seq) return;
      panel.innerHTML = hits.length
        ? hits.map(renderHit).join('') + `<div class="empty">回车查看全部结果</div>`
        : `<div class="empty">没有找到「${esc(q)}」。试试别名、拼音或学名。</div>`;
    } catch {
      panel.innerHTML = `<div class="empty">搜索索引加载失败，请检查网络后重试。</div>`;
    }
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    select(-1);
  };

  input.addEventListener('focus', () => {
    loadIndex().catch(() => {});
    if (input.value.trim()) run();
  });
  input.addEventListener('input', run);
  input.addEventListener('keydown', (ev) => {
    const n = panel.querySelectorAll('.hit').length;
    if (ev.key === 'ArrowDown' && n) { ev.preventDefault(); select((active + 1) % n); }
    else if (ev.key === 'ArrowUp' && n) { ev.preventDefault(); select((active - 1 + n) % n); }
    else if (ev.key === 'Enter' && active >= 0) {
      ev.preventDefault();
      panel.querySelectorAll<HTMLAnchorElement>('.hit')[active]?.click();
    } else if (ev.key === 'Escape') { close(); input.blur(); }
  });
  document.addEventListener('click', (ev) => {
    if (!form.contains(ev.target as Node)) close();
  });
}

document.querySelectorAll<HTMLFormElement>('form[data-search]').forEach(attach);
document.addEventListener('keydown', (ev) => {
  const t = ev.target as HTMLElement;
  if (ev.key === '/' && !ev.metaKey && !ev.ctrlKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) {
    ev.preventDefault();
    document.querySelector<HTMLInputElement>('form[data-search] input')?.focus();
  }
});

// 列表页上的"在本页筛选"
document.querySelectorAll<HTMLInputElement>('input[data-filter]').forEach((input) => {
  const groups = [...document.querySelectorAll<HTMLElement>('[data-group]')];
  const items = [...document.querySelectorAll<HTMLElement>('[data-f]')];
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    for (const el of items) el.hidden = !!q && !el.dataset.f!.includes(q);
    for (const g of groups) g.hidden = !!q && !g.querySelector('[data-f]:not([hidden])');
  });
});
