// src/lib 里网站和 App 共用的纯逻辑。运行：npm test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { guessRegion, regionOf, tel, AID_REGIONS } from '../src/lib/aid.ts';
import { decodeTraits, filterFinder, recordedCount, type Facets } from '../src/lib/finder.ts';
import { buildIndex, entryId, searchIndex, type Entry, type IndexFile } from '../src/lib/match.ts';
import { LEVEL_CODES } from '../src/lib/shared.js';
import { isDanger, issueUrl, partRows, verdict, type Species } from '../src/lib/verdict.ts';

const code = (k: string) => LEVEL_CODES.indexOf(k);

describe('名称搜索', () => {
  const data: IndexFile = {
    rows: [
      ['Portulaca oleracea', '马齿苋', '长命菜|五行草', 'Portulacaceae', code('edible'), 0],
      ['Gelsemium elegans', '钩吻', '断肠草|大茶药', 'Gelsemiaceae', code('deadly'), 0],
      ['Amanita phalloides', '黄绿毒鹅膏菌', '毒鹅膏', 'Amanitaceae', code('deadly'), 1],
      ['Amanita exitialis', '致命鹅膏', 0, 'Amanitaceae', code('deadly'), 1],
      ['Solanum lycopersicum', '番茄', '西红柿', 'Solanaceae', code('edible'), 0],
      ['Lactuca sativa', 0, 0, 0, 0, 0],
    ],
    py: { 马: 'ma', 齿: 'chi', 苋: 'xian', 钩: 'gou', 吻: 'wen', 断: 'duan', 肠: 'chang', 草: 'cao', 番: 'fan,pan', 茄: 'qie,jia', 西: 'xi', 红: 'hong', 柿: 'shi' },
  };
  const index = buildIndex(data);
  const top = (q: string) => searchIndex(index, q)[0];

  it('中文名全名排第一', () => assert.equal(top('钩吻').e.sci, 'Gelsemium elegans'));
  it('别名命中时带出别名', () => {
    const hit = top('断肠草');
    assert.equal(hit.e.zh, '钩吻');
    assert.equal(hit.via, '断肠草');
  });
  it('中文名包含', () => assert.deepEqual(searchIndex(index, '鹅膏').map((h) => h.e.sci).sort(), ['Amanita exitialis', 'Amanita phalloides']));
  it('学名前缀，不分大小写', () => assert.equal(top('Gelsemium').e.zh, '钩吻'));
  it('种加词', () => assert.equal(top('oleracea').e.zh, '马齿苋'));
  it('全拼、首字母、半个音节', () => {
    assert.equal(top('machixian').e.zh, '马齿苋');
    assert.equal(top('mcx').e.zh, '马齿苋');
    assert.equal(top('gouw').e.zh, '钩吻');
  });
  it('多音字', () => assert.equal(top('fanqie').e.zh, '番茄'));
  it('拼音命中别名', () => assert.equal(top('xihongshi').via, '西红柿'));
  it('没有中文名的也能按学名找到', () => assert.equal(top('lactuca').e.sci, 'Lactuca sativa'));
  it('空查询', () => assert.deepEqual(searchIndex(index, '  '), []));
  it('属名找到同属的', () => assert.deepEqual(searchIndex(index, 'amanita').map((h) => h.e.zh).sort(), ['致命鹅膏', '黄绿毒鹅膏菌']));
  it('有内容的排在没内容的前面', () => {
    const idx = buildIndex({ rows: [['Aa b', '某草', 0, 0, 0, 0], ['Aa c', '某草', 0, 0, code('toxic'), 0]], py: {} });
    assert.equal(searchIndex(idx, '某草')[0].e.sci, 'Aa c');
  });
  it('后台改动覆盖或新增词条', () => {
    const idx = buildIndex(data, [
      ['Gelsemium_elegans', 'Gelsemium elegans', '胡蔓藤', 0, 'Gelsemiaceae', code('deadly'), 0],
      ['Xx_new', 'Xx novum', '新草', 0, 0, 0, 0],
    ]);
    assert.equal(searchIndex(idx, '胡蔓藤')[0].e.sci, 'Gelsemium elegans');
    assert.equal(searchIndex(idx, '钩吻').length, 0);
    assert.equal(entryId(searchIndex(idx, '新草')[0].e), 'Xx_new');
    assert.equal(entryId(searchIndex(idx, '马齿苋')[0].e), 'Portulaca_oleracea');
  });
});

