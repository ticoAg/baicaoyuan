// 本机缓存：下载过的数据存成文件，没网时照样能用。网页版（只用来预览和测试）只放内存。
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

export interface Cached { body: string; etag?: string; at: number }

const web = Platform.OS === 'web';
const memory = new Map<string, Cached>();
const dir = () => {
  const d = new Directory(Paths.document, 'data');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
};
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export async function readCache(key: string): Promise<Cached | null> {
  if (web) return memory.get(key) ?? null;
  try {
    const body = new File(dir(), `${safe(key)}`);
    const meta = new File(dir(), `${safe(key)}.meta`);
    if (!body.exists || !meta.exists) return null;
    const m = JSON.parse(await meta.text()) as Omit<Cached, 'body'>;
    return { ...m, body: await body.text() };
  } catch {
    return null;
  }
}

export async function writeCache(key: string, entry: Cached): Promise<void> {
  if (web) {
    memory.set(key, entry);
    return;
  }
  try {
    const body = new File(dir(), `${safe(key)}`);
    const meta = new File(dir(), `${safe(key)}.meta`);
    await body.write(entry.body);
    await meta.write(JSON.stringify({ etag: entry.etag, at: entry.at }));
  } catch {
    // 存不下就算了，下次再下载
  }
}

/** 小的设置项（比如急救页选的地区）。 */
export async function readPref(name: string): Promise<string | null> {
  if (web) {
    try {
      return globalThis.localStorage?.getItem(`bcy-${name}`) ?? null;
    } catch {
      return null;
    }
  }
  const c = await readCache(`pref-${name}`);
  return c?.body ?? null;
}

export async function writePref(name: string, value: string): Promise<void> {
  if (web) {
    try {
      globalThis.localStorage?.setItem(`bcy-${name}`, value);
    } catch {}
    return;
  }
  await writeCache(`pref-${name}`, { body: value, at: Date.now() });
}
