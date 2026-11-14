// 维护后台的表单：登录、保存、删除。

import { shrink } from './shrink';

const MESSAGES: Record<string, string> = {
  wrong: '密码不对。',
  locked: '试错太多次，明天再试。',
  login: '登录过期了，请重新登录。',
  sci: '学名要写成"属名 种加词"，如 Toona sinensis。',
  gen: '属名要用拉丁字母。',
  author: '上传的图片要写作者。',
  license: '上传的图片要选许可。',
  image: '这张照片存不了，换一张试试。',
};
const say = (form: HTMLElement, text: string) => (form.querySelector<HTMLElement>('.form-msg')!.textContent = text);

async function send(form: HTMLElement, input: RequestInfo, init: RequestInit): Promise<Record<string, string> | null> {
  const button = form.querySelector<HTMLButtonElement>('button.primary');
  if (button) button.disabled = true;
  say(form, '');
  try {
    const res = await fetch(input, init);
    const data = (await res.json().catch(() => ({}))) as Record<string, string>;
    if (res.ok) return data;
    if (data.error === 'exists') {
      form.querySelector('.form-msg')!.innerHTML = `这个学名已经有词条了，<a href="/admin/edit?id=${encodeURIComponent(data.id)}">去编辑它</a>。`;
    } else say(form, MESSAGES[data.field ?? data.error] ?? '没有保存成功，稍后再试。');
  } catch {
    say(form, '网络不通，稍后再试。');
  }
  if (button) button.disabled = false;
  return null;
}

// 登录、退出
const login = document.querySelector<HTMLFormElement>('[data-login]');
login?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const password = new FormData(login).get('password');
  if (await send(login, '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) })) location.reload();
});
document.querySelector('[data-logout]')?.addEventListener('click', async () => {
  await fetch('/api/admin/login', { method: 'DELETE' });
  location.reload();
});

// 后台首页的搜索结果点进编辑页
document.querySelector('.admin-find')?.addEventListener(
  'click',
  (ev) => {
    const hit = (ev.target as HTMLElement).closest<HTMLAnchorElement>('a.hit');
    if (!hit) return;
    ev.preventDefault();
    location.href = `/admin/edit?id=${hit.pathname.slice('/s/'.length)}`;
  },
  true,
);

// 编辑
const edit = document.querySelector<HTMLFormElement>('[data-edit]');
if (edit) {
  const id = edit.dataset.id!;
  const field = (name: string) => edit.elements.namedItem(name) as HTMLInputElement;
  const preview = edit.querySelector<HTMLImageElement>('[data-preview]')!;
  const credit = edit.querySelector<HTMLElement>('.credit')!;
  let photo: File | null = null;
  let dropped = false;

  // 科的候选；选中已有的科时带出中文名
  const families = new Map<string, string>();
  fetch('/data/families.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((rows: [string, string | 0][]) => {
      for (const [name, zh] of rows) families.set(name, zh || '');
      edit.querySelector('datalist')!.innerHTML = rows.map(([name, zh]) => `<option value="${name}">${zh || ''}</option>`).join('');
    })
    .catch(() => {});
  field('fam').addEventListener('change', () => {
    const zh = families.get(field('fam').value.trim());
    if (zh && !field('famZh').value) field('famZh').value = zh;
  });

  // 新建时，填完学名按属名带出科属
  if (!id) {
    field('sci').addEventListener('change', async () => {
      const genus = field('sci').value.trim().split(/\s+/)[0] ?? '';
      if (!/^[A-Z][a-z-]+$/.test(genus)) return;
      if (!field('gen').value) field('gen').value = genus;
      const known = (await fetch(`/api/admin/genus?name=${genus}`).then((r) => r.json()).catch(() => ({}))) as Record<string, string>;
      for (const key of ['fam', 'famZh', 'genZh']) if (known[key] && !field(key).value) field(key).value = known[key];
      if (known.k) field('k').form!.querySelector<HTMLInputElement>(`input[name=k][value=${known.k}]`)!.checked = true;
    });
  }

  field('image').addEventListener('change', () => {
    photo = field('image').files?.[0] ?? null;
    if (!photo) return;
    dropped = false;
    preview.src = URL.createObjectURL(photo);
    preview.hidden = false;
    credit.hidden = false;
  });
  edit.querySelector('[data-drop-image]')?.addEventListener('click', (ev) => {
    dropped = true;
    photo = null;
    preview.hidden = true;
    credit.hidden = true;
    (ev.target as HTMLElement).hidden = true;
  });

  edit.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const value = (name: string) => field(name)?.value.trim() ?? '';
    const data = {
      id: id || undefined,
      sci: id ? undefined : value('sci'),
      k: new FormData(edit).get('k'),
      zh: value('zh'),
      alias: value('alias').split(/[、，,;；\n]+/).map((a) => a.trim()).filter(Boolean),
      fam: value('fam'),
      famZh: value('famZh'),
      gen: value('gen'),
      genZh: value('genZh'),
      img: dropped ? null : { author: value('author'), license: value('license'), page: value('page') },
    };
    const body = new FormData();
    body.append('data', JSON.stringify(data));
    if (photo) {
      try {
        const [big, small] = await Promise.all([shrink(photo, 1600), shrink(photo, 500, 0.82)]);
        body.append('image', big, 'photo.jpg');
        body.append('thumb', small, 'thumb.jpg');
      } catch {
        return say(edit, MESSAGES.image);
      }
    }
    const saved = await send(edit, '/api/admin/species', { method: 'POST', body });
    // 带一个参数，绕开浏览器里缓存的旧页面
    if (saved) location.href = `/s/${saved.id}?t=${Date.now()}`;
  });

  edit.querySelector('[data-remove]')?.addEventListener('click', async (ev) => {
    if (!confirm(`${(ev.target as HTMLElement).textContent}？`)) return;
    if (await send(edit, `/api/admin/species?id=${encodeURIComponent(id)}`, { method: 'DELETE' })) location.href = '/admin/';
  });
}