describe('特征检索', () => {
  const facets: Facets = {
    plant: [
      { key: 'lf', name: '生活型', options: ['乔木', '灌木', '草本', '藤本'] },
      { key: 'rg', name: '在中国哪里有', options: ['东北', '华东—华南'] },
    ],
    fungus: [
      { key: 'sp', name: '孢子印', options: ['白', '褐', '黑'] },
      { key: 'ring', name: '菌环', options: ['有', '没看到'], weak: '没看到', weakNote: '有菌环，可能已脱落' },
      { key: 'gill', name: '菌褶着生', options: ['离生', '延生'] },
    ],
  };
  const data: IndexFile = {
    facets,
    py: {},
    rows: [
      ['Fungus a', 'A', 0, 0, code('deadly'), 1, '0|0|0'],
      ['Fungus b', 'B', 0, 0, code('toxic'), 1, '1|1|-'],
      ['Fungus c', 'C', 0, 0, code('toxic'), 1, '01'],
      ['Fungus d', 'D', 0, 0, code('unknown'), 1],
      ['Plant a', '甲', 0, 0, code('toxic'), 0, '3|1'],
      ['Plant b', '乙', 0, 0, code('deadly'), 0, '03|'],
      ['Plant c', 0, 0, 0, code('unknown'), 0, '|0'],
    ],
  };
  const index = buildIndex(data);
  const sci = (xs: Entry[]) => xs.map((e) => e.sci);
  const why = (r: ReturnType<typeof filterFinder>) => r!.maybe.map(([e, w]) => [e.sci, w]);

  it('解特征码', () => {
    assert.deepEqual(decodeTraits(facets.fungus, '1|1|-'), { sp: [1], ring: [1], gill: [] });
    assert.deepEqual(decodeTraits(facets.plant, '|0'), { rg: [0] });
    assert.deepEqual(decodeTraits(facets.plant, ''), {});
  });
  it('这一类什么都没选', () => {
    assert.equal(filterFinder(index, 'fungus', {}), null);
    assert.equal(filterFinder(index, 'fungus', { lf: [0] }), null);
    assert.equal(filterFinder(index, 'plant', { lf: [] }), null);
  });
  it('只在选的那一类里找，危险的排前', () => {
    const r = filterFinder(index, 'plant', { lf: [3] })!;
    assert.deepEqual(sci(r.match), ['Plant b', 'Plant a']);
    assert.deepEqual(why(r), [['Plant c', '没有生活型记录']]);
  });
  it('同一项里多选是"或"', () => assert.deepEqual(sci(filterFinder(index, 'fungus', { sp: [0, 1] })!.match), ['Fungus a', 'Fungus b', 'Fungus c']));
  it('不同项是"且"，没有记录的放进无法排除', () => {
    const r = filterFinder(index, 'fungus', { sp: [0], gill: [0] })!;
    assert.deepEqual(sci(r.match), ['Fungus a']);
    assert.deepEqual(why(r), [
      ['Fungus c', '没有菌褶着生记录'],
      ['Fungus d', '没有孢子印、菌褶着生记录'],
    ]);
  });
  it('有记录但不属于任何选项的排除', () => assert.ok(!sci(filterFinder(index, 'fungus', { gill: [1] })!.match).includes('Fungus b')));
  it('只选"没看到"时，有菌环的不能排除', () => {
    const r = filterFinder(index, 'fungus', { ring: [1] })!;
    assert.deepEqual(sci(r.match), ['Fungus b']);
    assert.equal(r.maybe.find(([e]) => e.sci === 'Fungus a')?.[1], '有菌环，可能已脱落');
  });
  it('列出候选里致命的', () => {
    assert.deepEqual(sci(filterFinder(index, 'fungus', { ring: [1] })!.deadly), ['Fungus a']);
    assert.deepEqual(sci(filterFinder(index, 'plant', { rg: [0] })!.deadly), ['Plant b']);
  });
  it('有特征记录的种数', () => {
    assert.equal(recordedCount(index, 'fungus'), 3);
    assert.equal(recordedCount(index, 'plant'), 3);
  });
  it('后台改过的词条沿用索引里的特征码', () => {
    const idx = buildIndex(data, [['Plant_a', 'Plant a', '甲草', 0, 0, code('toxic'), 0]]);
    assert.deepEqual(sci(filterFinder(idx, 'plant', { lf: [3] })!.match), ['Plant b', 'Plant a']);
  });
});

