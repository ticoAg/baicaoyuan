// 后台保存、删除一个词条的改动。
//
// 已有的物种只存和数据不一样的字段，所以数据更新时没改过的字段照常更新；
// 新建的词条整份存在 edits 表里。图片存 R2，词条里记它们的地址、作者和许可，顺序就是显示的顺序。
// 每次保存在 edit_log 里留一条记录。

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { guard, LICENSES, purge, reply, SESSION } from '../../../lib/admin';
import { slugOf } from '../../../lib/shared.js';
import { validId, type Img, type Species } from '../../../lib/species';

export const prerender = false;

const MAX_IMAGE = 3 * 1024 * 1024;
const MAX_IMAGES = 8;
const TEXT = ['zh', 'fam', 'famZh', 'gen', 'genZh'] as const;

interface ImageInput {
  /** 已经传过的图，用它的地址指认。 */
  url?: string;
  /** 这次新传的图，在表单里叫 image{n} 和 thumb{n}。 */
  file?: number;
  author?: string;
  license?: string;
  page?: string;
}
interface Input {
  id?: string;
  sci?: string;
  k?: string;
  zh?: string;
  alias?: string[];
  fam?: string;
  famZh?: string;
  gen?: string;
  genZh?: string;
  images?: ImageInput[];
  /** 不显示数据里自带的那张图。 */
  hideDataImage?: boolean;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const latin = (v: unknown) => (/^[A-Za-z][A-Za-z-]{1,40}$/.test(text(v, 41)) ? text(v, 41) : '');
const bad = (field: string) => reply({ error: 'invalid', field }, 400);
const jpeg = (x: ArrayBuffer) => x.byteLength > 100 && x.byteLength <= MAX_IMAGE && new Uint8Array(x, 0, 2).join() === '255,216';
const keyOf = (url: string) => url.slice('/img/'.length);

async function removeImages(id: string, keep: string[] = []) {
  const { objects } = await env.IMAGES.list({ prefix: `${id}/` });
  const gone = objects.map((o) => o.key).filter((k) => !keep.includes(k));
  if (gone.length) await env.IMAGES.delete(gone);
}
const log = (id: string, who: string, at: string, patch: string | null) =>
  env.DB.prepare('INSERT INTO edit_log (id, who, at, patch) VALUES (?1, ?2, ?3, ?4)').bind(id, who, at, patch);

export const POST: APIRoute = async ({ request, url, cookies }) => {
  const who = await guard(request, url, cookies.get(SESSION)?.value);
  if (who instanceof Response) return who;

  const form = await request.formData().catch(() => null);
  let input: Input;
  try {
    input = JSON.parse(String(form?.get('data') ?? ''));
  } catch {
    return bad('data');
  }

  const creating = !input.id;
  const sci = text(input.sci, 80);
  if (creating && !/^[A-Z][a-z-]+( [A-Za-z×.-]+)+$/.test(sci)) return bad('sci');
  const id = creating ? slugOf(sci) : String(input.id);
  if (!validId(id)) return bad(creating ? 'sci' : 'id');

  const row = await env.DB.prepare(
    'SELECT (SELECT doc FROM species WHERE id = ?1) AS doc, (SELECT patch FROM edits WHERE id = ?1) AS patch, (SELECT created FROM edits WHERE id = ?1) AS created',
  )
    .bind(id)
    .first<{ doc: string | null; patch: string | null; created: number | null }>();
  const exists = !!(row?.doc || row?.patch);
  if (creating && exists) return reply({ error: 'exists', id }, 409);
  if (!creating && !exists) return reply({ error: 'not_found' }, 404);
  const base = row?.doc ? (JSON.parse(row.doc) as Species) : null;
  const before = row?.patch ? (JSON.parse(row.patch) as Partial<Species>) : {};
  const created = creating || !!row?.created;

  // 名称与类别
  const alias = [...new Set((Array.isArray(input.alias) ? input.alias : []).map((a) => text(a, 40)).filter(Boolean))].slice(0, 30);
  const zh = text(input.zh, 40);
  const k = input.k === 'fungus' ? 'fungus' : 'plant';
  const next: Record<string, unknown> = {
    k,
    zh,
    alias: alias.filter((a) => a !== zh),
    fam: latin(input.fam),
    famZh: text(input.famZh, 20),
    gen: latin(input.gen) || (created ? (before.sci ?? sci).split(' ')[0] : ''),
    genZh: text(input.genZh, 20),
  };
  if (!next.gen) return bad('gen');

  // 图片：先把每一张核对完，再存文件
  const had = new Map((before.imgs ?? []).map((im) => [im.url, im]));
  const imgs: Img[] = [];
  const uploads: [key: string, body: ArrayBuffer][] = [];
  for (const item of (Array.isArray(input.images) ? input.images : []).slice(0, MAX_IMAGES)) {
    const author = text(item.author, 60);
    const license = item.license && item.license in LICENSES ? item.license : '';
    if (!author) return bad('author');
    if (!license) return bad('license');
    const page = /^https?:\/\/\S+$/.test(text(item.page, 300)) ? text(item.page, 300) : undefined;
    let big: string;
    let small: string;
    if (typeof item.file === 'number') {
      const files = [form?.get(`image${item.file}`), form?.get(`thumb${item.file}`)];
      if (!(files[0] instanceof File) || !(files[1] instanceof File)) return bad('image');
      const [a, b] = await Promise.all((files as File[]).map((f) => f.arrayBuffer()));
      if (!jpeg(a) || !jpeg(b)) return bad('image');
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', a)).slice(0, 6)].map((n) => n.toString(16).padStart(2, '0')).join('');
      [big, small] = [`/img/${id}/${hash}.jpg`, `/img/${id}/${hash}-s.jpg`];
      uploads.push([keyOf(big), a], [keyOf(small), b]);
    } else if (item.url && had.has(item.url)) {
      [big, small] = [item.url, had.get(item.url)!.thumb];
    } else continue;
    if (imgs.some((im) => im.url === big)) continue;
    imgs.push({ url: big, thumb: small, author, license, src: 'upload', ...(LICENSES[license] ? { licenseUrl: LICENSES[license] } : {}), ...(page ? { page } : {}) });
  }
  await Promise.all(uploads.map(([key, body]) => env.IMAGES.put(key, body, { httpMetadata: { contentType: 'image/jpeg' } })));
  await removeImages(id, imgs.flatMap((im) => [keyOf(im.url), keyOf(im.thumb)]));

  // 新建的词条存整份；已有的只存和数据不一样的字段
  const patch: Record<string, unknown> = {};
  if (created) {
    Object.assign(patch, { id, sci: before.sci ?? sci, safety: 'unknown', manual: true });
    for (const [key, value] of Object.entries(next)) if (Array.isArray(value) ? value.length : value) patch[key] = value;
  } else {
    const was = base as unknown as Record<string, unknown>;
    if (was.k !== k) patch.k = k;
    for (const key of TEXT) if ((was[key] ?? '') !== next[key]) patch[key] = next[key] || null;
    if (JSON.stringify(was.alias ?? []) !== JSON.stringify(next.alias)) patch.alias = (next.alias as string[]).length ? next.alias : null;
    if (input.hideDataImage && was.img) patch.img = null;
  }
  if (imgs.length) patch.imgs = imgs;

  const now = new Date().toISOString();
  if (!created && !Object.keys(patch).length) {
    if (row?.patch) await env.DB.batch([env.DB.prepare('DELETE FROM edits WHERE id = ?1').bind(id), log(id, who.name, now, null)]);
  } else {
    const body = JSON.stringify(patch);
    if (body !== row?.patch) {
      await env.DB.batch([
        env.DB.prepare(
          'INSERT INTO edits (id, patch, created, updated, by) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT (id) DO UPDATE SET patch = excluded.patch, updated = excluded.updated, by = excluded.by',
        ).bind(id, body, created ? 1 : 0, now, who.name),
        log(id, who.name, now, body),
      ]);
    }
  }
  await purge(url, id);
  return reply({ id }, 200);
};

/** 放弃对一个物种的全部改动；新建的词条则整个删除。只有管理员能做。 */
export const DELETE: APIRoute = async ({ request, url, cookies }) => {
  const who = await guard(request, url, cookies.get(SESSION)?.value, true);
  if (who instanceof Response) return who;
  const id = url.searchParams.get('id') ?? '';
  if (!validId(id)) return bad('id');
  await env.DB.batch([env.DB.prepare('DELETE FROM edits WHERE id = ?1').bind(id), log(id, who.name, new Date().toISOString(), null)]);
  await removeImages(id);
  await purge(url, id);
  return reply({ ok: true }, 200);
};
