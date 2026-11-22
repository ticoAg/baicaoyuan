// 急救页的内容：各地的急救电话、怎么做、依据。网站和 App 共用，不依赖运行环境。
//
// 地区按时区猜，猜不出时不给号码，只说打当地急救电话。只放核实过的号码。
// 每一条做法都要对得上 AID_SOURCES 里的公开指引；不写剂量和偏方。

/** [代码, 名称, 急救电话, [第二个号码的说明, 号码]] */
export type AidRegion = [code: string, name: string, call?: string, second?: [label: string, num: string]];

export const AID_REGIONS: AidRegion[] = [
  ['cn', '中国大陆', '120'],
  ['hk', '香港', '999'],
  ['mo', '澳门', '999'],
  ['tw', '台湾', '119'],
  ['sg', '新加坡', '995'],
  ['my', '马来西亚', '999'],
  ['th', '泰国', '1669'],
  ['jp', '日本', '119'],
  ['kr', '韩国', '119'],
  ['us', '美国', '911', ['中毒咨询', '1-800-222-1222']],
  ['ca', '加拿大', '911'],
  ['gb', '英国', '999', ['不确定时问 NHS', '111']],
  ['eu', '欧洲', '112'],
  ['au', '澳大利亚', '000', ['中毒咨询', '13 11 26']],
  ['nz', '新西兰', '111', ['中毒咨询', '0800 764 766']],
  ['other', '其他地区'],
];

/** 时区 → 地区。时区名有旧写法（PRC、Hongkong 等），一并列上。 */
export const AID_ZONES: [code: string, pattern: string][] = [
  ['cn', '^(Asia/(Shanghai|Chongqing|Chungking|Harbin|Urumqi|Kashgar)|PRC)$'],
  ['hk', '^(Asia/Hong_Kong|Hongkong)$'],
  ['mo', '^Asia/Maca[ou]$'],
  ['tw', '^(Asia/Taipei|ROC)$'],
  ['sg', '^(Asia/Singapore|Singapore)$'],
  ['my', '^Asia/(Kuala_Lumpur|Kuching)$'],
  ['th', '^Asia/Bangkok$'],
  ['jp', '^(Asia/Tokyo|Japan)$'],
  ['kr', '^(Asia/Seoul|ROK)$'],
  ['ca', '^(America/(Toronto|Montreal|Nipigon|Thunder_Bay|Rainy_River|Atikokan|Vancouver|Edmonton|Calgary|Winnipeg|Regina|Swift_Current|Halifax|Glace_Bay|Moncton|Goose_Bay|St_Johns|Blanc-Sablon|Whitehorse|Dawson|Dawson_Creek|Creston|Fort_Nelson|Yellowknife|Inuvik|Cambridge_Bay|Rankin_Inlet|Resolute|Iqaluit|Pangnirtung)|Canada/.+)$'],
  ['us', '^(America/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Juneau|Sitka|Metlakatla|Yakutat|Nome|Adak|Boise|Detroit|Menominee|Louisville|Indianapolis|Fort_Wayne|Indiana/.+|Kentucky/.+|North_Dakota/.+)|Pacific/Honolulu|US/.+)$'],
  ['gb', '^(Europe/(London|Belfast|Jersey|Guernsey|Isle_of_Man)|GB|GB-Eire)$'],
  ['eu', '^Europe/'],
  ['au', '^Australia/'],
  ['nz', '^(Pacific/(Auckland|Chatham)|NZ|NZ-CHAT)$'],
];

export const guessRegion = (timeZone: string) => AID_ZONES.find(([, re]) => new RegExp(re).test(timeZone))?.[0] ?? 'other';
export const regionOf = (code: string | null | undefined) => AID_REGIONS.find((r) => r[0] === code) ?? AID_REGIONS[AID_REGIONS.length - 1];
export const tel = (n: string) => `tel:${n.replace(/[^0-9+]/g, '')}`;

/** 怎么做：[加粗的前半句, 后半句] */
export const AID_STEPS: [lead: string, rest: string][] = [
  ['现在就打电话或去医院，没有症状也要去。', '让别人送，不要自己开车。'],
  ['带上吃剩的蘑菇或植物', '，没有剩的就拍照，给医生辨认。'],
  ['一起吃过的人，一起去。', ''],
  ['记下时间和分量：', '几点吃的，吃了多少，几点开始不舒服。'],
  ['不要再吃喝东西，不要自己催吐。', '大蒜、银器、久煮、泡酒都不能验毒，也不能解毒。'],
  ['吐泻好了也不等于没事。', '有的毒蘑菇 6 小时以后才发作；症状缓解时，毒素可能还在损伤肝和肾。'],
];

/** 依据：[标题, 出处, 链接] */
export const AID_SOURCES: [title: string, by: string, url: string][] = [
  ['野生蘑菇中毒', '新南威尔士州卫生厅，2026 年 3 月', 'https://www.health.nsw.gov.au/environment/factsheets/Pages/wild-mushroom-poisoning-simplified-chinese.aspx'],
  ['Poisoning', 'NHS，2025 年 6 月', 'https://www.nhs.uk/conditions/poisoning/'],
  ['Mushroom (Toadstool) Poisoning', '默沙东诊疗手册大众版', 'https://www.msdmanuals.com/home/injuries-and-poisoning/poisoning/mushroom-toadstool-poisoning'],
  ['别乱采野生蘑菇 专家提醒警惕中毒"假愈期"', '新华社，2026 年 9 月', 'https://www.news.cn/20260919/cfab5ce419564c02ae62ec71384e19dc/c.html'],
  ['Poison Help', '美国', 'https://poisonhelp.hrsa.gov/'],
  ['National Poisons Centre', '新西兰', 'https://poisons.co.nz/'],
];
