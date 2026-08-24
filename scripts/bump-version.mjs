// CI 发布脚本：version patch +1，Android versionCode +1，iOS buildNumber +1。
// 用法：node scripts/bump-version.mjs [--check]
// --check 只输出将发布的新版本号，不写回文件。

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'version.json');
const current = JSON.parse(readFileSync(file, 'utf8'));

function bumpPatch(version) {
  const [major, minor, patch] = version.split('.').map((part) => Number.parseInt(part, 10));
  return `${major}.${minor}.${patch + 1}`;
}

const next = {
  version: bumpPatch(current.version),
  androidVersionCode: current.androidVersionCode + 1,
  iosBuildNumber: current.iosBuildNumber + 1,
};

if (process.argv.includes('--check')) {
  console.log(next.version);
  process.exit(0);
}

writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
console.log(next.version);
