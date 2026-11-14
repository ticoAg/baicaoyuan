# 百草园

开源的中文植物与真菌知识库。面向户外探险和乡居生活：认得出，知道能不能吃、怎么处理、怎么种。

<https://plants.ticoag.fun>

- 名称、别名、地方名
- 形态特征、图片
- 地域分布、生境
- 各部位的用途与处理方法
- 毒性、中毒类型、易混淆物种
- 栽培方法

| 目录 | 内容 |
|---|---|
| [pipeline/](pipeline/) | 数据管线：开放数据源 → Parquet |
| [data/snapshot/](data/snapshot/) | 管线输出的数据快照（Parquet） |
| [web/](web/) | 网站：Astro，部署在 Cloudflare Workers |
| [docs/product.md](docs/product.md) | 产品形态 |
| [docs/research.md](docs/research.md) | 同类项目与数据源调研 |
| [docs/sources.md](docs/sources.md) | 数据源登记：地址、许可、实测结果 |

## 本地运行

```bash
cd web
npm install
npm run dev
```

仓库里带着数据快照，网站可以直接构建。要重新生成数据，见 [pipeline/README.md](pipeline/README.md)。

> 野外采食有风险。本项目内容不能替代专业鉴定；无法确认的物种一律不要食用。
