// CI 发布脚本：prebuild 之后注入正式签名。
// 环境变量（来自 GitHub secrets）：ANDROID_KEYSTORE_BASE64 / ANDROID_KEYSTORE_PASSWORD /
// ANDROID_KEY_ALIAS / ANDROID_KEY_PASSWORD。任一缺失时跳过，保留模板 debug 签名（本地构建）。

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gradleFile = join(root, 'android', 'app', 'build.gradle');
const keystoreFile = join(root, 'android', 'app', 'upload.keystore');

const base64 = process.env.ANDROID_KEYSTORE_BASE64;
const storePassword = process.env.ANDROID_KEYSTORE_PASSWORD;
const keyAlias = process.env.ANDROID_KEY_ALIAS;
const keyPassword = process.env.ANDROID_KEY_PASSWORD;

if (!base64 || !storePassword || !keyAlias || !keyPassword) {
  console.log('signing env missing, keeping template debug signing');
  process.exit(0);
}

if (!existsSync(gradleFile)) {
  console.error('android/app/build.gradle not found; run expo prebuild first');
  process.exit(1);
}

writeFileSync(keystoreFile, Buffer.from(base64, 'base64'));

let gradle = readFileSync(gradleFile, 'utf8');

const signingConfig = `
    signingConfigs {
        release {
            storeFile file('upload.keystore')
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
`;

const releaseBlock = /signingConfig signingConfigs\.debug/g;

if (releaseBlock.test(gradle)) {
  gradle = gradle.replace(
    /android \{/,
    (match) => `${match}${signingConfig}`,
  ).replace(/signingConfig signingConfigs\.debug/g, 'signingConfig signingConfigs.release');

  writeFileSync(gradleFile, gradle);
  console.log('release signing config injected');
} else {
  console.error('unexpected build.gradle template: debug signing reference not found');
  process.exit(1);
}
