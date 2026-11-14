// 后台保存、删除一个词条的改动。
//
// 已有的物种只存和数据不一样的字段，所以数据更新时没改过的字段照常更新；
// 新建的词条整份存在 edits 表里。图片存 R2，词条里记它的地址、作者和许可。

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { guard, LICENSES, purge, reply, SESSION } from '../../../lib/admin';
import { slugOf } from '../../../lib/shared.js';
import { validId, type Species } from '../../../lib/species';

export const prerender = false;

const MAX_IMAGE = 3 * 1024 * 1024;
const TEXT = ['zh', 'fam', 'famZh', 'gen', 'genZh'] as const;

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
  /** 图片的署名；null 表示去掉上传的图。 */
  img?: { author?: string; license?: string; page?: string } | null;
}
type Img = NonNullable<Species['img']>;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const latin = (v: unknown) => (/^[A-Za-z][A-Za-z-]{1,40}$/.test(text(v, 41)) ? text(v, 41) : '');
const bad = (field: string) => reply({ error: 'invalid', field }, 400);

async function removeImages(id: string, keep: string[] = []) {
  const { objects } = await env.IMAGES.list({ prefix: `${id}/` });
  const gone = objects.map((o) => o.key).filter((k) => !keep.includes(k));
  if (gone.length) await env.IMAGES.delete(gone);
}

export const POST: APIRoute = async ({ request, url, cookies }) => {
  const denied = await guard(request, url, cookies.get(SESSION)?.value);
  if (denied) return denied;

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

  // 图片：先核对署名，再存文件
  let img = before.img?.src === 'upload' ? (before.img as Img) : undefined;
  const file = form?.get('image');
  const thumb = form?.get('thumb');
  const upload = file instanceof File && thumb instanceof File ? [file, thumb] : null;
  if (input.img === null) img = undefined;
  if (img || upload) {
    const credit = input.img ?? {};
    const author = text(credit.author, 60) || (upload ? '' : img!.author);
    const license = credit.license && credit.license in LICENSES ? credit.license : upload ? '' : img!.license;
    if (!author) return bad('author');
    if (!license) return bad('license');
    const page = /^https?:\/\/\S+$/.test(text(credit.page, 300)) ? text(credit.page, 300) : undefined;
    let { url: big, thumb: small } = img ?? { url: '', thumb: '' };
    if (upload) {
      const [a, b] = await Promise.all(upload.map((f) => f.arrayBuffer()));
      const jpeg = (x: ArrayBuffer) => x.byteLength > 100 && x.byteLength <= MAX_IMAGE && new Uint8Array(x, 0, 2).join() === '255,216';
      if (!jpeg(a) || !jpeg(b)) return bad('image');
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', a)).slice(0, 6)].map((n) => n.toString(16).padStart(2, '0')).join('');
      const keys = [`${id}/${hash}.jpg`, `${id}/${hash}-s.jpg`];
      await Promise.all([a, b].map((x, i) => env.IMAGES.put(keys[i], x, { httpMetadata: { contentType: 'image/jpeg' } })));
      [big, small] = keys.map((k) => `/img/${k}`);
    }
    img = { url: big, thumb: small, author, license, src: 'upload', ...(LICENSES[license] ? { licenseUrl: LICENSES[license] } : {}), ...(page ? { page } : {}) };
  }
  await removeImages(id, img ? [img.url, img.thumb].map((u) => u.slice('/img/'.length)) : []);

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
  }
  if (img) patch.img = img;

  if (!created && !Object.keys(patch).length) await env.DB.prepare('DELETE FROM edits WHERE id = ?1').bind(id).run();
  else {
    await env.DB.prepare(
      'INSERT INTO edits (id, patch, created, updated) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (id) DO UPDATE SET patch = excluded.patch, updated = excluded.updated',
    )
      .bind(id, JSON.stringify(patch), created ? 1 : 0, new Date().toISOString())
      .run();
  }
  await purge(url, id);
  return reply({ id }, 200);
};

/** 放弃对一个物种的改动；新建的词条则整个删除。 */
export const DELETE: APIRoute = async ({ request, url, cookies }) => {
  const denied = await guard(request, url, cookies.get(SESSION)?.value);
  if (denied) return denied;
  const id = url.searchParams.get('id') ?? '';
  if (!validId(id)) return bad('id');
  await env.DB.prepare('DELETE FROM edits WHERE id = ?1').bind(id).run();
  await removeImages(id);
  await purge(url, id);
  return reply({ ok: true }, 200);
};
