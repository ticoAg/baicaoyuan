# 百草园 · 数据源与同类项目调研

调研日期：2026-11-13。许可证均在原始页面、DataCite、Zenodo、ChecklistBank 或 GBIF 元数据上核对过；未能核实的标 `?`。

## 结论

1. **没有可以直接复用的现成项目。** 中文、覆盖植物与真菌、细到"部位 → 用途 → 处理方法"、带图谱的开源项目，目前没有。最接近的 PFAF 是英文的，而且有版权；国内的形色、花伴侣、植物智 App 都是闭源的。这个方向值得做。
2. **"骨架数据"可以完全用开放许可的数据拼出来**：学名、中文名/别名、分布、食用/药用/有毒标记、图片都有 CC0 / CC BY / CC BY-SA 的来源。
3. **真正的缺口在"内容层"**：各部位的处理方法、中文栽培方法、口感评价、易混淆物种，都没有干净的开放数据。富集的来源（PFAF、Useful Tropical Plants、中国植物志正文）都有版权或是非商业许可。这一层需要自建：从 CC BY 文献、维基百科、药典 public 层中抽取事实，每条带证据。这和 baicao-knowledge 现有的抽取流程是一致的。
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

## 按字段选源

✅ 可入库　⚠ 只提取事实，或只用于匹配与校验，不分发原文件　❌ 只作参考或外链

### 学名骨架

