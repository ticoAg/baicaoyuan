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

搜索、特征检索的筛选、安全结论和部位表、急救电话，都写在 `../web/src/lib/`，网站和 App 引用同一份：

| 文件 | 内容 |
|---|---|
| `shared.js` | 安全等级、等级图形、分布大区 |
| `verdict.ts` | 物种数据的类型、安全结论、部位表、纠错链接 |
| `match.ts` | 名称搜索：中文名、别名、拼音、学名 |
| `finder.ts` | 特征检索的筛选规则 |
| `aid.ts` | 各地急救电话、按时区猜地区、急救步骤和依据 |

App 里用 `@core/*` 引用（`tsconfig.json` 的 `paths`，`metro.config.js` 的 `watchFolders`）。这些文件不能依赖浏览器或 Worker。测试在网站那边：`cd web && npm test`。

## 数据

都从网站取，不另建服务：

| 数据 | 地址 | 本机保存 |
|---|---|---|
| 搜索索引（约 3 MB，特征检索也用） | `/data/search.json`、`/api/overlay.json` | 一天后再问网站有没有更新 |
| 专题 | `/data/topics.json` | 同上 |
| 数据来源和许可 | `/data/sources.json` | 一周 |
| 物种 | `/s/{id}.json` | 看过的存一天 |
| 急救 | 打包在 App 里 | 不用联网 |

存在 App 的文档目录里（`src/lib/store.ts`）。过期后带 `If-None-Match` 问网站，没变就续期；取不到时用旧的，没有旧的才提示连网。本机存的搜索索引要是还没有特征码（早先的版本下载的），当作过期。所以搜索、检索、专题和看过的物种页，下载过一次后没有网络也能用。

拍照识别走网站的 `/api/identify`，和网站共用每天的次数上限。网站只接受本站来源的请求，App 请求时带 `Origin: https://plants.ticoag.fun`。照片在手机上缩到长边 1600 像素、重新存成 JPEG 再上传，拍摄位置等信息不会带出去。

Wikimedia 拒绝安卓默认的 User-Agent（okhttp），所以 App 请求图片时带自己的 User-Agent（`src/lib/api.ts`）。

## 安卓安装包

`android/` 由 `expo prebuild` 按 `app.json` 和 `app.config.ts` 生成，不进仓库，不要手改；要改原生配置就改这两个文件或配置插件，改完用 `npx expo prebuild --platform android --clean` 重新生成。

本机打包要 JDK 17 以上和 Android SDK（`ANDROID_HOME` 指向它），第一次会下载 Gradle、NDK 和依赖：

```bash
npm run apk
# 产物：android/app/build/outputs/apk/release/app-release.apk
```

默认版本号是 0.0.0-dev，用 debug 密钥签名，可以直接装到手机上试；和正式版签名不同，两者不能互相覆盖安装。要和 CI 一样构建，先设这些环境变量，由 `app.config.ts` 读取：

| 变量 | 值 |
|---|---|
| `APP_VERSION` | 版本号，如 `1.2.3` |
| `BCY_KEYSTORE` | 密钥库文件的绝对路径 |
| `BCY_KEYSTORE_PASSWORD` | 密钥库密码 |
| `BCY_KEY_ALIAS` | 密钥别名 |
| `BCY_KEY_PASSWORD` | 密钥密码 |

图标和启动图在 `assets/`，图形和网站的 `favicon.svg` 一样。

## 发布

两种办法，结果一样：

- 在 GitHub 的 Actions 页面手动运行「Android」，分支选 main，填 tag（如 `v1.2.3`）和说明。工作流在 main 最新的提交上打附注 tag，再在这个 tag 上运行一次。网页上的说明只能写一行；用 API 运行时可以多行，第一行是标题。
- 本地打 tag 推上去：

```bash
git tag -a v1.2.3 -m "这一版的要点"
git push origin v1.2.3
```

tag 推上去后，`.github/workflows/android.yml` 依次：

