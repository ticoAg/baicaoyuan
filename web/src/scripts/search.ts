// 浏览器内搜索：中文名、别名、拼音（全拼 / 首字母）、学名。
// 索引是一个静态文件，第一次聚焦搜索框时才下载；不经过任何服务器。

import { glyphSvg, LEVEL_CODES, LEVELS } from '../lib/shared.js';
import { buildIndex, entryId, searchIndex, type Hit, type IndexFile, type Patch, type SearchIndex } from '../lib/match';

export type { Hit };

let index: Promise<SearchIndex> | null = null;

export function loadIndex() {
  index ??= Promise.all([
    fetch('/data/search.json').then((r) => {
      if (!r.ok) throw new Error(`search.json ${r.status}`);
      return r.json() as Promise<IndexFile>;
    }),
    // 后台改过、还没进索引的词条。取不到就不管；维护的人自己不走浏览器缓存，刚改的马上能搜到
    fetch('/api/overlay.json', document.cookie.includes('bcy_m=1') ? { cache: 'no-store' } : undefined)
      .then((r) => (r.ok ? (r.json() as Promise<{ rows: Patch[] }>) : { rows: [] }))
      .catch(() => ({ rows: [] as Patch[] })),
  ])
    .then(([d, overlay]) => buildIndex(d, overlay.rows))
    .catch((err) => {
      index = null;
      throw err;
    });
  return index;
}

export async function search(query: string, limit = 12): Promise<Hit[]> {
  if (!query.trim()) return [];
  return searchIndex(await loadIndex(), query, limit);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function renderHit(h: Hit, i: number): string {
  const code = LEVEL_CODES[h.e.level];
  const lv = LEVELS[code as keyof typeof LEVELS];
  const name = h.e.zh ? esc(h.e.zh) : `<i class="sci">${esc(h.e.sci)}</i>`;
  const via = h.via ? `<span class="via">别名：${esc(h.via)}</span>` : '';
  const sub = [h.e.zh ? `<i class="sci">${esc(h.e.sci)}</i>` : '', esc(h.e.fam), h.e.fungus ? '真菌' : ''].filter(Boolean).join(' · ');
  return (
    `<a class="hit" role="option" id="hit-${i}" href="/s/${entryId(h.e)}">` +
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