| 来源 | 规模 | 许可 | 获取 | |
|---|---|---|---|---|
| [WFO Plant List](https://zenodo.org/records/20782718) | 全球植物接受名与异名 | CC0 | Zenodo 年更两次（2026-06 版） | ✅ 主键 |
| [WCVP](https://sftp.kew.org/pub/data-repositories/WCVP/) | 约 140 万名称，含 TDWG 分布与生活型 | CC BY 4.0 | SFTP，84 MB | ✅ |
| [Catalogue of Life](https://www.catalogueoflife.org/data/download) | 547 万名称，XR 版 850 万 | CC BY 4.0 | 月更；GBIF Backbone 已于 2023 年冻结，被它取代 | ✅ |
| [CoL China 2025（ChecklistBank）](https://www.checklistbank.org/dataset/312616) | 约 16 万分类单元 | CC BY | DwC-A | ✅ 只有拉丁名，没有中文名 |
| [Species Fungorum Plus](https://www.checklistbank.org/dataset/2073) | 全球真菌名称 | CC BY | DwC-A | ✅ 真菌 |

### 中文名 / 别名 / 地方名

| 来源 | 规模 | 许可 | | |
|---|---|---|---|---|
| [Wikidata](https://www.wikidata.org) | 约 89 万条目带 POWO ID；常见种的中文标签和别名很全（如马齿苋有 23 个别名） | CC0 | SPARQL / dump | ✅ ID 枢纽 |
| [TaiCOL](https://taicol.tw) | 台湾物种名录，繁体中文名 | CC BY 4.0 | GBIF | ✅ 用 OpenCC 转简体后作别名 |
| [西双版纳民间传统利用植物数据集](https://doi.org/10.57760/sciencedb.7) | 1,071 种：学名、地方名、用途、利用部位、加工方法、民族 | CC BY 4.0 | xlsx | ✅ 字段几乎与本项目一一对应 |
| [J. Ethnobiol. Ethnomed.](https://ethnobiomed.biomedcentral.com) 上的中国野生食用植物调查（如独龙族调查，[figshare](https://doi.org/10.6084/m9.figshare.18865063)） | 各地区的地方名、部位、加工方法 | CC BY 4.0 | 论文补充材料 | ✅ 加工方法的最佳合法来源 |
| [中国生物物种名录](http://www.sp2000.org.cn/download)（sp2000.org.cn） | 2026 版 168,871 个分类单元；植物界约 4.8 万个带中文名 | GBIF 版为 CC BY-NC 4.0；下载需填表 | xlsx / 需注册的 API | ⚠ 中文名对齐的最好来源，用于匹配；可去函申请授权 |

### 形态特征

| 来源 | 许可 | |
|---|---|---|
| zh / en Wikipedia | CC BY-SA 4.0 | ✅ 正文来源（需要相同方式共享） |
| Wikidata 结构化性状：P4000 果实类型、P2827 花色；真菌 P783–P788 菌盖、菌褶等 | CC0 | ✅ |
| [植物智 · 中国植物志 / FOC](https://www.iplant.cn/frps) | © 中科院植物所，无开放许可 | ❌ 正文不可转载。可以从中提取叶形、花期、株高等结构化事实，并注明出处和外链 |

### 地域分布

| 来源 | 许可 | |
|---|---|---|
| WCVP 原生 / 引入分布（TDWG 三级区，中国分为约 10 个大区） | CC BY 4.0 | ✅ |
| [GBIF 观测记录](https://www.gbif.org) | 每个数据集不同，筛出 CC0 / CC BY | ✅ 省级分布、分布地图 |
| [CVH 中国数字植物标本馆](https://www.cvh.ac.cn) | CC BY-NC-ND 4.0 | ⚠ |
| [NSII](https://www.nsii.org.cn) 省级植物名录 | 未声明许可 | ⚠ 需要先询问 |

### 食用 / 药用 / 有毒标记

| 来源 | 规模 | 许可 | |
|---|---|---|---|
| [WCUPS 世界有用植物名录](https://doi.org/10.5063/F1CV4G34)（Kew） | 40,292 种 × 10 类用途，含"食物"和"毒物" | CC BY 4.0 | ✅ |
| [Kew SEPASAL](https://sftp.kew.org/pub/data-repositories/sepasal/) | 6,988 种旱地植物，28,220 条用途记录，按部位拆分 | CC BY 4.0 | ✅ |
| [EFSA Compendium of Botanicals](https://doi.org/10.5281/zenodo.1212388) | 按植物部位列出有害物质 | CC BY 4.0 | ✅ 毒性层 |
| [GRIN Taxonomy](https://npgsweb.ars-grin.gov/gringlobal/taxon/taxonomysearch) | 作物经济用途、多语种俗名 | 公有领域 | ✅ 蔬菜、作物 |
| [USDA PLANTS](https://plants.usda.gov) | 含毒性、适口性字段 | 公有领域 | ✅ 以北美为主 |
| 药食同源目录（2002 年版及 2023、2024 年新增）、保健食品禁用物品名单、国家重点保护野生植物名录（2021） | 官方文件 | 不受著作权保护（著作权法第五条） | ✅ |
| [中国有用维管植物名录](https://doi.org/10.1016/j.pld.2020.09.003)（Zhuang et al. 2021，Table S1） | 10,808 种 × 12 类用途计数（药用、食用、饲料、农药……） | CC BY-NC-ND 4.0 | ⚠ 重新推导标记后再用 |
| PFAF / Useful Tropical Plants / FooDB | — | 有版权或 NC | ❌ |

### 真菌：毒性与可食性

| 来源 | 规模 | 许可 | |
|---|---|---|---|
| [中国毒蘑菇新修订名录](https://search.napstic.cn/literature/periodical/010jwyj202404001)（图力古尔等，菌物研究 2024, 22(4):301–321） | 660 种：中文名、学名、中毒类型 | 期刊版权 | ⚠ 作为主表，逐条带引用重新录入 |
| [China CDC Weekly 年度蘑菇中毒报告](https://weekly.chinacdc.cn/en/article/doi/10.46234/ccdcw2025.106) | 累计 246 种实际致中毒物种，7 类中毒综合征 | CC BY-NC 4.0 | ⚠ 用于给毒蘑菇排序，决定前台优先展示哪些 |
| [中国食药用菌物种编目](https://doi.org/10.57760/sciencedb.jwxb.00003)（菌物学报 2026） | 1,495 种：食用 1,013 种，药用 744 种 | CC BY-NC-ND 4.0 | ⚠ 校验 |
| Wikidata [P789 可食性](https://www.wikidata.org/wiki/Property:P789) | 1,566 个条目，953 个有中文标签；分级：致命、有毒、谨慎、熟食可食、可食、上佳 | CC0 | ✅ |
| en.wikipedia [Mycomorphbox](https://en.wikipedia.org/wiki/Template:Mycomorphbox) | `howEdible` 字段与形态字段（只在信息框里，不在 Wikidata 中） | CC BY-SA 4.0 | ✅ 从 dump 中解析 |
| 真菌王国数据库（中科院昆明植物所，2026-05 起免费开放） | 8,791 种，2.8 万张照片 | 条款未公开 | ? 只能浏览；可联系合作 |
| UCI Mushroom 数据集 | 23 种北美蘑菇的模拟样本 | CC BY 4.0 | ❌ 不适用 |

### 栽培方法

| 来源 | 许可 | |
|---|---|---|
| Growstuff | CC BY-SA 3.0 | ✅ 只有英文，偏欧美 |
| FAO Ecocrop（约 2,568 种作物的气候与土壤需求；[GitHub 镜像](https://github.com/openclim/ecocrop)） | FAO 条款不明 | ? |
| Wikipedia 的"栽培"章节 | CC BY-SA 4.0 | ✅ |
| **中文农事历、播种期、育苗方法** | 没有开放数据源 | 需要自建 |

### 图片

| 来源 | 许可 | |
|---|---|---|
| [Wikimedia Commons](https://commons.wikimedia.org) | 每个文件 CC0 / PD / BY / BY-SA | ✅ 主力；外链显示并署名，不转存 |
| [iNaturalist Open Data](https://github.com/inaturalist/inaturalist-open-data)（S3） | 每张照片单独授权，多数为 NC | ✅ 只取 CC0 / BY / BY-SA |
| [Mushroom Observer](https://mushroomobserver.org)（每晚 CSV 导出） | 每张图片单独授权，默认 CC BY-SA | ✅ 真菌 |
| [PPBC 中国植物图像库](https://ppbc.iplant.cn/copyright)、CFH 中国自然标本馆 | 需书面授权，禁止转载 | ❌ 只能外链 |
| Pl@ntNet-300K、DF20 | CC BY / 仅限非商业 | 留给后续的识别模型训练 |

### 营养

| 来源 | 许可 | |
|---|---|---|
| [USDA FoodData Central](https://fdc.nal.usda.gov) | CC0 | ✅ |
| 中国食物成分表的 GitHub 整理版（[Sanotsu](https://github.com/Sanotsu/china-food-composition-data)） | 原书版权，仅供学习 | ❌ |

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

## 技术路线

| 层 | 选型 |
|---|---|
| 数据管线 | Python + DuckDB / Parquet；发布到 Hugging Face（新建一个数据集，或作为 baicao-knowledge 的新 config） |
| 内容抽取 | 对 CC BY 文献和 Wikipedia 做 LLM 结构化抽取，每条带 `evidence_ref`，再人工抽检 |
| Web | 静态站点（Astro 或 Next.js SSG）+ Pagefind 全文检索 + Cytoscape.js 关系图；部署到 GitHub Pages 或 Cloudflare Pages |
| 图片 | 外链 Commons 和 iNaturalist 原图，页面上显示作者与许可 |
| 社区 | 词条以 YAML / Markdown 形式放在仓库里，通过 PR 贡献；CI 校验许可字段和必填的安全字段 |

## MVP 范围

| 批次 | 物种 | 主要来源 |
|---|---|---|
| 常见蔬菜 | 约 150 种 | GRIN、Wikidata、Wikipedia、USDA FDC |
| 常见野菜 | 约 100 种 | 西双版纳数据集、JEBM 论文、药食同源目录 |
| 药典植物 | 约 490 种 | baicao-knowledge public 层 |
| 毒蘑菇 | 约 100 种（CDC 报告中实际致中毒的物种优先） | 2024 名录、Wikidata P789、Mycomorphbox |
| 常见食用菌 | 约 50 种 | Wikidata、Wikipedia |
| 全量骨架 | 约 3 万种中国维管植物（只有名称、分布和标记，没有内容层） | WFO、WCVP、Wikidata、WCUPS |

## 待确认

- 真菌王国数据库的访问地址和使用条款（可联系昆明植物所）。
- 去函 PFAF、物种 2000 中国节点，申请开源再分发授权；拿到的话，内容层和中文名两个缺口可以大幅收窄。
- POWO 网站条款、FAO Ecocrop 许可、OpenKG 上的农业图谱（本次网络无法访问 openkg.cn 和 gitee.com）。
- 本文对许可证的判断不构成法律意见。事实（名称、分布、"X 有毒"）一般不受著作权保护，但成段的描述文字和图片受保护。
