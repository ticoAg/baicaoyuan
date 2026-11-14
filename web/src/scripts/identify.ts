// 拍照识别页：照片在浏览器里缩小、重新编码（顺带去掉拍摄位置等信息），再交给 /api/identify。

import { glyphSvg, LEVELS } from '../lib/shared.js';

interface Candidate {
  score: number;
  sci: string;
  fam?: string;
  names?: string[];
  id?: string;
  zh?: string;
  safety?: keyof typeof LEVELS;
  thumb?: string;
  credit?: string;
}

const MAX_PHOTOS = 4;
const MAX_SIDE = 1600;
const MESSAGES: Record<string, string> = {
  quota: '今天的识别次数用完了，明天再来。',
  bad_image: '这张照片读不了，换一张试试。',
  unavailable: '识别服务暂时用不了，稍后再试。',
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

async function shrink(file: File): Promise<Blob> {
  const src = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', 0.88));
  } finally {
    URL.revokeObjectURL(src);
  }
}

function candidate(c: Candidate): string {
  const pct = `${Math.round(c.score * 100)}%`;
  const lv = c.safety ? LEVELS[c.safety] : null;
  const name = c.zh ? esc(c.zh) : `<i class="sci">${esc(c.sci)}</i>`;
  const sub = [c.zh ? `<i class="sci">${esc(c.sci)}</i>` : '', ...(c.id ? [] : (c.names ?? [])).map(esc), c.fam ? esc(c.fam) : ''].filter(Boolean).join(' · ');
  const img = c.thumb ? `<img src="${esc(c.thumb)}" alt="" loading="lazy" onerror="this.remove()" />` : '';
  const inner =
    `<span class="cand-img">${img}</span>` +
    `<span class="cand-name">${name}</span>` +
    `<span class="cand-lv">${lv ? `<span class="lv tone-${lv.tone}"><span class="glyph">${glyphSvg(c.safety)}</span>${lv.label}</span>` : '未收录'}</span>` +
    `<span class="cand-sub">${sub}</span>` +
    `<span class="cand-meter"><span class="cand-score"><span style="width:${pct}"></span></span>${pct}</span>` +
    (c.thumb && c.credit ? `<span class="cand-credit">图：${esc(c.credit)}</span>` : '');
  return c.id ? `<li><a class="cand" href="/s/${esc(c.id)}">${inner}</a></li>` : `<li><span class="cand unknown">${inner}</span></li>`;
}

function attach(root: HTMLElement) {
  const input = root.querySelector<HTMLInputElement>('input[type=file]')!;
  const photos = root.querySelector<HTMLElement>('.shot-photos')!;
  const out = root.querySelector<HTMLElement>('.cands')!;
  const label = root.querySelector<HTMLElement>('.shoot b')!;
  let seq = 0;
  let previews: string[] = [];

  const say = (text: string) => (out.innerHTML = `<p class="cands-msg">${text}</p>`);

  input.addEventListener('change', async () => {
    const files = [...(input.files ?? [])].filter((f) => f.type.startsWith('image/') || !f.type).slice(0, MAX_PHOTOS);
    input.value = '';
    if (!files.length) return;
    const mine = ++seq;

    previews.forEach((u) => URL.revokeObjectURL(u));
    previews = files.map((f) => URL.createObjectURL(f));
    photos.innerHTML = previews.map((u) => `<img src="${u}" alt="" />`).join('');
    photos.dataset.n = String(previews.length);
    photos.hidden = false;
    root.classList.add('has-photo', 'busy');
    label.textContent = '换一张';
    say('识别中…');

    try {
      const form = new FormData();
      for (const blob of await Promise.all(files.map(shrink))) form.append('images', blob, 'photo.jpg');
      const res = await fetch('/api/identify', { method: 'POST', body: form });
      const data = (await res.json().catch(() => ({}))) as { results?: Candidate[]; error?: string };
      if (mine !== seq) return;
      if (!res.ok) say(MESSAGES[data.error ?? ''] ?? MESSAGES.unavailable);
      else if (!data.results?.length) say('没认出植物。对准叶、花或果，拍近一点再试。');
      else {
        const unsure = data.results[0].score < 0.2 ? '<p class="cands-msg">把握不大。换个角度，或者拍花和果再试。</p>' : '';
        out.innerHTML = `${unsure}<ol class="cand-list">${data.results.map(candidate).join('')}</ol>`;
      }
    } catch (err) {
      if (mine !== seq) return;
      say(err instanceof TypeError ? MESSAGES.unavailable : MESSAGES.bad_image);
    } finally {
      if (mine === seq) root.classList.remove('busy');
    }
  });
}

document.querySelectorAll<HTMLElement>('[data-identify]').forEach(attach);
