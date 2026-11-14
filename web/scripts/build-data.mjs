// data/snapshot/*.parquet → 网站用的数据
//
//   .data/species.ndjson        物种详情，一行一个物种；由 scripts/db-sync.mjs 灌进 D1
//   public/data/search.json     浏览器内搜索索引
//   public/data/featured/*.json 首页随机展示用的物种，分成小文件，一次取一个
//   src/generated/*.json        预渲染页面（分类、专题、关于）在构建时读取
//
// 数据目录可以用环境变量 BCY_DATA_DIR 指到别处。

import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';
import { polyphonic } from 'pinyin-pro';
import { LEVEL_CODES, LEVELS } from '../src/lib/shared.js';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.BCY_DATA_DIR ? path.resolve(process.env.BCY_DATA_DIR) : path.resolve(WEB, '../data/snapshot');
const PUB = path.join(WEB, 'public/data');
const GEN = path.join(WEB, 'src/generated');
const OUT = path.join(WEB, '.data');

if (!existsSync(path.join(DATA, 'taxa.parquet'))) {
  console.error(`找不到数据：${DATA}/taxa.parquet。先运行 pipeline（见 pipeline/README.md），或设置 BCY_DATA_DIR。`);
  process.exit(1);
}

const read = async (name) => parquetReadObjects({ file: await asyncBufferFromFile(path.join(DATA, `${name}.parquet`)) });
const groupBy = (rows, key = 'taxon_id') => {
  const m = new Map();
  for (const r of rows) {
    let a = m.get(r[key]);
    if (!a) m.set(r[key], (a = []));
    a.push(r);
  }
  return m;
};
const compact = (o) => {
  for (const k of Object.keys(o)) if (o[k] == null || o[k] === false || (Array.isArray(o[k]) && !o[k].length)) delete o[k];
  return o;
};

const t0 = Date.now();
const [taxa, names, dist, uses, flags, parts, hazards, traits, images, sources] = await Promise.all(
  ['taxa', 'names', 'dist', 'uses', 'flags', 'parts', 'hazards', 'traits', 'images', 'sources'].map(read),
);
const G = {
  names: groupBy(names), dist: groupBy(dist), uses: groupBy(uses), flags: groupBy(flags),
  parts: groupBy(parts), hazards: groupBy(hazards), traits: groupBy(traits), images: groupBy(images),
};

// ── 物种详情 ────────────────────────────────────────────────────────
const docs = [];
const briefs = [];
for (const t of taxa) {
  const id = t.id;
  const alias = (G.names.get(id) ?? []).filter((n) => n.kind === 'alias').map((n) => n.name);

  // 用途：同一类别下，相同的文字合并，文献去重后编号
  const refs = [];
  const refIdx = (r) => {
    if (!r) return -1;
    let i = refs.indexOf(r);
    if (i < 0) i = refs.push(r) - 1;
    return i;
  };
  const useCats = new Map();
  for (const u of G.uses.get(id) ?? []) {
    let c = useCats.get(u.category);
    if (!c) useCats.set(u.category, (c = { c: u.category, texts: [], refs: new Set() }));
    if (u.text && !c.texts.some((x) => x.toLowerCase() === u.text.toLowerCase())) c.texts.push(u.text);
    const i = refIdx(u.reference);
    if (i >= 0) c.refs.add(i);
  }
  const flagMap = new Map();
  for (const f of G.flags.get(id) ?? []) {
    let x = flagMap.get(f.flag);
    if (!x) flagMap.set(f.flag, (x = { f: f.flag, src: [] }));
    if (!x.src.includes(f.source)) x.src.push(f.source);
    if (f.reference) x.ref = f.reference;
  }
  const img = (G.images.get(id) ?? []).filter((i) => i.url && i.author && i.license)[0];

  const doc = compact({
    id, k: t.kingdom, sci: t.sci, au: t.authors, zh: t.zh, alias,
    fam: t.family, famZh: t.family_zh, gen: t.genus, genZh: t.genus_zh, ord: t.order,
    lf: t.lifeform, cl: t.climate, cn: t.in_china, nat: t.native_cn, cult: t.cultivated, rl: t.redlist,
    safety: t.safety, powo: t.powo_id, wd: t.wikidata, zhwiki: t.zhwiki,
    dist: (G.dist.get(id) ?? []).map((d) => [d.area, d.status === 'native' ? 'n' : 'i']),
    parts: (G.parts.get(id) ?? []).map((p) => compact({ part: p.part, v: p.verdict, use: p.use, note: p.note, src: p.source, ref: p.reference })),
    hazards: (G.hazards.get(id) ?? []).map((h) => compact({ lv: h.level, part: h.part, label: h.label, note: h.note, toxins: h.toxins, src: h.source, ref: h.reference })),
    uses: [...useCats.values()].map((c) => compact({ c: c.c, texts: c.texts, refs: [...c.refs] })),
    refs,
    flags: [...flagMap.values()],
    traits: (G.traits.get(id) ?? []).map((x) => [x.trait, x.value]),
    img: img && compact({ url: img.url, thumb: img.thumb, page: img.page, author: img.author, license: img.license, licenseUrl: img.license_url, src: img.source }),
  });
  docs.push(JSON.stringify(doc));
  briefs.push({ id, k: t.kingdom, sci: t.sci, zh: t.zh, alias, fam: t.family, famZh: t.family_zh, gen: t.genus, genZh: t.genus_zh, safety: t.safety, cult: !!t.cultivated, img });
}

