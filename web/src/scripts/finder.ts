// 特征检索的页面交互。筛选规则在 src/lib/finder.ts，和 App 共用；数据是搜索索引，和搜索框共用一份。
import built from '../generated/finder.json';
import { filterFinder, isGroup, type Facets, type Group, type Picked } from '../lib/finder';
import { entryId, type Entry } from '../lib/match';
import { glyphSvg, LEVEL_CODES, LEVELS } from '../lib/shared.js';
import { loadIndex } from './search';

const PAGE = 100;
const KEY = 'bcy-finder-group';

const form = document.querySelector<HTMLFormElement>('[data-finder]');
const out = document.querySelector<HTMLElement>('[data-out]');
const status = document.querySelector<HTMLElement>('[data-status]');
const clear = form?.querySelector<HTMLButtonElement>('[data-clear]');

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const row = (e: Entry, extra: string) => {
  const code = (LEVEL_CODES[e.level] ?? 'unknown') as keyof typeof LEVELS;
  const lv = LEVELS[code];
  return (
    `<li><a href="/s/${encodeURIComponent(entryId(e))}">` +
    `<span class="lv tone-${lv.tone}" title="${lv.label}：${lv.hint}"><span class="glyph">${glyphSvg(code)}</span><span class="visually-hidden">${lv.label}</span></span>` +
    `<span class="zh">${esc(e.zh || e.sci)}</span><span class="sci">${e.zh ? esc(e.sci) : ''}</span><span class="extra">${esc(extra)}</span></a></li>`
  );
};

let index: Awaited<ReturnType<typeof loadIndex>> | null = null;
let failed = false;
let shown = { match: PAGE, maybe: PAGE };

const group = (): Group | null => {
  const v = form?.querySelector<HTMLInputElement>('input[name="group"]:checked')?.value;
  return isGroup(v) ? v : null;
};

function picked(g: Group): Picked {
  const p: Picked = {};
  for (const f of built.facets[g]) p[f.key] = [...form!.querySelectorAll<HTMLInputElement>(`input[name="${f.key}"]:checked`)].map((i) => Number(i.value));
  return p;
}

function section(title: string, n: number, items: string, more: keyof typeof shown, total: number) {
  const button = total > shown[more] ? `<p><button type="button" class="btn" data-more="${more}">再显示 ${Math.min(PAGE, total - shown[more])} 种</button></p>` : '';
  return `<section class="section"><h2>${title}<span class="count">${n.toLocaleString('zh-CN')} 种</span></h2>${items}${button}</section>`;
}

function update() {
  if (!form || !out) return;
  const g = group();
  for (const fs of form.querySelectorAll<HTMLElement>('fieldset[data-group]')) fs.hidden = fs.dataset.group !== g;
  const p = g ? picked(g) : {};
  const any = Object.values(p).some((x) => x.length);
  if (clear) clear.hidden = !any;
  const say = (html: string, text = '') => {
    out.innerHTML = html;
    if (status) status.textContent = text;
  };
  if (!g || !any) return say('');
  if (!index) return say(`<p class="note">${failed ? '检索数据没下载下来，连上网后刷新页面再试。' : '正在准备检索数据…'}</p>`);
  // 页面和数据不是同一次构建的（比如页面是缓存里的旧版），选项的序号可能对不上
  if (JSON.stringify(index.facets) !== JSON.stringify(built.facets as Facets)) return say('<p class="note">检索数据更新了，刷新页面再试。</p>');

  const r = filterFinder(index, g, p)!;
  const { match, maybe, deadly } = r;
  say(
    [
      deadly.length
        ? `<p class="finder-alarm">候选里有 ${deadly.length} 种致命的：${deadly
            .slice(0, 8)
            .map((e) => `<a href="/s/${encodeURIComponent(entryId(e))}">${esc(e.zh || e.sci)}</a>`)
            .join('、')}${deadly.length > 8 ? ' 等' : ''}</p>`
        : '',
      section(
        '符合',
        match.length,
        match.length ? `<ul class="species-list flat">${match.slice(0, shown.match).map((e) => row(e, e.fam)).join('')}</ul>` : '<p class="note">没有符合的。</p>',
        'match',
        match.length,
      ),
      maybe.length
        ? section('无法排除', maybe.length, `<ul class="species-list flat">${maybe.slice(0, shown.maybe).map(([e, why]) => row(e, why)).join('')}</ul>`, 'maybe', maybe.length)
        : '',
    ].join(''),
    `符合 ${match.length} 种，无法排除 ${maybe.length} 种${deadly.length ? `，其中 ${deadly.length} 种致命` : ''}`,
  );
}

const restart = () => {
  shown = { match: PAGE, maybe: PAGE };
  update();
};

if (form) {
  // 先选哪一类：链接里的 ?k= 优先，其次是上次选的
  let start = new URLSearchParams(location.search).get('k');
  if (!isGroup(start)) {
    try {
      start = localStorage.getItem(KEY);
    } catch {}
  }
  if (isGroup(start) && !group()) form.querySelector<HTMLInputElement>(`input[name="group"][value="${start}"]`)!.checked = true;

  form.addEventListener('change', (ev) => {
    const g = group();
    if ((ev.target as HTMLInputElement).name === 'group' && g) {
      try {
        localStorage.setItem(KEY, g);
      } catch {}
      history.replaceState(null, '', `?k=${g}`);
    }
    restart();
  });
  clear?.addEventListener('click', () => {
    const g = group();
    if (g) for (const f of built.facets[g]) for (const i of form.querySelectorAll<HTMLInputElement>(`input[name="${f.key}"]`)) i.checked = false;
    restart();
  });
  out?.addEventListener('click', (ev) => {
    const more = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-more]')?.dataset.more as keyof typeof shown | undefined;
    if (!more) return;
    shown[more] += PAGE;
    update();
  });
  // 返回本页时浏览器会恢复勾选状态
  addEventListener('pageshow', update);
  update();
  loadIndex().then(
    (i) => {
      index = i;
      update();
    },
    () => {
      failed = true;
      update();
    },
  );
}
