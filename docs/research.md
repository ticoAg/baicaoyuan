# 百草园 · 数据源与同类项目调研

调研日期：2026-11-13 至 14。各来源的地址、许可和实测结果登记在 [sources.md](sources.md)，产品形态见 [product.md](product.md)。

## 结论

1. **没有可以直接复用的现成项目。** 中文、覆盖植物与真菌、细到"部位 → 用途 → 处理方法"、带图谱的开源项目，目前没有。最接近的 PFAF 是英文的，而且有版权；国内的形色、花伴侣、植物智 App 都是闭源的。这个方向值得做。
2. **"骨架数据"可以完全用开放许可的数据拼出来，并且已经实测能下载**：学名、中文名和别名、分布、食用标记、植物毒性、图片都有 CC0 / CC BY / CC BY-SA 的来源。中国 3.7 万种植物里 89% 能取到中文名，其中 5,289 种有食用记录。
3. **真正的缺口在"内容层"**：现代中文的处理方法、栽培方法、中毒症状、易混淆物种，都没有干净的开放数据。富集的来源（PFAF、Useful Tropical Plants、中国植物志正文）都有版权或是非商业许可。能直接起步的有两样：《救荒本草》（公有领域，411 种救荒植物的食用部位与做法）和西双版纳数据集（CC BY，部位与加工方法）。其余要自建：从 CC BY 文献、维基百科、药典 public 层中抽取事实，每条带证据。这和 baicao-knowledge 现有的抽取流程是一致的。
4. **许可证建议**：数据层用 **CC BY-SA 4.0**（要吸收 zh.wikipedia、Growstuff 的内容），代码用 MIT 或 Apache-2.0。NC、ND 来源只用于比对和校验，不进入发布数据。

## 同类项目