describe('急救电话', () => {
  it('按时区猜地区', () => {
    const cases: [string, string][] = [
      ['Asia/Shanghai', 'cn'], ['Asia/Urumqi', 'cn'], ['Asia/Hong_Kong', 'hk'], ['Asia/Macau', 'mo'], ['Asia/Taipei', 'tw'],
      ['Asia/Singapore', 'sg'], ['Asia/Tokyo', 'jp'], ['America/New_York', 'us'], ['America/Indiana/Knox', 'us'],
      ['America/Toronto', 'ca'], ['Europe/London', 'gb'], ['Europe/Berlin', 'eu'], ['Australia/Sydney', 'au'],
      ['Pacific/Auckland', 'nz'], ['Asia/Kolkata', 'other'], ['America/Mexico_City', 'other'], ['', 'other'],
    ];
    for (const [tz, want] of cases) assert.equal(guessRegion(tz), want, tz);
  });
  it('每个猜得到的地区都有条目', () => {
    for (const tz of ['Asia/Shanghai', 'Asia/Bangkok', 'Asia/Kuala_Lumpur', 'Asia/Seoul']) assert.notEqual(regionOf(guessRegion(tz))[0], 'other', tz);
  });
  it('不认识的地区退回"其他"，不给号码', () => {
    const r = regionOf('xx');
    assert.equal(r[0], 'other');
    assert.equal(r[2], undefined);
    assert.equal(AID_REGIONS.at(-1)![0], 'other');
  });
  it('拨号链接只留数字和加号', () => {
    assert.equal(tel('1-800-222-1222'), 'tel:18002221222');
    assert.equal(tel('13 11 26'), 'tel:131126');
    assert.equal(tel('+86 120'), 'tel:+86120');
  });
});

describe('安全结论', () => {
  const base = { k: 'plant', gen: 'X', sci: 'X y', id: 'X_y' } as const;

  it('有毒物种列出各条毒性记录，另有食用记录时点明', () => {
    const sp: Species = {
      ...base,
      safety: 'toxic',
      hazards: [{ lv: 'toxic', part: '根', label: '有毒', src: 'cn_toxic_1997' }],
      flags: [{ f: '食用', src: ['wcfp'] }],
    };
    const v = verdict(sp);
    assert.equal(v.lv.label, '有毒');
    assert.deepEqual(v.lines, ['根：有毒（中国有毒植物参考种（1997））']);
    assert.match(v.tail, /另有食用记录（WCFP）/);
    assert.equal(isDanger(sp.safety), true);
  });
  it('可能有毒的提示不要吃', () => {
    const v = verdict({ ...base, safety: 'suspect', hazards: [{ lv: 'suspect', label: '可能有毒', note: '名称含"毒"', src: 'wikidata' }] });
    assert.deepEqual(v.lines, ['可能有毒：名称含"毒"。没有毒性记录，不要吃。']);
  });
  it('审核过的食物只说平常吃的部位', () => {
    const sp: Species = {
      ...base,
      safety: 'edible',
      eat: [
        { part: '果实', v: 'edible' },
        { part: '茎叶', v: 'toxic', note: '含茄碱' },
      ],
      hazards: [{ lv: 'toxic', part: '茎叶', label: '有毒', src: 'wikidata' }, { part: '花', label: '药用', src: 'wikidata' }],
      parts: [{ part: '果实', v: 'food_record', src: 'cn_useful' }],
    };
    const v = verdict(sp);
    assert.equal(v.reviewed, true);
    assert.deepEqual(v.lines, ['果实', '有毒：茎叶 · 含茄碱']);
    // 部位表：食用部位在前，只留有等级的毒性记录，不列用途记录
    assert.deepEqual(
      partRows(sp).map((r) => [r.part, r.level, r.src]),
      [['果实', 'edible', 'reviewed'], ['茎叶', 'toxic', 'reviewed'], ['茎叶', 'toxic', 'wikidata']],
    );
    assert.equal(isDanger(sp.safety), false);
  });
  it('没有证据', () => assert.deepEqual(verdict({ ...base, safety: 'unknown' }).lines, ['没有证据说明它能不能吃。']));
  it('部位表：毒性记录在前，带毒素', () => {
    const rows = partRows({
      ...base,
      safety: 'toxic',
      hazards: [{ lv: 'toxic', part: '种子', label: '有毒', toxins: '氰苷', src: 'tppt' }],
      parts: [{ part: '叶', v: 'food_record', use: '食用', src: 'cn_useful' }],
    });
    assert.deepEqual(rows.map((r) => [r.part, r.level, r.use]), [['种子', 'toxic', '含 氰苷'], ['叶', 'food_record', '食用']]);
  });
  it('纠错链接', () => {
    const url = issueUrl('https://github.com/o/r', 'https://example.org', { id: 'X_y', sci: 'X y', zh: '某草' });
    const u = new URL(url);
    assert.equal(u.pathname, '/o/r/issues/new');
    assert.equal(u.searchParams.get('title'), '纠错：某草（X y）');
    assert.match(u.searchParams.get('body')!, /^页面：https:\/\/example\.org\/s\/X_y\n/);
  });
});
