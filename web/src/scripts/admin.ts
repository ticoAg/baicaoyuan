// 维护后台的表单：登录、申请、审批、保存、删除。

import { shrink } from './shrink';

const MAX_IMAGES = 8;
const MESSAGES: Record<string, string> = {
  wrong: '名字或密码不对。',
  pending: '申请还没有通过。',
  locked: '今天试的次数太多，明天再来。',
  login: '登录过期了，请重新登录。',
  admin_only: '只有管理员能这样做。',
  taken: '这个名字已经有人用了。',
  full: '申请太多，暂时收不下，过几天再来。',
  name: '名字用 2 到 20 个字，不带空格和符号。',
  password: '密码至少 8 位。',
  contact: '留一个联系方式。',
  reason: '写一下想维护什么。',
  sci: '学名要写成"属名 种加词"，如 Toona sinensis。',
  gen: '属名要用拉丁字母。',
  author: '每张图片都要写作者。',
  license: '每张图片都要选许可。',
  image: '有一张照片存不了，换一张试试。',
};
const say = (form: HTMLElement, text: string) => (form.querySelector<HTMLElement>('.form-msg')!.textContent = text);
const JSON_HEADERS = { 'content-type': 'application/json' };

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
    } else say(form, MESSAGES[data.field ?? data.error] ?? '没有成功，稍后再试。');
  } catch {
    say(form, '网络不通，稍后再试。');
  }
  if (button) button.disabled = false;
  return null;
}
const fields = (form: HTMLFormElement) => Object.fromEntries(new FormData(form)) as Record<string, string>;

// 登录、退出
const login = document.querySelector<HTMLFormElement>('[data-login]');
login?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (await send(login, '/api/admin/login', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(fields(login)) })) location.reload();
});
document.querySelector('[data-logout]')?.addEventListener('click', async () => {
  await fetch('/api/admin/login', { method: 'DELETE' });
  location.reload();
});

// 申请
const apply = document.querySelector<HTMLFormElement>('[data-apply]');
apply?.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!(await send(apply, '/api/admin/apply', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(fields(apply)) }))) return;
  apply.hidden = true;
  document.querySelector<HTMLElement>('[data-applied]')!.hidden = false;
});

// 管理员处理申请和维护者
document.querySelectorAll<HTMLElement>('[data-user]').forEach((row) => {
  const name = row.dataset.user!;
  row.querySelector('[data-approve]')?.addEventListener('click', async () => {
    await fetch('/api/admin/users', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name }) });
    location.reload();
  });
  row.querySelector('[data-reject]')?.addEventListener('click', async (ev) => {
    if (!confirm(`${(ev.target as HTMLElement).textContent} ${name}？`)) return;
    await fetch(`/api/admin/users?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
    location.reload();
  });
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
  const shots = edit.querySelector<HTMLElement>('[data-shots]')!;
  const blank = edit.querySelector<HTMLTemplateElement>('[data-shot]')!;
  /** 新选的照片，还没上传。 */
  const fresh = new WeakMap<Element, File>();

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
      if (known.k) edit.querySelector<HTMLInputElement>(`input[name=k][value=${known.k}]`)!.checked = true;
    });
  }

  // 图片：选了就加一张卡片，保存时才上传
  field('image').addEventListener('change', () => {
    const lastAuthor = [...shots.querySelectorAll<HTMLInputElement>('[data-f=author]')].at(-1)?.value;
    for (const file of [...(field('image').files ?? [])]) {
      if (shots.children.length >= MAX_IMAGES) break;
      const card = (blank.content.cloneNode(true) as DocumentFragment).firstElementChild!;
      card.querySelector('img')!.src = URL.createObjectURL(file);
      card.querySelector<HTMLInputElement>('[data-f=author]')!.value = lastAuthor || edit.dataset.me || '';
      fresh.set(card, file);
      shots.append(card);
    }
    field('image').value = '';
  });
  shots.addEventListener('click', (ev) => {
    const button = (ev.target as HTMLElement).closest('button');
    const card = button?.closest('.shot-card');
    if (!button || !card) return;
    if (button.hasAttribute('data-drop')) card.remove();
    else if (button.hasAttribute('data-first')) shots.prepend(card);
  });

  edit.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const value = (name: string) => field(name)?.value.trim() ?? '';
    const body = new FormData();
    const images = [];
    try {
      for (const card of shots.children) {
        const of = (f: string) => card.querySelector<HTMLInputElement>(`[data-f=${f}]`)!.value.trim();
        const credit = { author: of('author'), license: of('license'), page: of('page') };
        const file = fresh.get(card);
        if (!file) images.push({ url: (card as HTMLElement).dataset.url, ...credit });
        else {
          const n = images.length;
          const [big, small] = await Promise.all([shrink(file, 1600), shrink(file, 500, 0.82)]);
          body.append(`image${n}`, big, 'photo.jpg');
          body.append(`thumb${n}`, small, 'thumb.jpg');
          images.push({ file: n, ...credit });
        }
      }
    } catch {
      return say(edit, MESSAGES.image);
    }
    body.append(
      'data',
      JSON.stringify({
        id: id || undefined,
        sci: id ? undefined : value('sci'),
        k: new FormData(edit).get('k'),
        zh: value('zh'),
        alias: value('alias').split(/[、，,;；\n]+/).map((a) => a.trim()).filter(Boolean),
        fam: value('fam'),
        famZh: value('famZh'),
        gen: value('gen'),
        genZh: value('genZh'),
        images,
        hideDataImage: !!field('hideDataImage')?.checked,
      }),
    );
    const saved = await send(edit, '/api/admin/species', { method: 'POST', body });
    // 带一个参数，绕开浏览器里缓存的旧页面
    if (saved) location.href = `/s/${saved.id}?t=${Date.now()}`;
  });

  edit.querySelector('[data-remove]')?.addEventListener('click', async (ev) => {
    if (!confirm(`${(ev.target as HTMLElement).textContent}？`)) return;
    if (await send(edit, `/api/admin/species?id=${encodeURIComponent(id)}`, { method: 'DELETE' })) location.href = '/admin/';
  });
}