| 项目 | 内容 | 许可（代码 / 数据） | 状态 | 可借鉴 |
|---|---|---|---|---|
| [Plants For A Future](https://pfaf.org) | 约 8k 种：食用/药用评级、危害、栽培 | 文字 © PFAF，无开放许可；图片 CC BY-NC | 活跃，无 API | 字段设计参考；可去函申请授权 |
| [Practical Plants](https://practicalplants.org) | PFAF 的语义 wiki 分支，约 7.4k 条 | CC BY-NC-SA 3.0 | 2022 年服务器故障后只剩存档 | 参考 |
| [Urban Forager](https://github.com/michaelsboost/Urban-Forager) | 174 条植物、真菌词条，带安全与易混淆章节 | MIT / 图片第三方 | 小型 | 页面结构参考 |
| [Falling Fruit](https://fallingfruit.org) | 4,315 类可采集物（含简繁中文名列），196 万个点位 | GPLv3 / CC BY-NC-SA | 活跃 | 地图层参考 |
| [Forage for All](https://github.com/jphein/forageforall) | 采集地图，聚合 Falling Fruit、OSM、iNat、GBIF | AGPL-3.0 | 2026 年新项目 | 代码参考 |
| [Permapeople](https://permapeople.org) | 可食与朴门植物键值数据 | CC BY-SA 4.0，商用 API 需授权 | 活跃 | 数据部分来自 PFAF，来源有风险 |
| [Growstuff](https://www.growstuff.org) | 1,418 种作物的播种与收获数据 | AGPL-3.0 / CC BY-SA 3.0 | 活跃 | 可入库（栽培） |
| OpenFarm | 种植指南 | MIT / CC0 | 2025-04 关停，仓库已归档 | 若能找到数据导出可入库 |
| [Trefle](https://trefle.io) | 约 45 万种植物性状 API | CC BY 4.0，但逐条继承上游许可 | 志愿者维护，已恢复 | 谨慎使用 |
| [ForestFoodKG](https://github.com/dadadaray/FTAND) | 1,191 种中国森林食品（只有营养信息） | 无数据许可 | 论文附带 | 参考 |
| [DICOMPNET/vascularplants](https://github.com/DICOMPNET/vascularplants) | 480 科中英文 JSON 与图片 | CC BY-NC-SA 4.0 | — | 参考 |
| [AgriKG](https://github.com/qq547276542/Agriculture_KnowledgeGraph) | 约 15 万互动百科实体 | GPL-3.0 / 仅限非商业 | 不再维护 | 不用 |
| 形色、花伴侣、植物智 App | 识别与图鉴 | 闭源 | — | — |

GitHub、Gitee 上的中文"野菜 / 毒蘑菇"项目只有 YOLO 识别 demo，数据集来源不明。

## 数据怎么拼

每个来源的地址、许可、实测结果见 [sources.md](sources.md)。下面只列每一层用什么。

| 层 | 用什么 | 实测 |
|---|---|---|
| 学名 | WFO（CC0）、WCVP（CC BY） | 中国（含台湾）有分布的接受种 36,678 个 |
| 中文名、别名 | Wikidata（CC0）、TaiCOL（CC BY）、AGROVOC（CC BY） | 上述物种的 89% 能从 Wikidata 取到中文名；有噪声，要清洗 |
| 分布 | WCVP（CC BY）、GBIF 中 CC0 / CC BY 的记录 | TDWG 三级区，中国分 10 个区 |
| 食用标记 | World Checklist of Food Plants 2026（CC BY） | 中国 5,289 种，其中 5,095 种有中文名 |
| 部位、用途、加工 | 西双版纳数据集（CC BY）、Dr. Duke（CC0）、Kew SEPASAL（CC BY）、药典（经 baicao-knowledge） | 西双版纳 1,071 种，675 行有食用部位，470 行有加工方法 |
| 处理与去毒（中文原文） | 《救荒本草》《野菜博录》（公有领域） | 《救荒本草》411 条"救飢" |
| 植物毒性 | TPPT（CC BY）、EFSA Compendium（CC BY）、Dr. Duke（CC0） | TPPT 844 种，带有毒部位和对人毒性分级 |
| 蘑菇可食性与形态 | Wikidata P789、P783–P788（CC0），Mycomorphbox（CC BY-SA） | 1,566 个条目有可食性分级 |
| 蘑菇中毒类型 | 中国毒蘑菇新修订名录 2024、疾控中心年报 | 有版权或 NC，逐条提取事实 |
| 栽培 | OpenFarm 存档（CC0）、Growstuff（CC BY-SA）、Wikipedia | 英文为主；中文农事历要自建 |
| 正文 | 中文维基百科（CC BY-SA） | 42,400 个植物条目、3,842 个真菌条目有中文页面 |
| 图片 | Wikimedia Commons、iNaturalist、Mushroom Observer 中 CC0 / BY / BY-SA 的图 | 91,658 个植物条目在 Wikidata 上有图 |
| 营养 | USDA FoodData Central（CC0） | — |

仍然没有开放数据的：

- 中毒症状、潜伏期、急救的结构化数据。
- 现代中文的"部位 → 处理方法"。古籍和西双版纳数据集能起步，其余要从 CC BY 文献和维基百科里抽取。
- 中文的播种期、农事历。
- 易混淆物种对。

## 与 baicao-knowledge 的衔接

我对 public 层做了实测：`records` 5,118 行，`edges` 11,202 行。

- **许可分层**：public 层（2022 年版中国药典、道医苏子阳，Apache-2.0）可以直接入库。restricted 层约 25 万实体，来自 28 个来源，许可受限，开源发布时不能带上，只能作为内部校验或外链。
- **药材是按药名组织的，不是按物种**：药典 593 个药材条目里，有 493 条写明了"X 科植物 Y"的基原，其中 487 条能抽出拉丁名，196 条有多个基原。药用部位有：成熟果实 46 条、根 46 条、成熟种子 42 条、地上部分 40 条、根茎 39 条、全草 30 条、叶 21 条……这些正好映射到下文图谱里的"部位"节点。药材的关系是：药材 ─基原→ 物种 + 部位。
- **对齐有噪声**：`base_description` 里的拉丁名去掉了空格，还有 OCR 错误，比如 `Panarginseng`（Panax ginseng）、`Zingiberoj-jicinale`（Zingiber officinale）。对齐策略是先用"科名 + 中文种名"匹配 Wikidata 和中国生物物种名录，再把拉丁名去空格后与 WFO 做编辑距离校验。
- 药典的 `工艺` 节点（42 个）和 `经过工艺` 边（70 条）可以作为"处理方法"的种子数据。
- 真菌只有 7 条（茯苓、马勃、云芝、冬虫夏草等），蘑菇需要另外建设。

## 图谱模型（草案）

```
Taxon 物种 (WFO ID 为主键；植物与真菌共用)
 ├─ 名称 ──────────▶ Name {名称, 类型: 正名|别名|地方名|商品名, 语言, 地区, 来源}
 ├─ 分布于 {原生|引入|栽培} ─▶ Region (TDWG 区 / 省)
 ├─ 生境 ──────────▶ Habitat
 ├─ 有部位 ────────▶ Part {根|根茎|块茎|茎|叶|花|果实|种子|全草|子实体|菌核…}
 │                   ├─ 可用于 {安全等级, 采收季节, 口感评分} ─▶ Use {食用|药用|饲料|材用…}
 │                   ├─ 处理方法 {步骤, 目的: 去毒|去涩|保存} ─▶ Preparation {焯水|浸泡|晒干|发酵…}
 │                   └─ 含有 ────▶ Toxin {毒素, 中毒类型, 症状, 潜伏期, 是否致命}
 ├─ 易混淆 {区分要点} ─▶ Taxon
 ├─ 栽培 ──────────▶ CultivationGuide {播种期, 光照, 水分, 土壤, 繁殖方式}
 └─ 图片 ──────────▶ Image {URL, 作者, 许可, 部位}
药材 (baicao-knowledge) ─基原 {部位}─▶ Taxon
所有节点与边 ─由证据支持─▶ Evidence {来源, 原文定位, 许可}
```

要点：

- **安全等级挂在"部位"上，不挂在"物种"上**：番茄果实可食，茎叶有毒；蕨要处理后才能吃；苦杏仁有毒，甜杏仁可食。等级分为：可食、处理后可食、少量可食、有毒、剧毒、未知。**"未知"在前台一律按"不可食"展示。**
- 毒蘑菇页面把易混淆物种和中毒类型放在显著位置，并明确写出：民间鉴别方法（颜色、银针、虫咬）不可靠。
- 存储沿用 baicao-knowledge 的"实体表 + 关系表 + 证据"Parquet 结构，可以复用现有的 `knowledge_model`。运行时不必上图数据库，Neo4j 只用于探索和质检。

## MVP 范围

| 批次 | 物种 | 主要来源 |
|---|---|---|
| 常见蔬菜 | 约 150 种 | GRIN、Wikidata、Wikipedia、USDA FDC |
| 常见野菜 | 约 100 种 | WCFP、西双版纳数据集、《救荒本草》、药食同源目录 |
| 药典植物 | 约 490 种 | baicao-knowledge public 层 |
| 毒蘑菇 | 约 100 种（CDC 报告中实际致中毒的物种优先） | 2024 名录、Wikidata P789、Mycomorphbox |
| 常见食用菌 | 约 50 种 | Wikidata、Wikipedia |
| 全量骨架 | 约 3.7 万种中国维管植物（只有名称、分布和标记，没有内容层） | WFO、WCVP、Wikidata、WCFP |

## 待确认

见 [sources.md](sources.md#待核实)。本文对许可证的判断不构成法律意见。事实（名称、分布、"X 有毒"）一般不受著作权保护，但成段的描述文字和图片受保护。
