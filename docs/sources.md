# 数据源登记

所有用到、考察过、排除掉的材料来源都记在这里。新增来源时照同样的格式补一行。

- **实测**：2026-11-13 至 14 日从本项目的开发环境实际下载并解析过；数字是解析出来的，不是来源自己声称的。
- **未实测**：许可证在原始页面或元数据接口上核对过，但文件没有下载解析。
- 许可证一栏写的是声明许可的位置上的原文。对许可证的判断不构成法律意见。

| 级别 | 含义 |
|---|---|
| A | 开放许可（CC0、公有领域、CC BY、CC BY-SA），有无需登录的批量文件或接口，可以直接入库 |
| B | 有版权或 NC / ND 许可。只逐条提取事实并注明引用，或只用于匹配和校验，不分发原文件 |
| C | 只作参考或外链 |
| D | 考察后排除 |

## A 可直接入库

### 学名与分类

| 来源 | 地址 | 许可 | 实测 | 用途 |
|---|---|---|---|---|
| WFO Plant List 2026-06 | <https://zenodo.org/records/20782718> | CC0（Zenodo 元数据） | 文件列表已取：`wfo_plantlist_2026-06.zip` 133 MB、`_DwC_backbone_R.zip` 122 MB、`plant_list_2026-06.json.zip` 660 MB；未解压 | 学名主键、异名 |
| WCVP（Kew） | <https://sftp.kew.org/pub/data-repositories/WCVP/wcvp.zip> | CC BY 4.0 | 88 MB。`wcvp_names.csv` 1,448,984 条名称，其中接受种 365,813 个；`wcvp_distribution.csv` 按 TDWG 三级区记录分布。**在中国（含台湾）有分布的接受种 36,678 个，其中原生 35,632 个** | 分布、生活型、POWO ID、异名归并 |
| Catalogue of Life | <https://www.catalogueoflife.org/data/download> | CC BY 4.0 | 未实测 | 真菌及非维管植物的名称 |
| Species Fungorum Plus | <https://www.checklistbank.org/dataset/2073> | CC BY | 未实测 | 真菌学名 |
| TaiCOL 臺灣物種名錄 | <https://ipt.taibif.tw/archive.do?r=taibnet_com_all> | CC BY 4.0（档案内 `eml.xml`） | 5 MB，111,267 个分类单元；有中文名的接受分类单元：植物 10,549 个、真菌 5,600 个 | 繁体中文名（转简体后作别名）、真菌中文名 |
| GRIN Taxonomy（USDA） | <https://www.gbif.org/dataset/66dd0960-2d7d-46ee-a491-87b9adcfe7b1> | CC0 | GBIF 元数据已核对；WCFP 数据包里附带了 `GRIN_economic.csv`、`GRIN_cultivated.csv` | 栽培植物、经济用途 |

### 中文名与别名

| 来源 | 地址 | 许可 | 实测 | 用途 |
|---|---|---|---|---|
| Wikidata `P1843` 生物俗名 | <https://query.wikidata.org/> | CC0 | 带 POWO ID 的植物条目 892,857 个；其中 **66,430 个有中文俗名，共 100,815 个不同的中文名**。按 POWO ID 与 WCVP 连接后，**中国 36,678 个物种里有 32,588 个（89%）能取到中文名** | 中文正名、别名的主要来源 |
| AGROVOC（FAO） | <https://agrovoc.fao.org/latestAgrovoc/agrovoc_core.nt.zip> | CC BY 4.0 | 74 MB，740 万条三元组；中文标签 50,750 个；`hasScientificName` 16,980 条 | 作物、农产品的中英文词表 |
| China Plant Trait Database v1 | <https://doi.pangaea.de/10.1594/PANGAEA.871819> | CC BY 3.0 | 320 KB，11 个 CSV；1,185 个物种带中文名 | 中文名、生活型、叶性状 |

Wikidata 中文名的两点注意：

- **有噪声**。同一物种下混有药材名、错配名（实测：韭菜条目下出现"薤白"，荠菜条目下出现"芥菜"）。入库前要清洗，并把药材名和植物名分开。
- **出处**。抽查 10 个物种的中文名声明，引用来源依次是"中国有用植物数据集"、"中国植物物种名录（2022 版）"、《中国植物志》各卷、臺灣物種名錄。Wikidata 以 CC0 发布，名称本身属于事实；这里记下它们的上游，以备查。

