// 蘑菇特征检索的筛选。规则见 src/pages/finder.astro 和 scripts/build-data.mjs 里的 FINDER。
import data from '../generated/finder.json';
import { glyphSvg, LEVEL_CODES, LEVELS } from '../lib/shared.js';

type Facet = { key: string; name: string; options: string[]; weak?: string; weakNote?: string };
// [id, 中文名, 学名, 等级代码, 科, {特征: 选项序号[]}]，已按危险程度排好
type Item = [string, string, string, number, string, Record<string, number[]>];

const facets = data.facets as Facet[];
const items = data.items as unknown as Item[];
const DEADLY = LEVEL_CODES.indexOf('deadly');

const form = document.querySelector<HTMLFormElement>('[data-finder]');
const out = document.querySelector<HTMLElement>('[data-out]');
const status = document.querySelector<HTMLElement>('[data-status]');
const reset = form?.querySelector<HTMLButtonElement>('[data-reset]');

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const row = (it: Item, extra: string) => {
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
  const chosen = facets
    .map((f) => ({ f, picked: [...form.querySelectorAll<HTMLInputElement>(`input[name="${f.key}"]:checked`)].map((i) => Number(i.value)) }))
    .filter((c) => c.picked.length);
  if (reset) reset.hidden = !chosen.length;
  if (!chosen.length) {
    out.innerHTML = '';
    if (status) status.textContent = '';
    return;
  }

  const match: Item[] = [];
  const maybe: [Item, string][] = [];
  for (const it of items) {
    const missing: string[] = [];
    const weak: string[] = [];
    let excluded = false;
    for (const { f, picked } of chosen) {
      const have = it[5][f.key];
      if (!have) {
        missing.push(f.name);
        continue;
      }
      if (picked.some((p) => have.includes(p))) continue;
      // 只选了"没看到"，它却有：不能排除
      if (f.weak && picked.every((p) => f.options[p] === f.weak)) {
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
