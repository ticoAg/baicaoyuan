# 网站

Astro 站点，部署在 Cloudflare Workers 上。

```bash
cd web
npm install
npm run dev        # 本地开发：生成数据、灌进本地 D1、启动
npm run build      # 生成 dist/
npm run preview    # 构建后用 workerd 在本地跑
npm run deploy     # 构建、把数据同步到线上 D1、发布
```

## 怎么渲染

| 页面 | 方式 |
|---|---|
| 首页、专题、分类（科、属）、关于 | 构建时预渲染成静态文件 |
| 物种页 `/s/{id}`、物种 JSON `/s/{id}.json` | Worker 按需渲染，数据读 D1，结果进边缘缓存 |
| 搜索 | 浏览器里做，索引是一个静态文件 `/data/search.json` |

## 数据

`npm run data`（`scripts/build-data.mjs`）把 `../data/snapshot/*.parquet` 转成三样东西：

| 产物 | 去向 |
|---|---|
| `.data/species.ndjson` | 物种详情，一行一个物种，由 `scripts/db-sync.mjs` 灌进 D1 |
| `public/data/search.json` | 搜索索引，随站点发布 |
| `src/generated/*.json` | 分类、专题、统计，预渲染时读取 |

快照目录可以用 `BCY_DATA_DIR` 指到别处。

D1 里只有两张表（`db/schema.sql`）：`species(id, hash, doc)` 一个物种一行 JSON，`meta` 记同步时间。同步脚本比对哈希，只写有变化的行：

```bash
npm run db:local     # 本地开发库，在 .wrangler/state 里
npm run db:remote    # 线上库
```

不拆成多张表，是因为 D1 免费额度每天只能写 10 万行，一个物种一行（3.8 万行）才灌得进去。要做查询功能时再按需加表。

## 缓存

物种页和物种 JSON 走 Cache API（`src/middleware.ts`），一小时过期，所以线上数据更新后最多一小时生效。

- Cache API 只在自定义域名上生效，`workers.dev` 上不起作用。
- 命中缓存时 Worker 仍会执行，省的是数据库读取和渲染，不省请求次数。
- 没有开 Workers Cache：开启后静态文件请求也计入 Worker 请求数。

## 免费额度

| | 额度 | 用在哪 |
|---|---|---|
| 静态文件 | 每个 Worker 2 万个，请求不限量 | 现在约 4,200 个 |
| Worker 请求 | 每天 10 万次 | 只有物种页和物种 JSON |
| D1 读 | 每天 500 万行 | 物种页一次读一行 |
| D1 写 | 每天 10 万行 | 首次同步写 3.8 万行，之后只写变化的 |

D1 的额度是整个账号共用的，不是每个数据库各算各的。

## 部署

两种方式，任选其一。两种都需要凭据有 D1 的编辑权限。

- **Workers Builds**：在 Cloudflare 控制台把这个仓库连到一个 Worker，根目录填 `web`，构建命令 `npm run build`，部署命令 `npm run db:remote && npx wrangler deploy`。
- **GitHub Actions**：在仓库的 Secrets 里加 `CLOUDFLARE_API_TOKEN`（权限：Workers Scripts 编辑、D1 编辑）和 `CLOUDFLARE_ACCOUNT_ID`，`.github/workflows/web.yml` 会在 main 更新时同步数据并部署。

`workers.dev` 域名在中国大陆无法访问，面向大陆用户需要绑定自己的域名。绑定后可以用仓库变量 `SITE_URL` 设置站点地址。

## 目录

| 路径 | 内容 |
|---|---|
| `scripts/build-data.mjs` | Parquet → 物种文档、搜索索引、分类与专题数据 |
| `scripts/db-sync.mjs` | 物种文档 → D1，按哈希增量同步 |
| `db/schema.sql` | D1 表结构 |
| `src/middleware.ts` | 物种页的边缘缓存 |
| `src/lib/shared.js` | 构建脚本、Worker、浏览器共用的常量：安全等级、分区 |
| `src/lib/species.ts` | 读取物种数据；物种页顶部安全结论的措辞 |
| `src/scripts/search.ts` | 浏览器内搜索：中文名、别名、拼音、学名 |
| `src/pages/` | 页面 |
