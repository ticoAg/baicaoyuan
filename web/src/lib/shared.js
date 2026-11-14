// 构建脚本（Node）和运行时（Worker、浏览器）共用的常量与小函数。

/** 学名 → 物种 id（与 pipeline/build.py 的 slug 一致）。 */
export function slugOf(sci) {
  return sci.replace(/×/g, 'x').replace(/\+/g, '').trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '');
}

/**
 * 安全等级。rank 越大越严；glyph 用形状区分，不只靠颜色。
 * edible / processed / limited 只由人工审核过的词条给出。
 */
export const LEVELS = {
  deadly: { rank: 8, glyph: '✕', label: '致命', tone: 'deadly', hint: '有致死记录' },
  toxic: { rank: 7, glyph: '▲', label: '有毒', tone: 'toxic', hint: '会中毒' },
  suspect: { rank: 6, glyph: '△', label: '可能有毒', tone: 'toxic', hint: '名称提示有毒，没有毒性分级' },
  restricted: { rank: 5, glyph: '⊘', label: '未确认安全', tone: 'warn', hint: '监管机构未确认其食用安全性' },
  limited: { rank: 4, glyph: '◑', label: '少量', tone: 'warn', hint: '过量有害，或对部分人群有害' },
  processed: { rank: 3, glyph: '◐', label: '处理后可食', tone: 'ok', hint: '必须经过指定处理' },
  edible: { rank: 2, glyph: '●', label: '可食', tone: 'ok', hint: '有可靠的食用记录，且该部位无毒性记录' },
  food_record: { rank: 1, glyph: '◌', label: '有食用记录', tone: 'muted', hint: '有文献记载食用，不能据此食用' },
  unknown: { rank: 0, glyph: '○', label: '未知', tone: 'muted', hint: '没有足够证据，不要吃' },
};

const svg = (inner) => `<svg class="gl" viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true" focusable="false">${inner}</svg>`;
const RING = '<circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.8"/>';
/** 等级图形。自己画，不依赖字体里有没有这些符号。 */
const GLYPH_SVG = {
  deadly: svg('<path d="M3.2 3.2l9.6 9.6M12.8 3.2l-9.6 9.6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  toxic: svg('<path d="M8 1.8l6.6 11.9H1.4z" fill="currentColor"/>'),
  suspect: svg('<path d="M8 3.4l5.2 9.4H2.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'),
  restricted: svg(RING + '<path d="M4.2 11.8l7.6-7.6" stroke="currentColor" stroke-width="1.8"/>'),
  limited: svg(RING + '<path d="M8 2.4a5.6 5.6 0 010 11.2z" fill="currentColor"/>'),
  processed: svg(RING + '<path d="M8 2.4a5.6 5.6 0 000 11.2z" fill="currentColor"/>'),
  edible: svg('<circle cx="8" cy="8" r="6.4" fill="currentColor"/>'),
  food_record: svg('<circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="2.2 2.2"/>'),
  unknown: svg(RING),
};
export const glyphSvg = (level) => GLYPH_SVG[level] ?? GLYPH_SVG.unknown;

/** 搜索索引里用数字表示等级。 */
export const LEVEL_CODES = ['unknown', 'food_record', 'edible', 'processed', 'limited', 'restricted', 'suspect', 'toxic', 'deadly'];

/** TDWG 三级区：中国分 10 个区。 */
export const REGIONS = {
  CHM: { name: '东北', provinces: ['黑龙江', '吉林', '辽宁'] },
  CHI: { name: '内蒙古—宁夏', provinces: ['内蒙古', '宁夏'] },
  CHN: { name: '华北—西北东部', provinces: ['北京', '天津', '河北', '山西', '山东', '陕西', '甘肃'] },
  CHX: { name: '新疆', provinces: ['新疆'] },
  CHQ: { name: '青海', provinces: ['青海'] },
  CHT: { name: '西藏', provinces: ['西藏'] },
  CHC: { name: '西南—华中', provinces: ['四川', '重庆', '贵州', '云南', '湖北'] },
  CHS: { name: '华东—华南', provinces: ['河南', '安徽', '江苏', '上海', '浙江', '江西', '湖南', '福建', '广东', '广西', '香港', '澳门'] },
  CHH: { name: '海南', provinces: ['海南'] },
  TAI: { name: '台湾', provinces: ['台湾'] },
};

/** 省份的方格地图位置：[简称, 全称, 列, 行]。 */
export const PROVINCE_TILES = [
  ['黑', '黑龙江', 7, 0],
  ['蒙', '内蒙古', 5, 1], ['吉', '吉林', 7, 1],
  ['新', '新疆', 0, 2], ['甘', '甘肃', 2, 2], ['宁', '宁夏', 3, 2], ['晋', '山西', 4, 2], ['冀', '河北', 5, 2], ['京', '北京', 6, 2], ['辽', '辽宁', 7, 2],
  ['藏', '西藏', 0, 3], ['青', '青海', 1, 3], ['陕', '陕西', 3, 3], ['豫', '河南', 4, 3], ['鲁', '山东', 5, 3], ['津', '天津', 6, 3],
  ['川', '四川', 2, 4], ['渝', '重庆', 3, 4], ['鄂', '湖北', 4, 4], ['皖', '安徽', 5, 4], ['苏', '江苏', 6, 4],
  ['云', '云南', 2, 5], ['贵', '贵州', 3, 5], ['湘', '湖南', 4, 5], ['赣', '江西', 5, 5], ['浙', '浙江', 6, 5], ['沪', '上海', 7, 5],
  ['桂', '广西', 3, 6], ['粤', '广东', 4, 6], ['闽', '福建', 5, 6], ['台', '台湾', 7, 6],
  ['琼', '海南', 3, 7], ['澳', '澳门', 4, 7], ['港', '香港', 5, 7],
];

export const SITE = {
  name: '百草园',
  tagline: '开源的中文植物与真菌图鉴',
  repo: 'https://github.com/ticoAg/baicaoyuan',
};
