# 网站

Astro 站点，部署在 Cloudflare Workers 上。

```bash
cd web
npm install
npm run dev        # 本地开发
npm run build      # 生成 dist/
npm run preview    # 用 workerd 在本地跑构建结果
npm run deploy     # wrangler deploy
```

构建前会先跑 `scripts/build-data.mjs`，把 `../data/snapshot/*.parquet` 转成网站用的数据。数据目录可以用 `BCY_DATA_DIR` 指到别处。

## 怎么渲染

| 页面 | 方式 |
|---|---|
| 首页、专题、分类（科、属）、关于 | 构建时预渲染成静态文件 |
| 物种页 `/s/{id}`、物种 JSON `/s/{id}.json` | Worker 按需渲染 |
| 搜索 | 浏览器里做，索引是一个静态文件 `/data/search.json` |

物种页不预渲染，是因为 Cloudflare 免费额度每个 Worker 最多 2 万个静态文件，而物种有 3.8 万个。物种数据按 id 的哈希分成 1024 个 JSON 分片放在静态资源里，Worker 通过 `ASSETS` 绑定读取对应的分片再渲染。不需要数据库，数据和代码随同一次部署发布。

免费额度：静态文件请求不限量、不计费；Worker 每天 10 万次请求，只有物种页和物种 JSON 会用到。

## 部署

两种方式，任选其一：

- **Workers Builds**：在 Cloudflare 控制台把这个仓库连到一个 Worker，根目录填 `web`，构建命令 `npm run build`，部署命令 `npx wrangler deploy`。
- **GitHub Actions**：在仓库的 Secrets 里加 `CLOUDFLARE_API_TOKEN`（权限：Workers Scripts 编辑）和 `CLOUDFLARE_ACCOUNT_ID`，`.github/workflows/web.yml` 会在 main 更新时部署。

`workers.dev` 域名在中国大陆无法访问，面向大陆用户需要绑定自己的域名。绑定后可以用仓库变量 `SITE_URL` 设置站点地址。

## 目录

| 路径 | 内容 |
|---|---|
| `scripts/build-data.mjs` | Parquet → 物种分片、搜索索引、分类与专题数据 |
| `src/lib/shared.js` | 构建脚本、Worker、浏览器共用的常量：安全等级、分区、分片函数 |
| `src/lib/species.ts` | 读取物种数据；物种页顶部安全结论的措辞 |
| `src/scripts/search.ts` | 浏览器内搜索：中文名、别名、拼音、学名 |
| `src/pages/` | 页面 |
