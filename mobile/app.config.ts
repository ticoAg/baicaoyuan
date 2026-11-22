// 发布用的两项设置，见 README.md 的“发布”：
// - 版本号取自环境变量 APP_VERSION，CI 里来自 tag；没设时是 0.0.0-dev
// - 设了 BCY_KEYSTORE 等环境变量时，release 包用这把密钥签名；没设时用 debug 密钥，能直接装到手机上试
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { withAppBuildGradle } from 'expo/config-plugins';

const DEV_VERSION = '0.0.0-dev';

// versionCode 越新越大，手机上才能覆盖安装。1.2.3 → 1020399；
// 预发布版排在同号正式版前面：alpha.N 末两位是 N，beta.N 是 30+N，rc.N 是 60+N，正式版是 99
function versionCode(version: string): number {
  if (version === DEV_VERSION) return 1;
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/.exec(version);
  if (!m) {
    throw new Error(`版本号 ${version} 不合规则：应写成 1.2.3，或 1.2.3-alpha.1、1.2.3-beta.1、1.2.3-rc.1`);
  }
  const [major, minor, patch, n] = [m[1], m[2], m[3], m[5] ?? '0'].map(Number);
  const stage = m[4];
  if (major > 2000 || minor > 99 || patch > 99) {
    throw new Error(`版本号 ${version} 超出范围：主版本号不能超过 2000，次版本号、修订号不能超过 99`);
  }
  if (stage && (n < 1 || n > 29)) {
    throw new Error(`版本号 ${version} 超出范围：预发布序号只能是 1 到 29`);
  }
  const pre = stage === 'alpha' ? n : stage === 'beta' ? 30 + n : stage === 'rc' ? 60 + n : 99;
  return major * 1_000_000 + minor * 10_000 + patch * 100 + pre;
}

// 加在 android/app/build.gradle 末尾。密钥库和密码在构建时从环境变量读，不写进文件
const SIGNING = `
// 正式签名，由 app.config.ts 加上
if (System.getenv('BCY_KEYSTORE')) {
    android {
        signingConfigs {
            release {
                storeFile file(System.getenv('BCY_KEYSTORE'))
                storePassword System.getenv('BCY_KEYSTORE_PASSWORD')
                keyAlias System.getenv('BCY_KEY_ALIAS')
                keyPassword System.getenv('BCY_KEY_PASSWORD')
            }
        }
        buildTypes {
            release {
                signingConfig signingConfigs.release
            }
        }
    }
}
`;

function withReleaseSigning(config: ExpoConfig): ExpoConfig {
  return withAppBuildGradle(config, (config) => {
    const gradle = config.modResults;
    if (gradle.language !== 'groovy') {
      throw new Error(`正式签名只会加进 Groovy 写的 build.gradle：${gradle.path}`);
    }
    // 没加 --clean 的 prebuild 会在已经生成的文件上再跑一遍
    if (!gradle.contents.includes('BCY_KEYSTORE')) gradle.contents += SIGNING;
    return config;
  });
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const version = process.env.APP_VERSION || DEV_VERSION;
  return withReleaseSigning({
    ...(config as ExpoConfig), // name、slug 写在 app.json 里
    version,
    android: { ...config.android, versionCode: versionCode(version) },
  });
};
