// data/snapshot/*.parquet → 网站用的数据
//
//   .data/species.ndjson        物种详情，一行一个物种；由 scripts/db-sync.mjs 灌进 D1
//   public/data/search.json     名称和特征索引：搜索、特征检索都用它
//   public/data/featured/*.json 首页随机展示用的物种，分成小文件，一次取一个
//   public/data/topics.json     专题，App 用
//   public/data/sources.json    数据来源和许可，App 的物种页署名用
//   src/generated/*.json        预渲染页面（分类、专题、特征检索的选项、关于）在构建时读取
//
// ../data/reviewed/foods.csv 是人工审核过的常见食物：有这份记录的物种，安全等级取平常吃的部位的结论。
//
// 后台维护的改动（D1 的 edits 表）在这里并进搜索、分类、专题和首页；species.ndjson 不并，
// 物种页在运行时自己合并。读不到改动表时照常构建。
//
// 数据目录可以用环境变量 BCY_DATA_DIR 指到别处。

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';
import { polyphonic } from 'pinyin-pro';
import { LEVEL_CODES, LEVELS, REGIONS } from '../src/lib/shared.js';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.BCY_DATA_DIR ? path.resolve(process.env.BCY_DATA_DIR) : path.resolve(WEB, '../data/snapshot');
const PUB = path.join(WEB, 'public/data');
const GEN = path.join(WEB, 'src/generated');
const OUT = path.join(WEB, '.data');
const REVIEWED = path.resolve(WEB, '../data/reviewed/foods.csv');

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

// ── 人工审核过的常见食物 ────────────────────────────────────────────
// 一行一个部位：id, zh（只是方便人看）, part, level, note, source（依据：文献、链接）。同一物种可以有多行，第一行是平常吃的部位。
// 物种顶部的结论只看这里；其他部位的毒性记录照常列在物种页的部位表里。
const parseCsv = (text) => {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') cell += text[++i];
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') row.push(cell), (cell = '');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell), (cell = '');
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
};
const EAT_LEVELS = ['edible', 'processed', 'limited'];
const eats = new Map();
if (existsSync(REVIEWED)) {
  const [head, ...rows] = parseCsv(await readFile(REVIEWED, 'utf8'));
  const col = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
  const byId = new Map(taxa.map((t) => [t.id, t]));
  for (const [n, r] of rows.entries()) {
    const [id, zh, part, level, note, source] = ['id', 'zh', 'part', 'level', 'note', 'source'].map((k) => (r[col[k]] ?? '').trim());
    if (!EAT_LEVELS.includes(level) || !part) {
      console.error(`${path.relative(WEB, REVIEWED)} 第 ${n + 2} 行：level 只能是 ${EAT_LEVELS.join('、')}，part 不能为空`);
      process.exit(1);
    }
    const t = byId.get(id);
    if (!t) {
      console.warn(`${path.relative(WEB, REVIEWED)} 第 ${n + 2} 行：数据里没有 ${id}，跳过`);
      continue;
    }
    if (zh && t.zh && zh !== t.zh) console.warn(`${path.relative(WEB, REVIEWED)} 第 ${n + 2} 行：${id} 在数据里叫「${t.zh}」，表里写的是「${zh}」`);
    let list = eats.get(id);
    if (!list) eats.set(id, (list = []));
    list.push(compact({ part, v: level, note: note || undefined, ref: source || undefined }));
  }
}

