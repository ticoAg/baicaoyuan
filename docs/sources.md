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
| TaiCOL 臺灣物種名錄（2026-10 物种档案） | <https://admin.taicol.tw/upload/TaiCOL_taxon_20261030.zip> | CC BY 4.0（taicol.tw 政策页；DwC-A 档案内 `eml.xml`） | zip 5.8 MB，96,984 行。植物 15,617 个分类单元，14,044 个有中文名，3,851 个有别名；真菌 9,646 个，7,068 个有中文名。另有科、属中文名和原生 / 外来标记 | 繁体中文名与别名（转简体后使用）、真菌中文名 |
| GRIN Taxonomy（USDA） | <https://www.gbif.org/dataset/66dd0960-2d7d-46ee-a491-87b9adcfe7b1> | CC0 | GBIF 元数据已核对；WCFP 数据包里附带了 `GRIN_economic.csv`、`GRIN_cultivated.csv` | 栽培植物、经济用途 |

### 中文名与别名

| 来源 | 地址 | 许可 | 实测 | 用途 |
|---|---|---|---|---|
| Wikidata `P1843` 生物俗名 | <https://query.wikidata.org/> | CC0 | 带 POWO ID 的植物条目 892,857 个；其中 **66,430 个有中文俗名，共 100,815 个不同的中文名**。按 POWO ID 与 WCVP 连接后，**中国 36,678 个物种里有 32,588 个（89%）能取到中文名** | 中文正名、别名的主要来源 |
| iNaturalist 分类名录（DwC-A） | <https://www.inaturalist.org/taxa/inaturalist-taxonomy.dwca.zip> | 档案内没有 CC 许可，只有一句"分类信息不构成创作"；ChecklistBank 把同一数据集登记为 CC BY | zip 81 MB。简体中文名：植物 63,489 条、42,223 种；真菌 9,114 条、5,591 种。繁体：植物 34,491 条；真菌 2,989 条 | 数量最大的简繁中文名；众包数据，要交叉核对 |
| AGROVOC（FAO） | <https://agrovoc.fao.org/latestAgrovoc/agrovoc_core.nt.zip> | CC BY 4.0 | 74 MB，740 万条三元组；中文标签 50,750 个；`hasScientificName` 16,980 条 | 作物、农产品的中英文词表 |
| China Plant Trait Database v1 | <https://doi.pangaea.de/10.1594/PANGAEA.871819> | CC BY 3.0 | 320 KB，11 个 CSV；1,185 个物种带中文名 | 中文名、生活型、叶性状 |

Wikidata 中文名的两点注意：

- **有噪声**。同一物种下混有药材名、错配名（实测：韭菜条目下出现"薤白"，荠菜条目下出现"芥菜"）。入库前要清洗，并把药材名和植物名分开。
- **出处**。抽查 10 个物种的中文名声明，引用来源依次是"中国有用植物数据集"（CC BY 4.0，见下）、"中国植物物种名录（2022 版）"、《中国植物志》各卷、臺灣物種名錄。Wikidata 以 CC0 发布，名称本身属于事实；这里记下它们的上游，以备查。
- **取数**。官方查询端点 `query.wikidata.org` 有时连接被重置，重的查询会超时；QLever 的镜像 <https://qlever.dev/api/wikidata> 可以替代。全量处理应当用 dump。

### 食用、药用、用途