1. 用 secrets 里的密钥构建 APK，版本号取自 tag
2. 核对版本号和签名，文件改名为 `baicaoyuan-1.2.3.apk`
3. 生成构建来源证明
4. 按 `.github/release-template.md` 写正文，建 Release“百草园 1.2.3”，附上 APK

| 什么时候 | 做什么 |
|---|---|
| PR 改了 `mobile/` 或 `web/src/lib/` | 类型检查、lint，构建 debug 密钥签名的 release 包，在运行记录里留 14 天 |
| 推送 `v1.2.3`、`v1.2.3-rc.1` 这样的 tag | 构建签名的 APK，发布 Release；带 `-` 的标为预发布版 |
| 在 Actions 页面手动运行，选 main，填 tag 和说明 | 打附注 tag，再在这个 tag 上运行，发布 Release；tag 已经有了、不合版本号规则或者没写说明时报错，不打 tag |
| 手动运行，选分支，不填 tag | 用正式密钥构建，APK 留在运行记录里，不发布；第一次发布前用它确认 secrets 设对了 |
| 手动运行，选 tag，不填 tag | 补发这个 tag 的 Release；已经有了就换掉 APK、更新正文 |

别的 tag（不是 `v` 加版本号的）不触发。

### 版本号

只来自 tag。versionCode 由版本号推出，越新越大，手机上才能覆盖安装。

| tag | versionName | versionCode |
|---|---|---|
| `v1.2.3` | 1.2.3 | 1020399 |
| `v1.2.3-alpha.4` | 1.2.3-alpha.4 | 1020304 |
| `v1.2.3-beta.4` | 1.2.3-beta.4 | 1020334 |
| `v1.2.3-rc.4` | 1.2.3-rc.4 | 1020364 |

次版本号、修订号不超过 99；预发布只认 `alpha`、`beta`、`rc`，序号 1 到 29。规则在 `app.config.ts`，不合规则的 tag 构建时报错。

### 发布说明

| 文件 | 管什么 |
|---|---|
| `.github/release-template.md` | 正文的样子；能用的占位符写在文件开头 |
| `.github/release.yml` | 改动列表的分类：PR 标签 `enhancement` 归新功能，`bug` 归修复；带 `ignore-for-release` 的不列 |
| `.github/scripts/release_notes.py` | 填模板。附注 tag 的说明放在最前面；改动列表正式版和上一个正式版比，预发布版和上一个 tag 比 |

## 签名密钥

第一次发布前做一次。之后每个版本都用同一把密钥：密钥丢了或换了，已经装了 App 的人只能卸载重装。密钥库和密码存进密码管理器，`*.jks` 不进仓库。

```bash
keytool -genkeypair -v -keystore baicaoyuan-release.jks -alias baicaoyuan \
  -keyalg RSA -keysize 4096 -validity 36500 -dname "CN=baicaoyuan"
```

在仓库的 Settings → Secrets and variables → Actions 里加两个 secret：

| Secret | 值 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 < baicaoyuan-release.jks \| tr -d '\n'` 的输出 |
| `ANDROID_KEYSTORE_PASSWORD` | 密钥库密码 |

别名 `baicaoyuan` 写在工作流里，不要设成 secret：runner 会丢掉含 secret 值的 job 输出，APK 文件名 `baicaoyuan-1.2.3.apk` 含别名，就传不到发布那一步。密钥密码用密钥库密码，keytool 默认的 PKCS12 格式里两者相同。

用 GitHub CLI 也行：

```bash
base64 < baicaoyuan-release.jks | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64
```

```bash
gh secret set ANDROID_KEYSTORE_PASSWORD
```

## 核对下载的 APK

每个 Release 都写着签名证书的 SHA-256，所有版本都应相同。APK 是不是这个仓库的工作流构建的：

```bash
gh attestation verify baicaoyuan-1.2.3.apk -R ticoAg/baicaoyuan
```