### 食用、药用、用途

| 来源 | 地址 | 许可 | 实测 | 用途 |
|---|---|---|---|---|
| World Checklist of Food Plants 2026（WCFP v3） | <https://doi.org/10.6084/m9.figshare.31441615.v3> | CC BY 4.0（"released in its entirety under CC BY 4.0"） | 150 MB。`WCFP.xlsx` 26,622 个食用植物分类单元，31 列：十类用途标记（食用、药用、毒物、饲料、材料、燃料……）、生活型、是否栽培、红色名录等级、逐条文献。**与中国物种取交集得 5,289 种，其中 5,095 种有中文名**；1,176 种同时有药用记录，432 种为栽培种 | 食用植物名单的主表 |
| 西双版纳民间传统利用植物数据集 | <https://doi.org/10.57760/sciencedb.7> | CC BY 4.0（DataCite 与页面） | xlsx 237 KB，1,071 种。列：学名、中文名、科、民族语名、**食用部位、食用加工方法、食用类型、药用部位、药用加工方法、药用用途**、其他用途、民族、文献。有食用部位的 675 行，有加工方法的 470 行 | 部位 × 用途 × 加工方法；内容为英文，需译成中文受控词 |
| Dr. Duke's Phytochemical and Ethnobotanical Databases（USDA） | <https://doi.org/10.15482/USDA.ADC/1239279> | CC0 | zip 6 MB，16 个 CSV。`ETHNOBOT` 82,873 行（用途、属、种、国家、文献）；`FARMACY_NEW` 104,388 行（化学成分 × 植物部位） | 各国民间用途；成分按部位 |
| Kew SEPASAL | <https://sftp.kew.org/pub/data-repositories/sepasal/> | CC BY 4.0 | 目录已列出：`sepasal_relational_database.zip`、物理模型 PDF；未解析 | 旱地植物用途，按部位 |
| Wild food plants in Soviet books | <https://zenodo.org/records/6638909> | CC BY 4.0 | xlsx 147 KB；3,588 条用途记录，348 个物种；有"加工方式"和"食物类型"列 | 温带野菜的做法，与中国北方物种重叠 |
| European wild edible plants | <https://zenodo.org/records/20307363> | CC BY 4.0 | zip 23 MB；998 种 × 可食部位类别（绿色部分、花、地下部分、果实种子） | 可食部位 |
| Wikidata `P366` 用途 | <https://query.wikidata.org/> | CC0 | 11,967 个植物条目有用途声明，绝大多数是"药用植物" | 补充标记 |
| 药食同源目录、保健食品禁用物品名单、国家重点保护野生植物名录 | 国家卫健委、市场监管总局、林草局公告 | 官方文件，不适用著作权法（第五条） | 未实测 | 药食同源、禁用、保护等级标记 |

