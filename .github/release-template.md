<!--
GitHub Release 正文的模板。推送版本 tag 后，.github/workflows/android.yml 调用
.github/scripts/release_notes.py 渲染它。这段注释不进正文。

{{名字}} 换成值；{{#名字}}…{{/名字}} 这一段只在值不为空时保留。

  VERSION      版本号，如 1.2.3、1.2.3-rc.1
  TAG          v1.2.3
  PREVIOUS     改动列表从哪个 tag 算起；第一个版本为空
  PRERELEASE   预发布版为“是”，正式版为空
  HIGHLIGHTS   附注 tag 的说明（git tag -a v1.2.3 -m "…"）；轻量 tag 为空
  APK          文件名
  APK_URL      下载地址
  APK_SIZE     大小
  MIN_ANDROID  能装的最低 Android 版本，如 7.0；从 APK 的 minSdk 推出
  APK_SHA256   APK 的 SHA-256
  CERT_SHA256  签名证书的 SHA-256，每个版本都一样
  CHANGES      GitHub 按 .github/release.yml 分类生成的改动列表
-->
{{#HIGHLIGHTS}}
{{HIGHLIGHTS}}

{{/HIGHLIGHTS}}
## 下载

[{{APK}}]({{APK_URL}}) · {{APK_SIZE}} · Android {{MIN_ANDROID}} 及以上

| | SHA-256 |
|---|---|
| APK | `{{APK_SHA256}}` |
| 签名证书 | `{{CERT_SHA256}}` |

## 改动

{{CHANGES}}

> 野外采食有风险。本应用的内容不能替代专业鉴定；无法确认的物种一律不要食用。
