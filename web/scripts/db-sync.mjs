// 把 .data/species.ndjson 灌进 D1。
//
//   node scripts/db-sync.mjs --local    本地开发库（.wrangler/state）
//   node scripts/db-sync.mjs --remote   线上库
//
// 比对哈希，只写有变化的行：D1 免费额度每天只能写 10 万行。

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(WEB, '.data');
const DB = 'DB'; // wrangler.jsonc 里的绑定名
const DAILY_WRITE_LIMIT = 100_000;

const mode = process.argv.includes('--remote') ? '--remote' : process.argv.includes('--local') ? '--local' : null;
if (!mode) {
  console.error('用法：node scripts/db-sync.mjs --local | --remote');
  process.exit(1);
}
const source = path.join(DATA, 'species.ndjson');
if (!existsSync(source)) {
  console.error('找不到 .data/species.ndjson，先运行 npm run data');
  process.exit(1);
}

function wrangler(args, { capture = false } = {}) {
  const r = spawnSync(path.join(WEB, 'node_modules/.bin/wrangler'), ['d1', 'execute', DB, mode, '--yes', ...args], {
    cwd: WEB,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : ['ignore', 'ignore', 'inherit'],
  });
  if (r.status !== 0) {
    if (capture && r.stdout) console.error(r.stdout.slice(0, 2000));
    console.error(`wrangler d1 execute 失败（${args[0]} ${args[1]?.slice?.(0, 80) ?? ''}）`);
    process.exit(r.status ?? 1);
  }
  return r.stdout;
}
const runFile = (name, sql) => {
  const file = path.join(DATA, name);
  writeFileSync(file, sql);
  wrangler(['--file', file]);
};
const query = (sql) => JSON.parse(wrangler(['--json', '--command', sql], { capture: true }))[0].results;
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const docs = readFileSync(source, 'utf8').split('\n').filter(Boolean).map((doc) => ({
  id: JSON.parse(doc).id,
  hash: createHash('sha1').update(doc).digest('hex').slice(0, 12),
  doc,
}));
const meta = (key, value) => `INSERT INTO meta (key, value) VALUES (${q(key)}, ${q(value)}) ON CONFLICT (key) DO UPDATE SET value = excluded.value;`;

/** 多行合成一条语句，每条不超过 60 KB（D1 单条语句上限 100 KB）。 */
function upserts(rows) {
  const out = [];
  let values = [];
  let bytes = 0;
  const flush = () => {
    if (values.length) out.push(`INSERT INTO species (id, hash, doc) VALUES\n${values.join(',\n')}\nON CONFLICT (id) DO UPDATE SET hash = excluded.hash, doc = excluded.doc;`);
    values = [];
    bytes = 0;
  };
  for (const d of rows) {
    const v = `(${q(d.id)}, ${q(d.hash)}, ${q(d.doc)})`;
    const size = Buffer.byteLength(v);
    if (bytes + size > 60_000) flush();
    values.push(v);
    bytes += size;
  }
  flush();
  return out;
}

const where = mode === '--local' ? '本地 D1' : '线上 D1';
runFile('schema.sql', readFileSync(path.join(WEB, 'db/schema.sql'), 'utf8'));

// 整体摘要没变就不用逐行比对
const digest = createHash('sha1').update(docs.map((d) => `${d.id}:${d.hash}`).sort().join('\n')).digest('hex');
if (query(`SELECT value FROM meta WHERE key = 'digest'`)[0]?.value === digest) {
  console.log(`${where}：数据没有变化（${docs.length} 个物种）`);
  process.exit(0);
}

// 分页取库里已有的哈希：一次取太多会超出查询结果的大小限制
const existing = new Map();
for (let last = ''; ; ) {
  const rows = query(`SELECT id, hash FROM species WHERE id > ${q(last)} ORDER BY id LIMIT 10000`);
  for (const r of rows) existing.set(r.id, r.hash);
  if (rows.length < 10000) break;
  last = rows.at(-1).id;
}
const ids = new Set(docs.map((d) => d.id));
const changed = docs.filter((d) => existing.get(d.id) !== d.hash);
const removed = [...existing.keys()].filter((id) => !ids.has(id));
console.log(`${where}：现有 ${existing.size}，新增或变化 ${changed.length}，删除 ${removed.length}`);
if (mode === '--remote' && changed.length + removed.length > DAILY_WRITE_LIMIT * 0.9) {
  console.error(`要写 ${changed.length + removed.length} 行，接近 D1 免费额度的每日上限（${DAILY_WRITE_LIMIT} 行）。分两天同步，或升级套餐。`);
  process.exit(1);
}
const deletes = [];
for (let i = 0; i < removed.length; i += 500) deletes.push(`DELETE FROM species WHERE id IN (${removed.slice(i, i + 500).map(q).join(', ')});`);
runFile('sync.sql', [...upserts(changed), ...deletes, meta('synced_at', new Date().toISOString()), meta('species', docs.length), meta('digest', digest)].join('\n'));
console.log(`${where}：同步完成`);
