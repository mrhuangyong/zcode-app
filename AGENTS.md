# AGENTS.md

## 项目定位

ZCode Remote：iOS/Android 原生壳（Expo SDK 57 + React Native 0.86 + WebView），完整承载 ZCode 官方 Web Remote Control（`https://zcode.z.ai/remote/v4`）。原生层**不重写**远控业务，只提供安全存储、深链、扫码连接、返回手势、外部链接分流、错误恢复、屏幕常亮与键盘/安全区适配。

## 目录结构

- `App.tsx` — 入口：启动时读取 SecureStore 设备列表 / 处理深链 / 静默检查更新，进入 DeviceListScreen 或 RemoteShell；扫码弹层全局挂载
- `src/components/` — `RemoteShell`（WebView 壳 + 导航分流 + Android 返回键）、`DeviceListScreen`（设备列表首页 + 重命名/删除 + 更新卡片）、`QRScannerScreen`（相机扫码 + 相册图片识别）、`ErrorScreen`
- `src/lib/` — `remote-url.ts`（URL 校验/脱敏/深链解析纯函数）、`navigation.ts`（导航目标判定）、`secure-remote-store.ts`（SecureStore 多设备存储）、`qr-image.ts`（相册图片二维码解码）、`updater.ts`（GitHub Release 更新检查）
- `scripts/` — `bump-version.mjs`（版本号自增）、`inject-android-signing.mjs`（CI 正式签名注入）
- `.github/workflows/release.yml` — push main 自动：bump 版本 → tag → prebuild → 签名 → 打 APK → GitHub Release 附件
- `docs/superpowers/specs|plans/` — 设计 spec 与实施计划，改动安全/架构行为前先读
- `android/`、`ios/`、`dist/` — prebuild 生成的原生工程与构建产物，Git 与 ESLint 均忽略，不要手改提交

## 常用命令

```bash
npm start                # expo start（Expo Go 扫码运行）
npm test                 # jest（jest-expo preset）；串行跑：npm test -- --runInBand
npm run typecheck        # tsc --noEmit（strict）
npm run lint             # expo lint
npm run verify           # test + typecheck
npm run verify:all       # verify + lint + expo-doctor + export:web（完整质量门）
npm run export:web       # Web 静态打包校验 → dist/
npm run ios:release      # iOS Release 构建
npm run android:release  # Android release APK
```

## 安全边界（改代码必须遵守）

- WebView 只允许加载 `https://zcode.z.ai/remote/v4`（见 `src/lib/remote-url.ts` 的 `ZCODE_ORIGIN` / `REMOTE_PATHS`）。放宽白名单属于架构变更。
- 登录授权域：`src/lib/navigation.ts` 的 `AUTH_ROOTS`（`chat.z.ai` / `bigmodel.cn` 及其子域）映射为 `auth` 目标，由 `AuthBrowserModal` 在应用内打开；但远控页登录页会对嵌入环境做 intent 逃逸强行送系统浏览器，无法完全拦截。登录实现（勿回退为系统浏览器方案）：远控页把 OAuth 授权页用 window.open/intent:// 强行送系统浏览器，而 OAuth 的 CSRF state 存在 WebView 的 localStorage（oauth_pending_logins），跨上下文回调必然失败。当前实现：RemoteShell 注入 BROWSER_SHIM（window.chrome 垫片 + window.open 改写为当前窗口导航 + 轮询 oauth_pending_logins），读到待登录请求后自建授权 URL 交给 AuthBrowserModal 在应用内完成登录（共享存储，CSRF 通过），overlay 关闭后 reload 主页面接管会话。另依赖 scripts/patch-webview-popups.mjs 原生补丁（RN 0.86 Fabric 下 onShouldStartLoadWithRequest 静默失效，导航策略必须下沉到原生层；npm ci 后需重跑）。不要放宽 `AUTH_ROOTS` 到 `z.ai` 根域（docs.z.ai 等文档站须走系统浏览器）。
- 远控 URL 含会话凭据：只存 SecureStore（`STORAGE_KEY = 'zcode.remote.url.v1'`），UI 展示必须经 `redactRemoteUrl` 脱敏；**禁止**把真实会话链接硬编码进源码、测试、日志或文档（历史上有过移除真实指纹的修复，勿回退）。
- 构建过程不读取、不注入、不打包 `EXPO_PUBLIC_ZCODE_REMOTE_URL`。
- 导航分流规则在 `src/lib/navigation.ts`：`zcode.z.ai` 与 `about:/data:/blob:` 留在 WebView；`http(s)/mailto/tel/sms` 交系统浏览器；其余 blocked。改 WebView 行为时同步维护该纯函数及其测试。
- 深链 scheme 为 `zcode-mobile://connect?url=<encoded>`，解析必须走 `parseConnectDeepLink`（含目标 URL 再校验）。

## 编码约定

- TypeScript strict；测试文件与源码同目录（`*.test.ts(x)`），纯函数逻辑优先抽到 `src/lib/` 并直接测函数。
- 组件用函数组件 + hooks，样式用 `StyleSheet.create`；颜色与字体统一取自 `src/lib/theme.ts`（`colors` / `type` / `monoFont`），不要在组件里写散落色值。语义：`ultramarine` 只用于可交互元素，`signal` 只用于链路已建立/已验证状态，`danger` 只用于错误提示；背景 `void #080B12` 与启动图保持一致。
- 终端等宽字体（iOS Menlo / 其他 monospace）用于状态读出、眉题与链接预览等"仪器读数"文案；用户引导文案保持中文无衬线。
- 交互元素提供 `testID` 与 `accessibilityLabel`（现有测试依赖）。
- Android 返回键优先 `webView.goBack()`，不能回退才退出（`RemoteShell` 中 BackHandler）。

## 本机环境注意

- 本机 npm 12 与 Expo CLI 不兼容：`npx expo install` 会报 EALLOWSCRIPTS，增删依赖直接用 `npm install <pkg>`，版本按 `node_modules/expo/bundledNativeModules.json` 锁定。
- TS 6 已废弃 tsconfig `baseUrl`；RN 0.86 移除了 `StyleSheet.absoluteFillObject`，不要使用。
- 推送 GitHub 偶发 SSL 中断时重试即可；本机 127.0.0.1:7890 有可用代理。

## 发布与更新链路

- 版本号唯一事实来源：`version.json`（`version` / `androidVersionCode` / `iosBuildNumber`），`app.config.ts` 从中读取；**不要**在 app.config.ts 里硬编码版本。
- push 到 main → `.github/workflows/release.yml`：`scripts/bump-version.mjs` 自增版本 → 提交回 main（`[skip ci]` 防循环）→ 打 tag `vX.Y.Z` → `expo prebuild` → `scripts/inject-android-signing.mjs` 注入正式签名 → gradle 出 APK → 上传为 GitHub Release 附件 `zcode-remote-vX.Y.Z.apk`。
- 正式签名 keystore：`~/projects/aieditor/keystores/zcode-remote.keystore`（密码同目录 `.password` 文件，alias `zcoderemote`）。**务必备份**，丢失后用户必须卸载重装。GitHub secrets：`ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD`。
- 应用内更新：`src/lib/updater.ts` 匿名查 `api.github.com/repos/mrhuangyong/zcode-app/releases/latest`（仓库需保持公开），对比 `Constants.expoConfig.version`，新版本时 DeviceListScreen 顶部出更新卡片，下载走系统浏览器打开 Release 附件直链。改 GitHub 仓库地址需同步 `updater.ts` 的 `GITHUB_REPO`。
