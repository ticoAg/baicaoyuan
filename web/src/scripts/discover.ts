// 首页的随机物种：每次从 /data/featured/ 里随机取一个文件，挑几种填进卡片。

import { glyphSvg, LEVEL_CODES, LEVELS } from '../lib/shared.js';

type Item = [id: string, zh: string, sci: string, fam: string, level: number, thumb: string, credit: string];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** 大图用更大的尺寸。 */
const large = (thumb: string) => thumb.replace('width=500', 'width=960').replace('/medium.', '/large.');

function render(slot: HTMLAnchorElement, pool: Item[]) {
  const item = pool.pop();
  if (!item) return;
  const [id, zh, sci, fam, level, thumb, credit] = item;
  const key = LEVEL_CODES[level] as keyof typeof LEVELS;
  const lv = LEVELS[key];
  slot.href = `/s/${id}`;
  slot.className = `pick${slot.dataset.slot === 'big' ? ' big' : ''} tone-${lv.tone}`;
  slot.removeAttribute('aria-hidden');
  slot.removeAttribute('tabindex');
  slot.innerHTML =
    `<span class="pick-img"><img alt="${esc(zh)}的照片" decoding="async" referrerpolicy="no-referrer">` +
    `<span class="pick-lv lv tone-${lv.tone}"><span class="glyph">${glyphSvg(key)}</span>${lv.label}</span></span>` +
    `<span class="pick-body"><b>${esc(zh)}</b><i class="sci">${esc(sci)}</i><span class="pick-fam">${esc(fam)}</span></span>` +
    `<span class="pick-credit">图：${esc(credit)}</span>`;
  const img = slot.querySelector('img')!;
  img.onload = () => img.classList.add('ready');
  // 源站的图打不开时，换一种
  img.onerror = () => render(slot, pool);
  img.src = slot.dataset.slot === 'big' ? large(thumb) : thumb;
}

async function fill(shards: number) {
  const slots = [...document.querySelectorAll<HTMLAnchorElement>('[data-slot]')];
  const res = await fetch(`/data/featured/${Math.floor(Math.random() * shards)}.json`);
  if (!res.ok) throw new Error(`featured ${res.status}`);
  const pool: Item[] = await res.json();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  for (const slot of slots) render(slot, pool);
}

const root = document.querySelector<HTMLElement>('[data-shards]');
if (root) {
  const shards = Number(root.dataset.shards);
  const again = document.querySelector<HTMLButtonElement>('[data-again]');
  const run = async () => {
    if (again) again.disabled = true;
    try {
      await fill(shards);
    } catch {
      document.documentElement.classList.add('no-picks');
    } finally {
      if (again) again.disabled = false;
    }
  };
  again?.addEventListener('click', run);
  if (shards > 0) run();
  else document.documentElement.classList.add('no-picks');
}