WCFP 的"食用"标记只表示**有文献记载过食用**，不表示安全。实测它把钩吻（断肠草，剧毒）标为食用植物。安全结论的合并规则见 [product.md](product.md#安全表达)。

### 毒性

| 来源 | 地址 | 许可 | 实测 | 用途 |
|---|---|---|---|---|
| TPPT Toxic Plants–PhytoToxins（Agroscope） | <https://zenodo.org/records/15758276> | CC BY 4.0 | xlsx 1.4 MB。844 种植物，1,586 种毒素，6,268 条"植物—毒素"关系。植物表有**有毒部位**和**对人毒性分级**（弱毒 149、有毒 314、强毒 72、剧毒 43、致敏 49、光毒 35……） | 有毒部位、毒素、毒性分级；以中欧植物为主 |
| EFSA Compendium of Botanicals（2018 快照） | <https://doi.org/10.5281/zenodo.1212388> | CC BY 4.0 | `BOTANIC.xls` 3,449 条记录、907 种植物。列：学名、科、**植物部位**、制备方式、**有害物质**、含量、文献 | 部位 × 有害物质 |
| Dr. Duke（同上） | 同上 | CC0 | `ETHNOBOT` 里用途为"Poison"的 1,654 行；`DOSAGE` 表有 LD50 | 民间毒物用途、成分毒性 |
| Wikidata `P789` 可食性（真菌） | <https://www.wikidata.org/wiki/Property:P789> | CC0 | 1,566 个条目：食用 687、药用 357、不可食 155、有毒 115、致幻 85、上佳 73、致命 31、熟后可食 30、需处理 20 | 蘑菇可食性分级 |
| Wikidata `P783`–`P788` | 同上 | CC0 | 未逐项统计 | 蘑菇形态：子实层类型、菌盖形状、菌褶着生、菌柄、孢子印颜色、生态类型 |
| English Wikipedia Mycomorphbox | <https://en.wikipedia.org/wiki/Template:Mycomorphbox> | CC BY-SA 4.0 | 未实测 | `howEdible` 及形态字段，补 Wikidata 的缺 |

没有找到开放许可、结构化的"中毒症状、潜伏期、急救"数据。这部分要从 B 级来源里逐条提取。

### 处理方法（古籍）

| 来源 | 地址 | 许可 | 实测 | 用途 |
|---|---|---|---|---|
| 《救荒本草》（明，朱橚，1406；文渊阁四库全书本） | <https://github.com/kanripo/KR3d0006> | 原文属公有领域。Kanripo 仓库未放许可文件，kanripo.org 从本环境访问不了，转录本的许可待确认 | 8 卷纯文本，192 KB，**411 条"救飢"**。每条有名称、别名、产地、形态、性味、食用部位与做法。例："馬齒莧菜　又名五行草……救飢採苗葉先以水焯過晒乾煠熟油鹽調食" | 按部位的处理与去毒方法，中文原文；需解析并对应到现代物种 |
| 《野菜博录》（明，鲍山，1622） | <https://github.com/kanripo/KR3d0009> | 同上 | 3 卷，203 条"食法"（未亲自解析） | 同上 |

### 栽培

| 来源 | 地址 | 许可 | 实测 | 用途 |
|---|---|---|---|---|
| OpenFarm 作物数据（存档） | <https://github.com/thefullnacho/openfarm-crops-rescue> | CC0 | JSON 375 KB，340 种作物：光照、播种方式、株行距、株高；134 种有伴生植物 | 栽培基本参数。仓库自己提示数据是众包的、有缺损 |
| Growstuff | <https://www.growstuff.org/api/v1/crops> | CC BY-SA 3.0 | 接口可用；字段：名称、是否多年生、寿命中位数、到首次采收的天数中位数 | 播种到采收的天数 |
| AusTraits 7.0 | <https://zenodo.org/records/15718081> | CC BY 4.0 | 21 MB；180 万条性状记录，33,370 个分类单元：株高、生活型、花期 | 只覆盖澳大利亚植物，对世界广布的杂草和作物有用 |

中文的农事历、播种期、育苗方法没有找到开放数据。

### 正文、图片、营养

| 来源 | 地址 | 许可 | 实测 | 用途 |
|---|---|---|---|---|
| 中文维基百科 | <https://dumps.wikimedia.org/zhwiki/> | CC BY-SA 4.0 | 带 POWO ID 的植物条目中 42,400 个有中文维基页面；带 Index Fungorum ID 的真菌条目中 3,842 个有 | 形态、用途、栽培的正文 |
| Wikimedia Commons | <https://commons.wikimedia.org/> | 每个文件单独授权：CC0、公有领域、CC BY、CC BY-SA | 91,658 个植物条目在 Wikidata 上有图（`P18`）；接口返回作者与许可，短时间内请求过多会被限流 | 图片主力。图片域名在中国大陆无法访问，需转存 |
| iNaturalist Open Data | <https://github.com/inaturalist/inaturalist-open-data> | 每张照片单独授权，多数为 CC BY-NC | 未实测 | 只取 CC0、CC BY、CC BY-SA 的照片 |
| Mushroom Observer | <https://mushroomobserver.org/> | 每张图片单独授权，默认 CC BY-SA | 从本环境连接被重置，未能实测 | 真菌图片与观察记录 |
| USDA FoodData Central | <https://fdc.nal.usda.gov/download-datasets> | CC0 | 未实测 | 营养成分 |

### baicao-knowledge

| 层 | 许可 | 实测 | 用途 |
|---|---|---|---|
| public（药典、道医苏子阳） | Apache-2.0 | 实体 5,118 行、关系 11,202 行。药典 593 个药材条目，493 条写明植物基原，487 条能抽出拉丁名，196 条有多个基原 | 药材 ↔ 物种 + 部位；采收与产地加工 |
| restricted（28 个来源） | 受限 | 约 25 万实体 | 不进入开源发布，只作内部校验 |

## B 只提取事实

| 来源 | 地址 | 许可 | 内容 | 怎么用 |
|---|---|---|---|---|
| 中国毒蘑菇新修订名录（图力古尔、李海蛟、包海鹰、李玉；菌物研究 2024, 22(4):301–321） | <https://search.napstic.cn/literature/periodical/010jwyj202404001> | 期刊版权 | 660 种：中文名、学名、中毒类型 | 毒蘑菇主表，逐条录入并引用 |
| China CDC Weekly 蘑菇中毒年度报告 | <https://weekly.chinacdc.cn/en/article/doi/10.46234/ccdcw2025.106> | CC BY-NC 4.0 | 累计 246 种实际致中毒的物种，7 类中毒综合征，时间与地区分布 | 排优先级、"当季高发"、对照页选题 |
| 中国食药用菌物种编目（菌物学报 2026, 45(1)） | <https://doi.org/10.57760/sciencedb.jwxb.00003> | CC BY-NC-ND 4.0 | 1,495 种：食用 1,013、药用 744 | 校验可食性 |
| 中国有用维管植物名录（Zhuang et al., Plant Diversity 2021） | <https://doi.org/10.1016/j.pld.2020.09.003> | CC BY-NC-ND 4.0 | 10,808 种 × 12 类用途 | 校验用途标记 |
| 中国生物物种名录（物种 2000 中国节点） | <http://www.sp2000.org.cn/download> | CC BY-NC 4.0 | 2026 版 168,871 个分类单元；植物界约 4.8 万个带中文名 | 中文名匹配与校验 |
| Catalogue of Life China 2025（ChecklistBank 镜像） | <https://www.checklistbank.org/dataset/312616> | ChecklistBank 元数据写 CC BY，**档案内 `eml.xml` 写 CC BY-NC 4.0**，按后者处理 | 约 16 万分类单元，无中文名 | 同上 |
| 中国维管植物生长型 / 生活型数据集（生物多样性 2024） | <https://doi.org/10.57760/sciencedb.10903> | CC BY-NC 4.0 | 35,329 种 | 校验生活型 |
| CVH 中国数字植物标本馆 | <https://www.cvh.ac.cn> | CC BY-NC-ND 4.0 | 860 万份标本记录 | 分布的佐证 |
| World Checklist of Useful Plant Species（Kew, 2020） | <https://doi.org/10.5063/F1CV4G34> | CC BY 4.0 | 40,292 种 × 10 类用途 | 数据只有 PDF（11 MB）。食用植物部分已被 WCFP 2026 包含；非食用植物的用途标记需要从 PDF 里抽表 |
| J. Ethnobiol. Ethnomed. 上的中国野生食用植物调查 | <https://ethnobiomed.biomedcentral.com> | CC BY 4.0 | 各地区的地方名、部位、加工方法 | 许可允许直接使用，但散在各篇论文的附表里，要逐篇整理 |

## C 只作参考或外链

| 来源 | 地址 | 许可 | 说明 |
|---|---|---|---|
| 植物智（中国植物志、Flora of China） | <https://www.iplant.cn/frps> | © 中科院植物所 | 正文不可转载；物种页外链过去 |
| PPBC 中国植物图像库 | <https://ppbc.iplant.cn/copyright> | 需书面授权 | 外链 |
| CFH 中国自然标本馆 | <https://www.cfh.ac.cn> | 未声明 | 外链 |
| Plants For A Future | <https://pfaf.org> | 文字 © PFAF；图片 CC BY-NC | 字段设计的参考；可去函申请授权 |
| Practical Plants | <https://practicalplants.org> | CC BY-NC-SA 3.0 | 参考 |
| Useful Tropical Plants | <https://tropical.theferns.info> | CC BY-NC-SA 3.0 | 参考 |
| POWO 网站 | <https://powo.science.kew.org> | Kew 网站条款 | 外链；数据用 WCVP |
| 真菌王国数据库（中科院昆明植物所） | 见[新华社报道](https://www.news.cn/tech/20260529/ce39adddf8ec46f78086a739743f8d09/c.html) | 条款未公开 | 可联系合作 |
| MushroomExpert | <https://www.mushroomexpert.com> | 未声明 | 参考 |
| Falling Fruit | <https://fallingfruit.org> | CC BY-NC-SA | 地图层的参考 |
| Permapeople | <https://permapeople.org> | CC BY-SA 4.0，商用接口需授权 | 部分数据来自 PFAF，来源不干净 |
| Trefle | <https://trefle.io> | CC BY 4.0，逐条继承上游许可 | 需要逐字段核对上游 |
| NSII 省级植物名录 | <https://www.nsii.org.cn> | 未声明 | 需要先询问 |

## D 已排除

| 来源 | 原因 |
|---|---|
| Native American Ethnobotany DB | 没有许可声明，没有批量文件 |
| FDA Poisonous Plant Database | 已下线 |
| Cornell 有毒植物 | 明示禁止复制 |
| Feedipedia | 仅限非商业，无批量文件 |
| Mansfeld 作物数据库（IPK） | 未见许可，无批量文件或接口 |
| Food Plants International | 文字称 CC BY 3.0，但数据库只能在线浏览；物种清单已包含在 WCFP 里 |
| FAO Ecocrop | 官网已转为登录；镜像不带许可 |
| EPPO Global Database | 需要注册登录 |
| Famine Foods DB（带注释的《救荒本草》） | CC BY-NC-SA 4.0 |
| FooDB | CC BY-NC 4.0 |
| BIEN | CC BY-NC-ND 4.0 |
| TRY | 需逐次申请 |
| Natural Capital Plant Database | 付费订阅 |
| Perenual | 专有 |
| AgriKG | 数据仅限非商业，内容抓自百科 |
| 中国食物成分表的 GitHub 整理版 | 原书版权 |
| 百度百科、互动百科的各种抓取数据集 | 无许可 |
| UCI Mushroom、Secondary Mushroom | 模拟数据，不是中国物种 |
| DF20、Danish Fungal Atlas | 仅限非商业研究 |
| OpenFarm 官方服务 | 2025-04 关停（数据见 A 级的存档） |
| Dryad 上的印度喜马拉雅有用植物数据集（CC0，5,404 种） | 下载接口需要令牌，本环境取不到；换个环境可以再试 |
| Nordic Wild Food Plant Inventory | CC BY 4.0，但只有 PDF |

## 设计稿用图

| 图 | 作者 | 许可 |
|---|---|---|
| [Starr 050222-4109 Portulaca oleracea](https://commons.wikimedia.org/wiki/File:Starr_050222-4109_Portulaca_oleracea.jpg) | Forest & Kim Starr | CC BY 3.0 |
| [Starr-130911-0842 Portulaca oleracea](https://commons.wikimedia.org/wiki/File:Starr-130911-0842-Portulaca_oleracea-small_flower_and_leaves-Near_Camp-Laysan_(24855213419).jpg) | Forest & Kim Starr | CC BY |
| [20150606 Portulaca oleracea 8](https://commons.wikimedia.org/wiki/File:20150606Portulaca_oleracea8.jpg) | AnRo0002 | CC0 |
| [Chamaesyce maculata 51996807199](https://commons.wikimedia.org/wiki/File:Chamaesyce_maculata_-_51996807199.jpg) | aspidoscelis | CC0 |
| [Chlorophyllum molybdites 169974](https://commons.wikimedia.org/wiki/File:2011-09-14_Chlorophyllum_molybdites_169974_cropped.jpg)、[169975](https://commons.wikimedia.org/wiki/File:2011-09-14_Chlorophyllum_molybdites_169975_cropped.jpg) | Brian Adamo，Mushroom Observer | CC BY-SA 3.0 |
| [20130924 Macrolepiota procera 5](https://commons.wikimedia.org/wiki/File:20130924Macrolepiota_procera5.jpg) | AnRo0002 | CC0 |

## 待核实

- Kanripo 转录本的许可。
- 真菌王国数据库的地址和条款。
- 两张 Starr 图片在 Commons 上的确切许可版本（查询时被限流）。
- OpenKG 上的农业图谱（openkg.cn、gitee.com 从本环境访问不了）。
- 去函 PFAF 和物种 2000 中国节点，申请开源再分发授权。