| 来源 | 地址 | 许可 | 实测 | 用途 |
|---|---|---|---|---|
| **中国有用植物数据集** V202101（Zhuang Huifu 等，中科院昆明植物所） | <https://doi.org/10.57760/sciencedb.j00001.00212> | CC BY 4.0（DataCite 与页面） | xlsx 3.7 MB。**51,949 条用途记录**，11,963 个核对过学名的分类单元，47,235 行带中文名（16,734 个不同的中文名）。列：中文名、原始学名、**用途**、**用途类别**、**文献**、核对后的学名。类别：药用 38,610、食品 5,247（2,310 个分类单元）、观赏 1,665、木材 1,246、饲料 1,169、工业原料 1,138、纤维 1,111、油料 744、农药 222。按学名直接匹配到 WCVP 的中国物种 8,167 个，其中 1,575 个有食品记录 | 中文的用途主表，逐条带文献 |
| 食品原料整合查詢平臺（台湾食药署，data.gov.tw 8452） | <https://data.fda.gov.tw/data/opendata/export/4/csv> | 政府資料開放授權條款－第 1 版 | 1,707 行：**可供食品使用 1,173**（草木本植物 785、菇蕈 71、藻 53），**未确认安全性不得使用 534**。列：分类、中文名、英文名、学名、**部位**、备注。1,509 行有学名，1,247 行有部位 | 监管口径的"可食 / 不可食 + 可食部位" |
| World Checklist of Food Plants 2026（WCFP v3） | <https://doi.org/10.6084/m9.figshare.31441615.v3> | CC BY 4.0（"released in its entirety under CC BY 4.0"） | 150 MB。`WCFP.xlsx` 26,622 个食用植物分类单元，31 列：十类用途标记（食用、药用、毒物、饲料、材料、燃料……）、生活型、是否栽培、红色名录等级、逐条文献。**与中国物种取交集得 5,289 种，其中 5,095 种有中文名**；1,176 种同时有药用记录，432 种为栽培种 | 食用植物名单的主表 |
| 西双版纳民间传统利用植物数据集 | <https://doi.org/10.57760/sciencedb.7> | CC BY 4.0（DataCite 与页面） | xlsx 237 KB，1,071 种。列：学名、中文名、科、民族语名、**食用部位、食用加工方法、食用类型、药用部位、药用加工方法、药用用途**、其他用途、民族、文献。有食用部位的 675 行，有加工方法的 470 行 | 部位 × 用途 × 加工方法；内容为英文，需译成中文受控词 |
| Dr. Duke's Phytochemical and Ethnobotanical Databases（USDA） | <https://doi.org/10.15482/USDA.ADC/1239279> | CC0 | zip 6 MB，16 个 CSV。`ETHNOBOT` 82,873 行（用途、属、种、国家、文献）；`FARMACY_NEW` 104,388 行（化学成分 × 植物部位） | 各国民间用途；成分按部位 |
| Kew SEPASAL | <https://sftp.kew.org/pub/data-repositories/sepasal/> | CC BY 4.0 | 目录已列出：`sepasal_relational_database.zip`、物理模型 PDF；未解析 | 旱地植物用途，按部位 |
| Wild food plants in Soviet books | <https://zenodo.org/records/6638909> | CC BY 4.0 | xlsx 147 KB；3,588 条用途记录，348 个物种；有"加工方式"和"食物类型"列 | 温带野菜的做法，与中国北方物种重叠 |
| European wild edible plants | <https://zenodo.org/records/20307363> | CC BY 4.0 | zip 23 MB；998 种 × 可食部位类别（绿色部分、花、地下部分、果实种子） | 可食部位 |
| Wikidata `P366` 用途 | <https://query.wikidata.org/> | CC0 | 11,967 个植物条目有用途声明，绝大多数是"药用植物" | 补充标记 |
| 药食同源目录、保健食品禁用物品名单、国家重点保护野生植物名录 | 国家卫健委、市场监管总局、林草局公告 | 官方文件，不适用著作权法（第五条） | 未实测 | 药食同源、禁用、保护等级标记 |

