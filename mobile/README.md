# App

React Native（Expo SDK 58），先出安卓，iOS 以后用同一套代码。

```bash
cd mobile
npm install
npx expo start       # 开发：手机装 Expo Go 扫码，或按 a 打开安卓模拟器
npm run typecheck
npx expo lint
npm run apk          # 本机打安卓安装包
```

## 页面

和网站手机宽度的五个入口一样：首页（搜索）、识别、检索、专题、急救，加上物种页和专题页。路由在 `src/app/`，一个文件一个页面。

## 和网站共用的代码

搜索、蘑菇特征检索的筛选、安全结论和部位表、急救电话，都写在 `../web/src/lib/`，网站和 App 引用同一份：

| 文件 | 内容 |
|---|---|
| `shared.js` | 安全等级、等级图形、分布大区 |
| `verdict.ts` | 物种数据的类型、安全结论、部位表、纠错链接 |
| `match.ts` | 名称搜索：中文名、别名、拼音、学名 |
| `finder.ts` | 蘑菇特征检索的筛选规则 |
| `aid.ts` | 各地急救电话、按时区猜地区、急救步骤和依据 |

App 里用 `@core/*` 引用（`tsconfig.json` 的 `paths`，`metro.config.js` 的 `watchFolders`）。这些文件不能依赖浏览器或 Worker。测试在网站那边：`cd web && npm test`。

## 数据

都从网站取，不另建服务：

| 数据 | 地址 | 本机保存 |
|---|---|---|
| 搜索索引（约 3 MB） | `/data/search.json`、`/api/overlay.json` | 一天后再问网站有没有更新 |
| 专题 | `/data/topics.json` | 同上 |
| 蘑菇特征检索 | `/data/finder.json` | 同上 |
| 数据来源和许可 | `/data/sources.json` | 一周 |
| 物种 | `/s/{id}.json` | 看过的存一天 |
| 急救 | 打包在 App 里 | 不用联网 |

存在 App 的文档目录里（`src/lib/store.ts`）。过期后带 `If-None-Match` 问网站，没变就续期；取不到时用旧的，没有旧的才提示连网。所以搜索、检索、专题和看过的物种页，下载过一次后没有网络也能用。

拍照识别走网站的 `/api/identify`，和网站共用每天的次数上限。网站只接受本站来源的请求，App 请求时带 `Origin: https://plants.ticoag.fun`。照片在手机上缩到长边 1600 像素、重新存成 JPEG 再上传，拍摄位置等信息不会带出去。

Wikimedia 拒绝安卓默认的 User-Agent（okhttp），所以 App 请求图片时带自己的 User-Agent（`src/lib/api.ts`）。

## 安卓安装包

`android/` 由 `expo prebuild` 按 `app.json` 生成，不进仓库，不要手改；要改原生配置就改 `app.json` 或配置插件。

本机打包要 JDK 17 以上和 Android SDK（`ANDROID_HOME` 指向它），第一次会下载 Gradle、NDK 和依赖：

```bash
npm run apk
# 产物：android/app/build/outputs/apk/release/app-release.apk
```

现在的安装包用调试密钥签名，可以直接装到手机上试，不能上架。上架前要换成正式密钥（自己的 keystore，或 `npx eas-cli build`），密钥不进仓库。

图标和启动图在 `assets/`，图形和网站的 `favicon.svg` 一样。