await rm(PUB, { recursive: true, force: true });
await mkdir(PUB, { recursive: true });
await mkdir(GEN, { recursive: true });
await mkdir(OUT, { recursive: true });
const docBytes = docs.reduce((n, d) => n + d.length, 0);
const docMax = docs.reduce((n, d) => Math.max(n, d.length), 0);
await writeFile(path.join(OUT, 'species.ndjson'), docs.join('\n') + '\n');

// ── 搜索索引 ────────────────────────────────────────────────────────
// 一行一个物种：[学名, 中文名, 别名（| 分隔）, 科, 等级, 界]。有内容的排前面。
const rank = (b) => (b.zh ? 0 : 4) + (b.safety === 'unknown' ? 2 : 0) + (b.alias.length ? 0 : 1);
const sorted = [...briefs].sort((a, b) => rank(a) - rank(b) || a.sci.localeCompare(b.sci));
const chars = new Set();
for (const b of sorted) for (const n of [b.zh ?? '', ...b.alias]) for (const ch of n) chars.add(ch);
const py = {};
for (const ch of chars) {
  const readings = [...new Set(polyphonic(ch, { toneType: 'none', type: 'array' })[0] ?? [])].filter((r) => /^[a-zü]+$/.test(r));
  if (readings.length) py[ch] = readings.join(',').replace(/ü/g, 'v');
}
const search = {
  v: 1,
  rows: sorted.map((b) => [b.sci, b.zh ?? 0, b.alias.join('|') || 0, b.famZh ?? b.fam ?? 0, LEVEL_CODES.indexOf(b.safety), b.k === 'fungus' ? 1 : 0]),
  py,
};
const searchBody = JSON.stringify(search);
await writeFile(path.join(PUB, 'search.json'), searchBody);

