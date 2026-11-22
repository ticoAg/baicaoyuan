// 数据都来自网站：静态 JSON 和物种接口。下载过的存在本机，没网时用旧的。
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { buildIndex, type IndexFile, type Patch, type SearchIndex } from '@core/match';
import type { Species } from '@core/verdict';
import { readCache, writeCache } from './store';

export const SITE = 'https://plants.ticoag.fun';
export const REPO = 'https://github.com/ticoAg/baicaoyuan';

/** Wikimedia 拒绝 okhttp 默认的 User-Agent（安卓上图片走 okhttp），所以图片请求带上本应用的。 */
const UA = `Baicaoyuan/${Constants.expoConfig?.version ?? '0'} (+${SITE})`;

/** 图片地址 → expo-image 的 source。后台上传的图是站内相对路径。 */
export const imageSource = (url: string) => ({
  uri: url.startsWith('/') ? SITE + url : url,
  headers: Platform.OS === 'web' ? undefined : { 'User-Agent': UA },
});

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

/**
 * 读一份 JSON：缓存没过期就直接用；过期了带 If-None-Match 问一次，没变就续期；
 * 下载失败时退回缓存（哪怕过期了），没有缓存才报错。404 不退回。
 * current 判断缓存是不是现在的格式，不是的当作过期。
 */
async function getJson<T>(path: string, maxAge: number, current: (v: T) => boolean = () => true): Promise<T> {
  const cached = await readCache(path);
  let parsed: T | undefined;
  const old = () => (parsed ??= JSON.parse(cached!.body) as T);
  if (cached && Date.now() - cached.at < maxAge && current(old())) return old();
  try {
    const res = await fetch(SITE + path, { headers: cached?.etag ? { 'If-None-Match': cached.etag } : undefined });
    if (res.status === 304 && cached) {
      await writeCache(path, { ...cached, at: Date.now() });
      return old();
    }
    if (!res.ok) throw new HttpError(res.status);
    const body = await res.text();
    const value = JSON.parse(body) as T;
    await writeCache(path, { body, etag: res.headers.get('etag') ?? undefined, at: Date.now() });
    return value;
  } catch (err) {
    if (cached && !(err instanceof HttpError && err.status === 404)) return old();
    throw err;
  }
}

/** 同一份数据只读一次，失败了下次再试。 */
function once<T>(load: () => Promise<T>) {
  let p: Promise<T> | null = null;
  return () => {
    p ??= load().catch((err) => {
      p = null;
      throw err;
    });
    return p;
  };
}

export const loadSearchIndex = once<SearchIndex>(async () => {
  const [data, overlay] = await Promise.all([
    // 早先存下的索引没有特征检索的数据
    getJson<IndexFile>('/data/search.json', DAY, (d) => !!d.facets),
    // 后台改过、还没进索引的词条。取不到就不管
    getJson<{ rows: Patch[] }>('/api/overlay.json', HOUR).catch(() => ({ rows: [] as Patch[] })),
  ]);
  return buildIndex(data, overlay.rows);
});

export interface Topic {
  slug: string;
  title: string;
  kind: 'danger' | 'warn' | 'ok' | 'neutral';
  lead: string;
  source: string;
  /** [id, 中文名, 学名, 等级代码, 科, 附注] */
  items: [string, string | 0, string, number, string, string | 0][];
}
export const loadTopics = once(() => getJson<Topic[]>('/data/topics.json', DAY));

export interface Source {
  id: string;
  title: string;
  license: string;
  url: string;
  version?: string;
}
export const loadSources = once(() => getJson<Source[]>('/data/sources.json', 7 * DAY));

export const loadSpecies = (id: string) => getJson<Species>(`/s/${encodeURIComponent(id)}.json`, DAY);

export interface Candidate {
  score: number;
  sci: string;
  id?: string;
  zh?: string;
  fam?: string;
  safety?: string;
  thumb?: string;
  credit?: string;
  names?: string[];
}

/** 拍照识别：照片经网站转给 Pl@ntNet。网站只接受本站来源的请求，所以带上 Origin。 */
export async function identify(photos: { uri: string }[]): Promise<Candidate[]> {
  const form = new FormData();
  for (const p of photos) form.append('images', { uri: p.uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  const res = await fetch(`${SITE}/api/identify`, { method: 'POST', body: form, headers: { Origin: SITE } });
  const data = (await res.json().catch(() => ({}))) as { results?: Candidate[]; error?: string };
  if (!res.ok || !data.results) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.results;
}
