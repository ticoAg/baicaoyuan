plugins {
    id("com.android.application")
}

// 版本号只来自 git tag：发布工作流传 -PappVersion=1.2.3（tag v1.2.3 去掉 v），本地不传就是 0.0.0-dev。
val appVersion: String = providers.gradleProperty("appVersion").getOrElse("0.0.0-dev")

// versionCode 由版本号推出，越新越大，手机上才能覆盖安装：
//   1.2.3          → 1020399
//   1.2.3-alpha.4  → 1020304   alpha.1–29
//   1.2.3-beta.4   → 1020334   beta.1–29
//   1.2.3-rc.4     → 1020364   rc.1–29
fun versionCodeOf(version: String): Int {
    if (version == "0.0.0-dev") return 1
    val m = Regex("""(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?""").matchEntire(version)
        ?: throw GradleException("版本号 $version 不合规则：应写成 1.2.3，或 1.2.3-alpha.1、1.2.3-beta.1、1.2.3-rc.1")
    val (major, minor, patch) = (1..3).map { m.groupValues[it].toInt() }
    val stage = m.groupValues[4]
    val n = m.groupValues[5].toIntOrNull() ?: 0
    if (major > 2000 || minor > 99 || patch > 99) throw GradleException("版本号 $version 超出范围：次版本号、修订号不能超过 99")
    if (stage.isNotEmpty() && n !in 1..29) throw GradleException("版本号 $version 超出范围：预发布序号只能是 1 到 29")
    val pre = when (stage) {
        "alpha" -> n
        "beta" -> 30 + n
        "rc" -> 60 + n
        else -> 99
    }
    return major * 1_000_000 + minor * 10_000 + patch * 100 + pre
}

// 发布签名只从环境变量读，密钥不进仓库。没有 BCY_KEYSTORE 时 release 包不签名。
val keystore: String? = providers.environmentVariable("BCY_KEYSTORE").orNull
fun secret(name: String): String =
    providers.environmentVariable(name).orNull ?: throw GradleException("设了 BCY_KEYSTORE，还要设 $name")

android {
    namespace = "io.github.ticoag.baicaoyuan"
    compileSdk = 37

    defaultConfig {
        applicationId = "io.github.ticoag.baicaoyuan"
        minSdk = 24
        // 37 的行为变化还没在真机上试过，先停在 36
        targetSdk = 36
        versionCode = versionCodeOf(appVersion)
        versionName = appVersion
    }

    signingConfigs {
        if (keystore != null) {
            create("release") {
                storeFile = file(keystore)
                storePassword = secret("BCY_KEYSTORE_PASSWORD")
                keyAlias = secret("BCY_KEY_ALIAS")
                keyPassword = secret("BCY_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.findByName("release")
        }
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.activity:activity:1.13.0")
    implementation("androidx.core:core:1.19.1")
}