// ── 分类 ────────────────────────────────────────────────────────────
const families = new Map();
for (const b of briefs) {
  const fkey = b.fam ?? '未定科';
  let f = families.get(`${b.k}/${fkey}`);
  if (!f) families.set(`${b.k}/${fkey}`, (f = { k: b.k, name: fkey, zh: b.famZh ?? null, genera: new Map() }));
  let g = f.genera.get(b.gen);
  if (!g) f.genera.set(b.gen, (g = { name: b.gen, zh: b.genZh ?? null, species: [] }));
  g.species.push([b.id, b.zh ?? 0, b.sci, LEVEL_CODES.indexOf(b.safety)]);
}
const taxonomy = [...families.values()]
  .map((f) => ({
    k: f.k, name: f.name, zh: f.zh,
    genera: [...f.genera.values()]
      .map((g) => ({ ...g, species: g.species.sort((a, b) => a[2].localeCompare(b[2])) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }))
  .sort((a, b) => a.k.localeCompare(b.k) || a.name.localeCompare(b.name));
await writeFile(path.join(GEN, 'taxonomy.json'), JSON.stringify(taxonomy));

// ── 专题 ────────────────────────────────────────────────────────────
const fam = (b) => b.famZh ?? b.fam ?? '未定科';
const item = (b) => [b.id, b.zh ?? 0, b.sci, LEVEL_CODES.indexOf(b.safety), fam(b)];
const hazardLabel = new Map();
for (const [id, hs] of G.hazards) {
  const top = [...hs].filter((h) => h.level).sort((a, b) => LEVELS[b.level].rank - LEVELS[a.level].rank)[0];
  if (top) hazardLabel.set(id, [top.part, top.label].filter(Boolean).join(' · '));
}
const twParts = new Map();
for (const [id, ps] of G.parts) {
  const ok = ps.filter((p) => p.source === 'tw_fda' && p.verdict === 'food_record').map((p) => p.part).filter(Boolean);
  if (ok.length) twParts.set(id, [...new Set(ok)].join('；'));
}
const hasFlag = (id, flag) => (G.flags.get(id) ?? []).some((f) => f.flag === flag);
const withNote = (list, note) => list.map((b) => [...item(b), note(b) ?? 0]);
const named = briefs.filter((b) => b.zh);
const topics = [
  {
    slug: 'poisonous-mushrooms', title: '毒蘑菇', kind: 'danger',
    lead: '有中毒或致死记录的蘑菇。颜色、银针、虫咬都不能用来判断有没有毒。',
    source: '等级来自 Wikidata 的可食性声明（P789），单一来源，未经审核。中国的毒蘑菇远不止这些。',
    items: withNote(named.filter((b) => b.k === 'fungus' && ['toxic', 'deadly'].includes(b.safety)), (b) => hazardLabel.get(b.id)),
  },
  {
    slug: 'poisonous-plants', title: '有毒植物', kind: 'danger',
    lead: '至少有一个来源记载有毒的植物。同一种植物可能只有某个部位有毒，也可能另有食用记录，细节看物种页。',
    source: '来自 TPPT（Agroscope，以中欧植物为主）和《中国有毒植物参考种数据集（1997）》。任何一个来源记载有毒，就按有毒显示。',
    items: withNote(named.filter((b) => b.k === 'plant' && ['toxic', 'deadly'].includes(b.safety)), (b) => hazardLabel.get(b.id)),
  },
  {
    slug: 'suspected-plants', title: '名称提示有毒的植物', kind: 'danger',
    lead: '中文名或别名里带「毒」「断肠」等字样、但开放数据里没有毒性记录的植物。钩吻、狼毒都在这里。',
    source: '只是根据名称的提示，不是毒性结论。开放数据里中国有毒植物的记录很不全，这份清单用来兜底。',
    items: withNote(named.filter((b) => b.k === 'plant' && b.safety === 'suspect'), (b) => (G.hazards.get(b.id) ?? []).find((h) => h.level === 'suspect')?.note?.split('。')[0]),
  },
  {
    slug: 'regulated-food', title: '监管清单里的食品原料', kind: 'ok',
    lead: '台湾食药署「食品原料整合查询平台」列为可供食品使用的植物和菇蕈，带可食部位。',
    source: '监管口径，只代表该清单的结论；本站仍按"有食用记录、未审核"显示。',
    items: withNote(named.filter((b) => twParts.has(b.id)), (b) => twParts.get(b.id)),
  },
  {
    slug: 'not-confirmed-safe', title: '未确认安全性的原料', kind: 'warn',
    lead: '台湾食药署列为"未确认安全性，尚不得作为食品原料使用"的植物和菇蕈。',
    source: '监管口径。其中不少在别处有食用或药用记录，但没有通过食用安全性评估。',
    items: withNote(named.filter((b) => b.safety === 'restricted'), () => null),
  },
  {
    slug: 'crops', title: '栽培作物', kind: 'neutral',
    lead: '有食用记录的栽培植物：蔬菜、水果、粮食、香料。',
    source: '食用标记来自 WCFP 2026，栽培标记来自 GRIN。',
    items: withNote(named.filter((b) => b.k === 'plant' && b.cult && hasFlag(b.id, '食用')), () => null),
  },
  {
    slug: 'food-records', title: '有食用记录的植物', kind: 'neutral',
    lead: '至少有一处文献记载过食用的植物。有记载不等于安全：钩吻（断肠草）也在某些文献里被记为食用植物。',
    source: '来自 WCFP 2026 和《中国有用植物数据集》。未经审核前，本站不把它们显示为"可食"。',
    items: withNote(named.filter((b) => b.k === 'plant' && hasFlag(b.id, '食用')), () => null),
  },
  {
    slug: 'edible-mushrooms', title: '有食用记录的蘑菇', kind: 'neutral',
    lead: '有食用记录的蘑菇。很多可食蘑菇有外形相近的有毒种类，没有把握不要采食。',
    source: '来自 Wikidata 的可食性声明（P789）和台湾食药署清单。',
    items: withNote(named.filter((b) => b.k === 'fungus' && b.safety === 'food_record'), () => null),
  },
].map((t) => ({ ...t, items: t.items.sort((a, b) => a[4].localeCompare(b[4], 'zh-Hans-CN') || String(a[1]).localeCompare(String(b[1]), 'zh-Hans-CN')) }));
await writeFile(path.join(GEN, 'topics.json'), JSON.stringify(topics));

// ── 首页随机展示 ────────────────────────────────────────────────────
// 有中文名、有图的物种，打乱后每 200 个一个文件；首页每次随机取一个文件，从里面挑。
// 一行：[id, 中文名, 学名, 科, 等级, 缩略图, 署名]
const order = (id) => createHash('sha1').update(id).digest('hex');
const showable = briefs.filter((b) => b.zh && b.img?.thumb).sort((a, b) => order(a.id).localeCompare(order(b.id)));
const featured = [];
for (let i = 0; i < showable.length; i += 200) {
  featured.push(showable.slice(i, i + 200).map((b) => [b.id, b.zh, b.sci, fam(b), LEVEL_CODES.indexOf(b.safety), b.img.thumb, `${b.img.author} · ${b.img.license}`]));
}
await mkdir(path.join(PUB, 'featured'), { recursive: true });
await Promise.all(featured.map((rows, i) => writeFile(path.join(PUB, 'featured', `${i}.json`), JSON.stringify(rows))));

// ── 统计、来源 ──────────────────────────────────────────────────────
const count = (f) => briefs.filter(f).length;
const stats = {
  built: new Date().toISOString().slice(0, 10),
  plants: count((b) => b.k === 'plant'),
  fungi: count((b) => b.k === 'fungus'),
  named: count((b) => b.zh),
  names: names.length,
  families: taxonomy.length,
  genera: taxonomy.reduce((n, f) => n + f.genera.length, 0),
  uses: uses.length,
  images: count((b) => b.img),
  featured: featured.length,
  bySafety: Object.fromEntries(LEVEL_CODES.map((l) => [l, count((b) => b.safety === l)])),
  topics: topics.map((t) => ({ slug: t.slug, title: t.title, kind: t.kind, lead: t.lead, n: t.items.length })),
};
await writeFile(path.join(GEN, 'stats.json'), JSON.stringify(stats));
await writeFile(path.join(GEN, 'sources.json'), JSON.stringify(sources));

const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
console.log(
  `数据：${briefs.length} 个物种（共 ${mb(docBytes)}，最大 ${(docMax / 1e3).toFixed(0)} KB），` +
    `搜索索引 ${mb(searchBody.length)}，有图 ${stats.images} 种，${taxonomy.length} 科 ${stats.genera} 属，用时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`,
);