// ── 后台的改动 ──────────────────────────────────────────────────────
// 在 Workers Builds 里读线上库，其余时候读本地开发库。
function loadEdits() {
  const where = process.env.WORKERS_CI ? '--remote' : '--local';
  const r = spawnSync(path.join(WEB, 'node_modules/.bin/wrangler'), ['d1', 'execute', 'DB', where, '--yes', '--json', '--command', 'SELECT id, patch, created FROM edits'], {
    cwd: WEB, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    return JSON.parse(r.stdout)[0].results.map((e) => ({ id: e.id, created: !!e.created, patch: JSON.parse(e.patch) }));
  } catch {
    if (where === '--remote') console.warn(`读不到后台的改动，这次构建不含它们：${(r.stderr || r.stdout || '').slice(0, 300)}`);
    return [];
  }
}
const BRIEF_FIELDS = ['k', 'zh', 'alias', 'fam', 'famZh', 'gen', 'genZh', 'img'];
const edits = loadEdits();
const patches = new Map(edits.filter((e) => !e.created).map((e) => [e.id, e.patch]));
const patched = (brief, patch) => {
  for (const f of BRIEF_FIELDS) if (f in patch) brief[f] = patch[f] ?? (f === 'alias' ? [] : undefined);
  // 后台上传的图排在数据里的图前面，第一张是首图
  if (patch.imgs?.length) brief.img = patch.imgs[0];
  return brief;
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

  const eat = eats.get(id);
  const safety = eat ? eat[0].v : t.safety;
  const doc = compact({
    id, k: t.kingdom, sci: t.sci, au: t.authors, zh: t.zh, alias,
    fam: t.family, famZh: t.family_zh, gen: t.genus, genZh: t.genus_zh, ord: t.order,
    lf: t.lifeform, cl: t.climate, cn: t.in_china, nat: t.native_cn, cult: t.cultivated, rl: t.redlist,
    safety, eat, powo: t.powo_id, wd: t.wikidata, zhwiki: t.zhwiki,
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
  const brief = { id, k: t.kingdom, sci: t.sci, zh: t.zh, alias, fam: t.family, famZh: t.family_zh, gen: t.genus, genZh: t.genus_zh, safety, cult: !!t.cultivated, lf: t.lifeform, cl: t.climate, img };
  briefs.push(patches.has(id) ? patched(brief, patches.get(id)) : brief);
}
// 后台新建的词条
const known = new Set(briefs.map((b) => b.id));
for (const e of edits) {
  if (e.created && !known.has(e.id) && e.patch.sci && e.patch.gen) briefs.push(patched({ id: e.id, sci: e.patch.sci, alias: [], safety: 'unknown', cult: false }, e.patch));
}

await rm(PUB, { recursive: true, force: true });
await mkdir(PUB, { recursive: true });
await mkdir(GEN, { recursive: true });
await mkdir(OUT, { recursive: true });
const docBytes = docs.reduce((n, d) => n + d.length, 0);
const docMax = docs.reduce((n, d) => Math.max(n, d.length), 0);
await writeFile(path.join(OUT, 'species.ndjson'), docs.join('\n') + '\n');

// ── 特征检索 ────────────────────────────────────────────────────────
// 先选植物还是蘑菇，再按这一类的特征筛。数据里的写法归到几个选项上；一个值可以算进几个选项，宁可多留候选。
//
// 植物：生活型、气候来自 WCVP，按关键词归类；分布按 TDWG 的中国大区，原生和引入都算。
// 蘑菇：特征来自 Wikidata。菌环、菌托的"没看到"不能排除有的种类：菌环会脱落，菌托常埋在土里。
// 丝膜不算菌环，也不算没有菌环。菌褶着生的"无"（没有菌褶）算有记录，选了任何着生方式都会排除它。
//
// 每个物种的特征写成一串码，放进搜索索引：这一类的各项依次排开，用 | 分隔；
// 每项是选中的选项序号（36 进制，一位一个），"-" 是有记录但不属于任何选项，空着是没有记录。
const traitsOf = (trait) => (b) => (G.traits.get(b.id) ?? []).filter((t) => t.trait === trait).map((t) => t.value);
const lookup = (map) => (v) => (v in map ? map[v] : undefined);
const words = (rules) => (v) => {
  const hit = rules.filter(([, re]) => re.test(v)).map(([o]) => o);
  return hit.length ? hit : undefined;
};
const FINDER = {
  plant: [
    {
      key: 'lf', name: '生活型', options: ['乔木', '灌木', '草本', '藤本', '竹', '附生或石生', '寄生', '水生或沼生', '肉质'],
      values: (b) => (b.lf ? [b.lf] : []),
      to: words([
        ['乔木', /乔木|tree/i], ['灌木', /灌木|shrub|chamaephyte/i], ['草本', /草本|地下芽|geophyte|annual|perennial/i],
        ['藤本', /藤本|攀援|蔓生|climbing/i], ['竹', /竹|bamboo/i], ['附生或石生', /附生|石生|epiphyt|lithophyt/i],
        ['寄生', /寄生|菌类异养|mycotroph/i], ['水生或沼生', /水生|沼生/], ['肉质', /肉质/],
      ]),
    },
    {
      key: 'cl', name: '气候', options: ['温带', '亚热带', '热带', '亚寒带或高山', '荒漠或干旱'],
      values: (b) => (b.cl ? [b.cl] : []),
      to: words([['温带', /温带/], ['亚热带', /亚热带/], ['热带', /(^|[^亚])热带/], ['亚寒带或高山', /寒带|高山/], ['荒漠或干旱', /荒漠|干旱灌丛/]]),
    },
    {
      key: 'rg', name: '在中国哪里有', options: Object.values(REGIONS).map((r) => r.name),
      values: (b) => (G.dist.get(b.id) ?? []).map((d) => d.area),
      to: (code) => (REGIONS[code] ? [REGIONS[code].name] : undefined),
    },
  ],
  fungus: [
    {
      key: 'hy', name: '子实层', options: ['菌褶', '菌孔', '菌齿', '脊状褶', '平滑', '腹菌'],
      values: traitsOf('子实层类型'),
      to: lookup({ 菌褶: ['菌褶'], 菌孔: ['菌孔'], 菌齿: ['菌齿'], 脊状褶: ['脊状褶'], 平滑: ['平滑'], '产孢组织（腹菌）': ['腹菌'] }),
    },
    {
      key: 'sp', name: '孢子印', options: ['白', '粉', '黄', '褐', '橄榄', '紫', '黑', '绿'],
      values: traitsOf('孢子印颜色'),
      to: lookup({
        白色: ['白'], 奶油色: ['白', '黄'], 粉红色: ['粉'], 鲑肉色: ['粉'], 粉褐色: ['粉', '褐'], 酒红色: ['粉', '紫'],
        黄色: ['黄'], 橙黄色: ['黄', '褐'], 赭色: ['黄', '褐'], 浅黄褐色: ['黄', '褐'], 褐色: ['褐'], 棕褐色: ['褐'],
        橄榄色: ['橄榄'], 橄榄褐色: ['橄榄', '褐'], 紫色: ['紫'], 紫褐色: ['紫', '褐'], 紫黑色: ['紫', '黑'],
        黑褐色: ['褐', '黑'], 黑色: ['黑'], 绿色: ['绿'],
      }),
    },
    {
      key: 'ring', name: '菌环', options: ['有', '没看到'], weak: '没看到', weakNote: '有菌环，可能已脱落',
      values: traitsOf('菌柄'),
      to: lookup({ 光裸: ['没看到'], 有菌环: ['有'], 有菌环和菌托: ['有'], 有菌托: ['没看到'], 有丝膜: null }),
    },
    {
      key: 'volva', name: '菌托', options: ['有', '没看到'], weak: '没看到', weakNote: '有菌托，常埋在土里',
      values: traitsOf('菌柄'),
      to: lookup({ 光裸: ['没看到'], 有菌环: ['没看到'], 有菌环和菌托: ['有'], 有菌托: ['有'], 有丝膜: ['没看到'] }),
    },
    {
      key: 'gill', name: '菌褶着生', options: ['离生', '弯生', '直生', '延生'],
      values: traitsOf('菌褶着生'),
      to: lookup({ 离生: ['离生'], 后期离生: ['离生'], '弯生（狭附生）': ['弯生'], 凹生: ['弯生'], 波状弯生: ['弯生'], 直生: ['直生'], 延生: ['延生'], 稍延生: ['延生'], 无: [] }),
    },
  ],
};
const unmapped = new Set();
const featCode = (b) => {
  const parts = FINDER[b.k === 'fungus' ? 'fungus' : 'plant'].map((f) => {
    let seen = false;
    const hit = new Set();
    for (const v of f.values(b)) {
      const to = f.to(v);
      if (to === undefined) {
        unmapped.add(`${f.name}=${v}`);
        continue;
      }
      if (!to) continue;
      seen = true;
      for (const o of to) hit.add(f.options.indexOf(o));
    }
    if (!seen) return '';
    return hit.size ? [...hit].sort((x, y) => x - y).map((i) => i.toString(36)).join('') : '-';
  });
  return parts.some(Boolean) ? parts.join('|') : '';
};
const feats = new Map(briefs.map((b) => [b.id, featCode(b)]));
if (unmapped.size) console.warn(`特征检索：这些写法没有归到选项上，按没有记录处理：${[...unmapped].join('、')}`);
const finderFacets = Object.fromEntries(
  Object.entries(FINDER).map(([g, fs]) => [g, fs.map(({ key, name, options, weak, weakNote }) => compact({ key, name, options, weak, weakNote }))]),
);
const recorded = (k) => briefs.filter((b) => (b.k === 'fungus') === (k === 'fungus') && feats.get(b.id)).length;
// 预渲染的检索页只要选项和有记录的种数；各物种的特征在搜索索引里
await writeFile(path.join(GEN, 'finder.json'), JSON.stringify({ facets: finderFacets, counts: { plant: recorded('plant'), fungus: recorded('fungus') } }));

// ── 搜索索引 ────────────────────────────────────────────────────────
// 一行一个物种：[学名, 中文名, 别名（| 分隔）, 科, 等级, 界, 特征码]，没有特征记录的不带最后一项。有内容的排前面。
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
  v: 2,
  rows: sorted.map((b) => {
    const row = [b.sci, b.zh ?? 0, b.alias.join('|') || 0, b.famZh ?? b.fam ?? 0, LEVEL_CODES.indexOf(b.safety), b.k === 'fungus' ? 1 : 0];
    const f = feats.get(b.id);
    return f ? [...row, f] : row;
  }),
  py,
  facets: finderFacets,
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
// 后台编辑时的科名候选：[学名, 中文名]
await writeFile(path.join(PUB, 'families.json'), JSON.stringify(taxonomy.filter((f) => f.name !== '未定科').map((f) => [f.name, f.zh ?? 0])));

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
    source: '依据 Wikidata 的可食性记录。清单不完整，中国的毒蘑菇远不止这些。',
    items: withNote(named.filter((b) => b.k === 'fungus' && ['toxic', 'deadly'].includes(b.safety)), (b) => hazardLabel.get(b.id)),
  },
  {
    slug: 'poisonous-plants', title: '有毒植物', kind: 'danger',
    lead: '有毒性记录的植物。有的只有某个部位有毒，有的另有食用记录，详见物种页。',
    source: '依据 TPPT（以中欧植物为主）和《中国有毒植物参考种数据集（1997）》。',
    items: withNote(named.filter((b) => b.k === 'plant' && ['toxic', 'deadly'].includes(b.safety)), (b) => hazardLabel.get(b.id)),
  },
  {
    slug: 'suspected-plants', title: '名称提示有毒的植物', kind: 'danger',
    lead: '中文名或别名带「毒」「断肠」等字样、又没有毒性记录的植物，如钩吻、狼毒。',
    source: '依据名称推断，不是毒性结论。',
    items: withNote(named.filter((b) => b.k === 'plant' && b.safety === 'suspect'), (b) => (G.hazards.get(b.id) ?? []).find((h) => h.level === 'suspect')?.note?.split('。')[0]),
  },
  {
    slug: 'regulated-food', title: '监管清单里的食品原料', kind: 'ok',
    lead: '台湾食药署「食品原料整合查询平台」列为可供食品使用的植物和菇蕈，带可食部位。',
    source: '依据台湾食药署的清单。本站按"有食用记录"显示。',
    items: withNote(named.filter((b) => twParts.has(b.id)), (b) => twParts.get(b.id)),
  },
  {
    slug: 'not-confirmed-safe', title: '未确认安全性的原料', kind: 'warn',
    lead: '台湾食药署列为"未确认安全性，尚不得作为食品原料使用"的植物和菇蕈。',
    source: '其中不少有食用或药用记录，但没有通过食用安全性评估。',
    items: withNote(named.filter((b) => b.safety === 'restricted'), () => null),
  },
  {
    slug: 'crops', title: '栽培作物', kind: 'neutral',
    lead: '有食用记录的栽培植物：蔬菜、水果、粮食、香料。',
    source: '依据 WCFP 和 GRIN。',
    items: withNote(named.filter((b) => b.k === 'plant' && b.cult && hasFlag(b.id, '食用')), () => null),
  },
  {
    slug: 'food-records', title: '有食用记录的植物', kind: 'neutral',
    lead: '有文献记载食用的植物。有记载不等于安全：钩吻（断肠草）也在其中。',
    source: '依据 WCFP 和《中国有用植物数据集》。',
    items: withNote(named.filter((b) => b.k === 'plant' && hasFlag(b.id, '食用')), () => null),
  },
  {
    slug: 'edible-mushrooms', title: '有食用记录的蘑菇', kind: 'neutral',
    lead: '有食用记录的蘑菇。很多可食蘑菇有外形相近的有毒种类，没有把握不要采食。',
    source: '依据 Wikidata 的可食性记录和台湾食药署清单。',
    items: withNote(named.filter((b) => b.k === 'fungus' && b.safety === 'food_record'), () => null),
  },
].map((t) => ({ ...t, items: t.items.sort((a, b) => a[4].localeCompare(b[4], 'zh-Hans-CN') || String(a[1]).localeCompare(String(b[1]), 'zh-Hans-CN')) }));
await writeFile(path.join(GEN, 'topics.json'), JSON.stringify(topics));
// App 也读这一份
await writeFile(path.join(PUB, 'topics.json'), JSON.stringify(topics));

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
  reviewed: eats.size,
  featured: featured.length,
  bySafety: Object.fromEntries(LEVEL_CODES.map((l) => [l, count((b) => b.safety === l)])),
  topics: topics.map((t) => ({ slug: t.slug, title: t.title, kind: t.kind, lead: t.lead, n: t.items.length })),
};
await writeFile(path.join(GEN, 'stats.json'), JSON.stringify(stats));
await writeFile(path.join(GEN, 'sources.json'), JSON.stringify(sources));
await writeFile(path.join(PUB, 'sources.json'), JSON.stringify(sources));

const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
console.log(
  `数据：${briefs.length} 个物种（共 ${mb(docBytes)}，最大 ${(docMax / 1e3).toFixed(0)} KB），` +
    `审核过的常见食物 ${eats.size} 种，后台改动 ${edits.length} 条，搜索索引 ${mb(searchBody.length)}，有图 ${stats.images} 种，${taxonomy.length} 科 ${stats.genera} 属，` +
    `特征检索：植物 ${recorded('plant')} 种、蘑菇 ${recorded('fungus')} 种有记录，用时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`,
);
