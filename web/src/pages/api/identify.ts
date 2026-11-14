// 拍照识别：把照片转给 Pl@ntNet，再把候选学名对回本站的物种。
//
// 只返回候选和相似度，不给"能不能吃"的结论。照片不落盘、不入库。
// Pl@ntNet 免费额度每天 500 次，所以每个访客、全站各有一个每日上限，计数在 D1 的 usage 表。

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { slugOf } from '../../lib/shared.js';
import { imagesOf, loadMany, type Species } from '../../lib/species';
import { bump, today, used, visitor } from '../../lib/usage';

export const prerender = false;

const API = 'https://my-api.plantnet.org/v2/identify/all';
const MAX_BYTES = 8 * 1024 * 1024;
const PER_VISITOR = 20;
const SITE_TOTAL = 480;
const CANDIDATES = 5;

interface PlantNetResult {
  score: number;
  species: {
    scientificNameWithoutAuthor: string;
    family?: { scientificNameWithoutAuthor?: string };
    commonNames?: string[];
  };
}

/** Pl@ntNet 的俗名里混着拼音，只留汉字写的。 */
const zhNames = (names: string[]) => names.filter((n) => /^[\u4e00-\u9fff·]+$/.test(n)).slice(0, 2);

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

/** 当天还能不能识别；能的话顺手记一次。超限时不写库。 */
async function admit(day: string, who: string): Promise<boolean> {
  const n = await used(day, [who, '*']);
  if ((n.get(who) ?? 0) >= PER_VISITOR || (n.get('*') ?? 0) >= SITE_TOTAL) return false;
  // 当天第一次识别时清掉往日的行
  await bump(day, [who, '*'], !n.has('*'));
  return true;
}

// Pl@ntNet 的 key 有两种用法：勾了"expose my API key"的 key 只认登记过的域名（按 Origin 逐字比对，
// 登记时带不带末尾的斜杠都算数）；不公开的 key 任何服务器都能用，不看 Origin。
// 挨个试，记住能用的那种。
const SITE_ORIGIN = new URL(import.meta.env.SITE ?? 'https://plants.ticoag.fun').origin;
const ORIGINS = [SITE_ORIGIN, `${SITE_ORIGIN}/`, null];
let works = 0;

async function askPlantNet(key: string, type: string, body: ArrayBuffer): Promise<Response> {
  const url = `${API}?api-key=${encodeURIComponent(key)}&lang=zh&nb-results=${CANDIDATES}&include-related-images=false`;
  let res!: Response;
  for (let i = 0; i < ORIGINS.length; i++) {
    const at = (works + i) % ORIGINS.length;
    const origin = ORIGINS[at];
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': type, ...(origin ? { origin } : {}) },
      body,
      signal: AbortSignal.timeout(25_000),
    });
    if (res.status !== 403) {
      works = at;
      break;
    }
  }
  return res;
}

export const POST: APIRoute = async ({ request, url, clientAddress }) => {
  if (request.headers.get('origin') !== url.origin) return json({ error: 'forbidden' }, 403);
  const key = env.PLANTNET_API_KEY;
  if (!key) return json({ error: 'unavailable' }, 503);

  const type = request.headers.get('content-type') ?? '';
  if (!type.startsWith('multipart/form-data')) return json({ error: 'bad_image' }, 400);
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BYTES) return json({ error: 'bad_image' }, 413);
  const body = await request.arrayBuffer();
  if (!body.byteLength || body.byteLength > MAX_BYTES) return json({ error: 'bad_image' }, 413);

  const day = today();
  const who = await visitor(request, clientAddress, day);

  try {
    if (!(await admit(day, who))) return json({ error: 'quota' }, 429);
  } catch (err) {
    console.error('usage 读写失败', err);
    return json({ error: 'unavailable' }, 503);
  }

  let res: Response;
  try {
    res = await askPlantNet(key, type, body);
  } catch (err) {
    console.error('Pl@ntNet 请求失败', err);
    return json({ error: 'unavailable' }, 502);
  }
  // 404：照片里没认出植物
  if (res.status === 404) return json({ results: [] });
  if (res.status === 429) return json({ error: 'quota' }, 429);
  if (res.status === 400 || res.status === 413 || res.status === 415) return json({ error: 'bad_image' }, 400);
  if (!res.ok) {
    console.error('Pl@ntNet 返回', res.status, (await res.text()).slice(0, 200));
    return json({ error: 'unavailable' }, 502);
  }

  const found = ((await res.json()) as { results?: PlantNetResult[] }).results ?? [];
  const top = found.filter((r) => r.species?.scientificNameWithoutAuthor).slice(0, CANDIDATES);
  const ids = top.map((r) => slugOf(r.species.scientificNameWithoutAuthor));
  let known = new Map<string, Species>();
  try {
    known = await loadMany(ids);
  } catch (err) {
    console.error('D1 读取失败', err);
  }

  return json({
    results: top.map((r, i) => {
      const sp = known.get(ids[i]);
      const base = { score: r.score, sci: r.species.scientificNameWithoutAuthor };
      if (!sp) return { ...base, fam: r.species.family?.scientificNameWithoutAuthor, names: zhNames(r.species.commonNames ?? []) };
      const img = imagesOf(sp)[0];
      return {
        ...base,
        id: sp.id,
        zh: sp.zh,
        fam: sp.famZh ?? sp.fam,
        safety: sp.safety,
        thumb: img?.thumb,
        credit: img && `${img.author} · ${img.license}`,
      };
    }),
  });
};
