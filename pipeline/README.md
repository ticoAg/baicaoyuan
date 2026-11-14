# 数据管线

开放数据源 → `data/snapshot/*.parquet`。网站和别的下游都只读这份快照。

```bash
cd pipeline
uv sync
uv run python fetch.py     # 下载原始数据到 data/raw/（约 350 MB，不入库）
uv run python build.py     # 合并，输出 data/snapshot/
uv run python images.py    # 给配图查作者与许可（端点限流，全量约一小时；可跳过）
uv run python build.py     # 带上图片再合并一次
```

| 文件 | 作用 |
|---|---|
| `sources.py` | 数据源清单：地址、许可、版本。网站的"数据来源"页也读它 |
| `fetch.py` | 下载文件；跑 Wikidata 的 SPARQL 查询（QLever 镜像，失败时换官方端点） |
| `images.py` | 从 Wikimedia Commons 的结构化数据取图片的作者与许可 |
| `vocab.py` | 受控词表：生活型、毒性分级、部位、蘑菇形态等取值的中文 |
| `build.py` | 学名对齐、中文名清洗、用途、毒性、安全等级，写出 Parquet |

## 快照里的表

| 表 | 一行是什么 |
|---|---|
| `taxa` | 一个物种：学名、中文名、科属、生活型、安全等级 |
| `names` | 一个中文名：正名或别名，带来源 |
| `dist` | 物种在一个 TDWG 三级区的分布：原生或引入 |
| `uses` | 一条用途记录：类别、文字、文献 |
| `flags` | 一个用途标记（有记载即标记，不代表安全） |
| `parts` | 一条按部位的记录：结论、用途、备注 |
| `hazards` | 一条毒性记录：等级、部位、毒素 |
| `traits` | 真菌的一项形态特征 |
| `images` | 一张图片：文件名、作者、许可 |
| `sources` | 一个数据源 |

每一行都有 `source`，对应 `sources` 表的 `id`。

## 几条规则

- **物种范围**：WCVP 记录在中国（含台湾）有分布的接受种，加上中文来源提到的其他物种（多为栽培作物）。真菌只收 Wikidata 上有可食性声明、且有中文名的。
- **学名对齐**：别的来源里的学名先化成二名法，再经 WCVP 的异名表归并到接受种；种下等级并入种。
- **中文名**：正名的优先级是 Wikidata 简体标签 → 中文维基标题 → TaiCOL → 中国有用植物数据集。别名如果和另一个物种的正名相同，去掉（多半是错配）。
- **安全等级**：取最严。管线只会给出 `deadly`、`toxic`、`suspect`（中文名或别名里带「毒」「断肠」等字样）、`restricted`、`food_record`、`unknown`；`edible`、`processed`、`limited` 留给人工审核过的词条。合并规则见 [docs/product.md](../docs/product.md#安全表达)。
