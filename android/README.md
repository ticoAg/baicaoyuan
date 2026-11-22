# Android 应用

一个 WebView 外壳：全屏打开 <https://plants.ticoag.fun>，内容随网站更新，不分两套代码。不依赖 Chrome 和 Google 服务。APK 发布在 [Releases](https://github.com/ticoAg/baicaoyuan/releases)。

| | |
|---|---|
| 站内链接 | 留在应用里 |
| 外站链接、电话 | 交给浏览器、拨号 |
| 拍照识别 | 选图或直接拍照 |
| 断网 | 网站的 service worker 缓存的急救、蘑菇特征检索、毒蘑菇专题照常能看；第一次打开要联网 |
| 长按图标 | 急救、检索、识别 |
| 深色模式 | 跟随系统 |

## 本地构建

要 JDK 17 以上和 Android SDK（设好 `ANDROID_HOME`）。

```bash
cd android
./gradlew assembleDebug                          # app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease -PappVersion=1.2.3     # 没设签名变量时出未签名的包
```

签名变量和 CI 里一样：`BCY_KEYSTORE`（密钥库路径）、`BCY_KEYSTORE_PASSWORD`、`BCY_KEY_ALIAS`、`BCY_KEY_PASSWORD`。

## 发布

```bash
git tag -a v1.2.3 -m "这一版的要点"
git push origin v1.2.3
```

推送 tag 后，`.github/workflows/android.yml` 依次：

1. 用 secrets 里的密钥构建 APK，版本号取自 tag
2. 核对签名，文件改名为 `baicaoyuan-1.2.3.apk`
3. 生成构建来源证明
4. 按 `.github/release-template.md` 写正文，建 Release“百草园 1.2.3”，附上 APK

| 什么时候 | 做什么 |
|---|---|
| PR 改了 `android/` | lint，构建 debug 包和不签名的 release 包；debug 包在运行记录里留 14 天 |
| 推送 `v1.2.3`、`v1.2.3-rc.1` 这样的 tag | 构建签名的 APK，发布 Release；带 `-` 的标为预发布版 |
| 在 Actions 页面手动运行，选分支 | 用正式密钥构建，APK 留在运行记录里，不发布；第一次发布前用它确认 secrets 设对了 |
| 手动运行，选 tag | 补发这个 tag 的 Release；已经有了就换掉 APK、更新正文 |

别的 tag（不是 `v` 加版本号的）不触发。

### 版本号

只来自 tag，仓库里不写版本号。versionCode 由版本号推出，越新越大，手机上才能覆盖安装。

| tag | versionName | versionCode |
|---|---|---|
| `v1.2.3` | 1.2.3 | 1020399 |
| `v1.2.3-alpha.4` | 1.2.3-alpha.4 | 1020304 |
| `v1.2.3-beta.4` | 1.2.3-beta.4 | 1020334 |
| `v1.2.3-rc.4` | 1.2.3-rc.4 | 1020364 |

次版本号、修订号不超过 99；预发布只认 `alpha`、`beta`、`rc`，序号 1 到 29。规则在 `app/build.gradle.kts`，不合规则的 tag 构建时报错。

### 发布说明

| 文件 | 管什么 |
|---|---|
| `.github/release-template.md` | 正文的样子；能用的占位符写在文件开头 |
| `.github/release.yml` | 改动列表的分类：PR 标签 `enhancement` 归新功能，`bug` 归修复；带 `ignore-for-release` 的不列 |
| `.github/scripts/release_notes.py` | 填模板。附注 tag 的说明放在最前面；改动列表正式版和上一个正式版比，预发布版和上一个 tag 比 |

## 签名密钥

第一次发布前做一次。之后每个版本都用同一把密钥：密钥丢了或换了，已经装了应用的人只能卸载重装。密钥库和密码存进密码管理器，`*.jks` 不进仓库。

```bash
keytool -genkeypair -v -keystore baicaoyuan-release.jks -alias baicaoyuan \
  -keyalg RSA -keysize 4096 -validity 36500 -dname "CN=baicaoyuan"
```

在仓库的 Settings → Secrets and variables → Actions 里加四个 secret：

| Secret | 值 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 < baicaoyuan-release.jks \| tr -d '\n'` 的输出 |
| `ANDROID_KEYSTORE_PASSWORD` | 密钥库密码 |
| `ANDROID_KEY_ALIAS` | `baicaoyuan` |
| `ANDROID_KEY_PASSWORD` | 密钥密码；keytool 默认的 PKCS12 格式里和密钥库密码相同 |

用 GitHub CLI 也行：

```bash
base64 < baicaoyuan-release.jks | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64
```

```bash
gh secret set ANDROID_KEYSTORE_PASSWORD
```

```bash
gh secret set ANDROID_KEY_ALIAS --body baicaoyuan
```

```bash
gh secret set ANDROID_KEY_PASSWORD
```

## 核对下载的 APK

每个 Release 都写着签名证书的 SHA-256，所有版本都应相同。APK 是不是这个仓库的工作流构建的：

```bash
gh attestation verify baicaoyuan-1.2.3.apk -R ticoAg/baicaoyuan
```

## 本站链接直接在应用里打开

Android 12 起，网站要声明这个应用归它所有。把 Release 里的签名证书 SHA-256 写进 `web/public/.well-known/assetlinks.json`：

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "io.github.ticoag.baicaoyuan",
      "sha256_cert_fingerprints": ["签名证书 SHA-256"]
    }
  }
]
```

部署后用 `curl https://plants.ticoag.fun/.well-known/assetlinks.json` 确认取得到，再重装应用。

## 目录

| 路径 | 内容 |
|---|---|
| `app/build.gradle.kts` | 版本号规则、签名配置 |
| `app/src/main/java/io/github/ticoag/baicaoyuan/MainActivity.kt` | WebView 设置、链接分流、选图拍照、返回键、断网提示 |
| `app/src/main/res/` | 图标（取自 `web/public/favicon.svg`）、长按图标的入口、颜色（取自 `web/src/styles/global.css`） |

换域名时改 `MainActivity.kt` 的 `HOST`、`AndroidManifest.xml` 和 `res/xml/shortcuts.xml` 里的地址。
