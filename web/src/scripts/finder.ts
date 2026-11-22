// 蘑菇特征检索的页面交互。筛选规则在 src/lib/finder.ts，和 App 共用。
import data from '../generated/finder.json';
import { filterFinder, type FinderData, type FinderItem, type Picked } from '../lib/finder';
import { glyphSvg, LEVEL_CODES, LEVELS } from '../lib/shared.js';

const finder = data as unknown as FinderData;

const form = document.querySelector<HTMLFormElement>('[data-finder]');
const out = document.querySelector<HTMLElement>('[data-out]');
const status = document.querySelector<HTMLElement>('[data-status]');
const reset = form?.querySelector<HTMLButtonElement>('[data-reset]');

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const row = (it: FinderItem, extra: string) => {
  const code = (LEVEL_CODES[it[3]] ?? 'unknown') as keyof typeof LEVELS;
  const lv = LEVELS[code];
  return (
    `<li><a href="/s/${encodeURIComponent(it[0])}">` +
    `<span class="lv tone-${lv.tone}" title="${lv.label}：${lv.hint}"><span class="glyph">${glyphSvg(code)}</span><span class="visually-hidden">${lv.label}</span></span>` +
    `<span class="zh">${esc(it[1])}</span><span class="sci">${esc(it[2])}</span><span class="extra">${esc(extra)}</span></a></li>`
  );
};
const list = (rows: string[]) => `<ul class="species-list flat">${rows.join('')}</ul>`;

function update() {
  if (!form || !out) return;
  const picked: Picked = {};
  for (const f of finder.facets) picked[f.key] = [...form.querySelectorAll<HTMLInputElement>(`input[name="${f.key}"]:checked`)].map((i) => Number(i.value));
  const r = filterFinder(finder, picked);
  if (reset) reset.hidden = !r;
  if (!r) {
    out.innerHTML = '';
    if (status) status.textContent = '';
    return;
  }
  const { match, maybe, deadly } = r;
  out.innerHTML = [
    deadly.length
      ? `<p class="finder-alarm">候选里有 ${deadly.length} 种致命的：${deadly
          .slice(0, 8)
          .map((it) => `<a href="/s/${encodeURIComponent(it[0])}">${esc(it[1])}</a>`)
          .join('、')}${deadly.length > 8 ? ' 等' : ''}</p>`
      : '',
    `<section class="section"><h2>符合<span class="count">${match.length} 种</span></h2>${
      match.length ? list(match.map((it) => row(it, it[4]))) : '<p class="note">没有符合的。</p>'
    }</section>`,
    maybe.length ? `<section class="section"><h2>无法排除<span class="count">${maybe.length} 种</span></h2>${list(maybe.map(([it, why]) => row(it, why)))}</section>` : '',
  ].join('');
  if (status) status.textContent = `符合 ${match.length} 种，无法排除 ${maybe.length} 种${deadly.length ? `，其中 ${deadly.length} 种致命` : ''}`;
}

form?.addEventListener('change', update);
// reset 事件在表单清空之前触发
form?.addEventListener('reset', () => setTimeout(update));
// 返回本页时浏览器会恢复勾选状态
addEventListener('pageshow', update);
update();