WCFP 的"食用"标记只表示**有文献记载过食用**，不表示安全。实测它把钩吻（断肠草，剧毒）标为食用植物；中国有用植物数据集里钩吻只有药用和农药记录，没有食品记录。安全结论的合并规则见 [product.md](product.md#安全表达)。

### 毒性

| 来源 | 地址 | 许可 | 实测 | 用途 |
|---|---|---|---|---|
| TPPT Toxic Plants–PhytoToxins（Agroscope） | <https://zenodo.org/records/15758276> | CC BY 4.0 | xlsx 1.4 MB。844 种植物，1,586 种毒素，6,268 条"植物—毒素"关系。植物表有**有毒部位**和**对人毒性分级**（弱毒 149、有毒 314、强毒 72、剧毒 43、致敏 49、光毒 35……） | 有毒部位、毒素、毒性分级；以中欧植物为主 |
| 中国有毒植物参考种（中科院东北地理所） | <https://doi.org/10.57760/sciencedb.iga.00893> | CC BY 4.0 | 432 行，只有一列"中文名 学名"；由 1990 年代的图书数字化而来，有识别错字 | 有毒植物名单的种子，需校对 |
| EFSA Compendium of Botanicals（2018 快照） | <https://doi.org/10.5281/zenodo.1212388> | CC BY 4.0 | `BOTANIC.xls` 3,449 条记录、907 种植物。列：学名、科、**植物部位**、制备方式、**有害物质**、含量、文献 | 部位 × 有害物质 |
| Dr. Duke（同上） | 同上 | CC0 | `ETHNOBOT` 里用途为"Poison"的 1,654 行；`DOSAGE` 表有 LD50 | 民间毒物用途、成分毒性 |
| Wikidata `P789` 可食性（真菌） | <https://www.wikidata.org/wiki/Property:P789> | CC0 | 1,566 个条目：食用 687、药用 357、不可食 155、有毒 115、致幻 85、上佳 73、致命 31、熟后可食 30、需处理 20 | 蘑菇可食性分级 |
| Wikidata `P783`–`P788` | 同上 | CC0 | 未逐项统计 | 蘑菇形态：子实层类型、菌盖形状、菌褶着生、菌柄、孢子印颜色、生态类型 |
| English Wikipedia Mycomorphbox | <https://en.wikipedia.org/wiki/Template:Mycomorphbox> | CC BY-SA 4.0 | 未实测 | `howEdible` 及形态字段，补 Wikidata 的缺 |

没有找到开放许可、结构化的"中毒症状、潜伏期、急救"数据。这部分要从 B 级来源里逐条提取。

### 处理方法（古籍）

| 来源 | 地址 | 许可 | 实测 | 用途 |
|---|---|---|---|---|
| 《救荒本草》（明，朱橚，1406；文渊阁四库全书本） | 中文维基文库 <https://zh.wikisource.org/wiki/救荒本草_(四庫全書本)>；另有 Kanripo 转录 <https://github.com/kanripo/KR3d0006> | 原文属公有领域；维基文库页面标 `PD-old` | 8 卷纯文本，192 KB，**411 条"救飢"**。每条有名称、别名、产地、形态、性味、食用部位与做法。例："馬齒莧菜　又名五行草……救飢採苗葉先以水焯過晒乾煠熟油鹽調食" | 按部位的处理与去毒方法，中文原文；需解析并对应到现代物种 |
| 《植物名实图考》（清，吴其濬） | 中文维基文库 | 同上 | 1,764 个按植物分的页面 | 古名、形态、用途 |
| 《本草纲目》《齐民要术》《农政全书》 | 中文维基文库 | 同上 | 161 页（11.6 MB）、41 页、125 页。《农政全书》卷 46–59 收有带标点的《救荒本草》内容，但有简繁转换错字 | 性味、古代栽培法 |
| 古籍插图 | Wikimedia Commons 的 `Category:救荒本草`（55 个文件）、`Category:植物名實圖考`（299 个）、`Category:野菜博錄`（30 个） | 公有领域（未逐个核对文件标签） | — | 物种页的古籍配图 |
| 《野菜博录》（明，鲍山，1622） | Kanripo <https://github.com/kanripo/KR3d0009> | 原文属公有领域；Kanripo 仓库未放许可文件 | 3 卷，203 条"食法"。维基文库只有残页 | 同《救荒本草》 |

### 栽培

| 来源 | 地址 | 许可 | 实测 | 用途 |
|---|---|---|---|---|
| OpenFarm 作物数据（存档） | <https://github.com/thefullnacho/openfarm-crops-rescue> | CC0 | JSON 375 KB，340 种作物：光照、播种方式、株行距、株高；134 种有伴生植物 | 栽培基本参数。仓库自己提示数据是众包的、有缺损 |
| Growstuff | <https://www.growstuff.org/api/v1/crops> | CC BY-SA 3.0 | 接口可用；字段：名称、是否多年生、寿命中位数、到首次采收的天数中位数 | 播种到采收的天数 |
| AusTraits 7.0 | <https://zenodo.org/records/15718081> | CC BY 4.0 | 21 MB；180 万条性状记录，33,370 个分类单元：株高、生活型、花期 | 只覆盖澳大利亚植物，对世界广布的杂草和作物有用 |

| 每月盛產農產品產地（台湾农业部，data.gov.tw 8120） | <https://data.moa.gov.tw/Service/OpenData/DataFileService.aspx?UnitId=061&IsTransData=1> | 政府資料開放授權條款－第 1 版 | 4,010 行：类别、月份、作物、品种、县市 | 产期（台湾） |
| 農作物統一名稱與代碼（data.gov.tw 115867） | <https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=LC7YWlenhLuP&IsTransData=1> | 同上 | 4,370 行：作物名、别名、四级分类 | 作物与品种的中文名 |
| 桃園場保健植物圃植栽名錄（data.gov.tw 9675） | <https://data.moa.gov.tw/Service/OpenData/DataFileService.aspx?UnitId=148&IsTransData=1> | 同上 | 50 行：中文名、学名、别名、习性、根茎 / 叶 / 花 / 果实的形态、茶用部位、繁殖方式、图片 | 量小，但字段和本项目几乎一样，可作样例 |

中文的农事历、播种期、育苗方法没有找到开放数据。

### 正文、图片、营养

| 来源 | 地址 | 许可 | 实测 | 用途 |
|---|---|---|---|---|
| 中文维基百科 | <https://dumps.wikimedia.org/zhwiki/> | CC BY-SA 4.0 | 带 POWO ID 的植物条目中 42,400 个有中文维基页面；带 Index Fungorum ID 的真菌条目中 3,842 个有。只算"种"一级：植物 34,934 篇，真菌 1,453 篇。深浅不一：马齿苋、鱼腥草、香椿有形态、分布、用途、毒性各节；蕨、藜只有几行；致命鹅膏没有条目 | 形态、用途、栽培的正文 |
| 國家公園物種知識庫（台湾内政部，data.gov.tw 8658） | <https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/0BAA364D-53A4-4D05-8B3C-874C6731F489/resource/6DD94EA4-9837-4382-8992-710D81E818E0/download> | 政府資料開放授權條款－第 1 版 | 5,383 行，其中植物 2,965 种（无真菌）。2,907 种有成段的**形态特征**，2,964 种有生态习性，另有分布、俗名 | 可直接使用的中文形态描述 |
| Wikimedia Commons | <https://commons.wikimedia.org/> | 每个文件单独授权：CC0、公有领域、CC BY、CC BY-SA | 91,658 个植物条目在 Wikidata 上有图（`P18`）；接口返回作者与许可，短时间内请求过多会被限流 | 图片主力。图片域名在中国大陆无法访问，需转存 |
| iNaturalist Open Data | <https://github.com/inaturalist/inaturalist-open-data> | 每张照片单独授权，多数为 CC BY-NC | 未实测 | 只取 CC0、CC BY、CC BY-SA 的照片 |
| Mushroom Observer | <https://mushroomobserver.org/> | 每张图片单独授权，默认 CC BY-SA | 从本环境连接被重置，未能实测 | 真菌图片与观察记录 |
| 台灣食品營養成分資料集（台湾食药署，data.gov.tw 8543） | <https://data.fda.gov.tw/data/opendata/export/20/csv> | 政府資料開放授權條款－第 1 版 | 230,152 行，2,213 种食物：蔬菜 309、水果 242、菇类 57、谷物 89、豆类 44、坚果种子 40、藻类 22。列：分类、样品名、俗名、英文名、分析项、每 100 克含量 | 中文的营养成分表，带俗名 |
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
| 中国有用维管植物名录（Zhuang et al., Plant Diversity 2021）的论文附表 | <https://doi.org/10.1016/j.pld.2020.09.003> | CC BY-NC-ND 4.0 | 10,808 种 × 12 类用途的计数 | 不需要用它：同一团队在 ScienceDB 上以 CC BY 4.0 发布了明细数据（A 级的"中国有用植物数据集"） |
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
| GBIF 的中文俗名 | 都转自 Catalogue of Life；2023 年的骨干包里植物中文名只有 477 条 |
| Catalogue of Life 扩展版的中文俗名 | CC BY 4.0，141,942 条，但主要转自 iNaturalist 和 Wikidata，直接用上游 |
| data.gov.tw 24916 臺灣野生植物資料庫 | 只是一条指向外站的链接，外站标"版权所有" |
| 香港植物标本室、医管局《香港有毒植物图鉴》 | 未找到开放许可 |
| 新加坡 NParks | 条款禁止转载 |
| ctext.org 中国哲学书电子化计划 | 明示禁止自动抓取 |
| 殆知阁古籍库等 GitHub 古籍语料 | 无许可；维基文库有同样的文本 |
| ScienceDB 上其他大型真菌名录 | 多为 NC 或 NC-ND。例外（未下载）：东北亚大型真菌 `10.57760/sciencedb.j00152.0002c`（CC BY）、迪庆大型真菌 `10.57760/sciencedb.jwxb.00016`（CC BY-SA） |

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

- iNaturalist 分类名录的许可：档案本身不带 CC 许可，目前依据的是 ChecklistBank 上的 CC BY 登记。
- 台湾"政府資料開放授權條款－第 1 版"与 CC BY 4.0 相容的条款原文（许可页面是脚本渲染的，没能取到；各数据集的许可字段已逐个核对）。
- 真菌王国数据库的地址和条款。
- 两张 Starr 图片在 Commons 上的确切许可版本（查询时被限流）。
- 没能访问的站点：openkg.cn、gitee.com、agridata.cn（国家农业科学数据中心）、nsdata.cn、sp2000.org.cn、csdata.org。
- 去函 PFAF 和物种 2000 中国节点，申请开源再分发授权。
