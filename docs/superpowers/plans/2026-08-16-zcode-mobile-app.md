# ZCode 移动端 APP 实施计划

## 固定决策

- 技术栈：Expo React Native + TypeScript + `react-native-webview`。
- 项目名：`ZCode Remote`，scheme：`zcode-mobile`。
- 官方 Web 前端是唯一业务功能实现，原生层只做壳和系统集成。
- 会话 URL 不写入 Git、源码、环境变量或构建产物。

## 文件结构

- `app.json`：App 名称、图标、scheme、iOS/Android 配置。
- `app.config.ts`：只负责原生 App 配置，不读取或注入远控 URL。
- `App.tsx`：入口与状态机（loading/configured/error）。
- `src/lib/remote-url.ts`：纯函数 URL 校验、规范化、脱敏、深链解析。
- `src/lib/remote-url.test.ts`：URL 行为测试。
- `src/lib/secure-remote-store.ts`：SecureStore 读写封装。
- `src/lib/secure-remote-store.test.ts`：存储行为测试。
- `src/components/RemoteShell.tsx`：WebView、返回键、外部链接、错误恢复。
- `src/components/SetupScreen.tsx`：安全链接配置界面。
- `src/components/ErrorScreen.tsx`：连接错误界面。
- 远控 URL 只来自扫码、手动输入或深链，不提供环境变量模板。

## Task 1 - 初始化 Expo 工程

1. 在空目录生成 Expo blank TypeScript 项目。
2. 安装运行依赖：`react-native-webview`、`expo-secure-store`、`expo-keep-awake`。
3. 安装测试依赖：`jest`、`jest-expo`、`@types/jest`。
4. 初始化 Git，加入 `.gitignore`，并确认远控 URL 不进入源码或构建配置。
5. 建立脚本：`test`、`typecheck`、`lint`。

## Task 2 - RED：先写 URL 测试

新增 `src/lib/remote-url.test.ts`，目标 API：

```ts
export const ZCODE_ORIGIN = 'https://zcode.z.ai';
export const STORAGE_KEY = 'zcode.remote.url.v1';
export function normalizeRemoteUrl(input: string): string | null;
export function isSafeRemoteUrl(input: string): boolean;
export function redactRemoteUrl(input: string): string;
export function parseConnectDeepLink(input: string): string | null;
export function resolveInitialUrl(options: { stored?: string | null; configured?: string | null }): string | null;
```

必须先验证以下失败行为：

```ts
it('accepts only the official HTTPS ZCode remote route')
it('keeps all session query parameters')
it('rejects insecure and non-ZCode URLs')
it('redacts credentials from the visible URL')
it('extracts an encoded connect deep link')
it('prefers stored URL over build-time URL')
```

执行 `npm test -- --runInBand`，确认因实现缺失而失败。

## Task 3 - GREEN：实现 URL 纯函数

- 用 `URL` 解析，不用正则拼接凭据。
- 仅接受 `https:`、`zcode.z.ai`、路径 `/` 或 `/remote/v4/` 开头。
- 序列化时完整保留 query。
- 脱敏 `sid`、`hash`、`t`、`mid` 等敏感 query。
- 深链支持 `zcode-mobile://connect?url=<encoded>`，只返回通过安全校验的 URL。
- SecureStored URL 与构建配置 URL 都必须经过同一校验。

## Task 4 - RED/GREEN：安全存储封装

先写测试验证：

- 保存合法 URL 调用 SecureStore.setItemAsync。
- 拒绝非法 URL，不触发写入。
- 读取损坏值时返回 null 并清理。

再实现 `loadRemoteUrl()`、`saveRemoteUrl()`、`clearRemoteUrl()`。所有异常均返回可恢复的 null/false，不抛出到 UI。

## Task 5 - 原生壳 UI 与 WebView

1. `SetupScreen`：说明 + 多行输入 + 连接按钮 + 粘贴/清空；显示脱敏预览。
2. `ErrorScreen`：重试、复制安全状态、重新配置。
3. `RemoteShell`：加载安全 URL，启用 JS、DOM storage、Cookie、内联媒体、返回手势。
4. `zcode.z.ai` 保持 WebView 内；其他 HTTPS 链接交给系统浏览器。
5. Android back 事件：`canGoBack` 时回退，否则交给系统。
6. 使用 `useKeepAwake` 保持远控期间屏幕常亮。
7. SafeArea + Status bar 保证刘海屏和键盘不遮挡 Web 内容。

## Task 6 - 深链与本机配置

- `app.config.ts` 不读取任何远控 URL。
- 启动和前台运行时监听 `zcode-mobile://connect?url=...`。
- 新链接校验通过后保存到 SecureStore 并刷新 WebView。
- 不提供 `.env.example` 或 `.env.local`；用户通过扫码/手动输入提供一次性链接。

## Task 7 - 验证

必须依次执行并记录输出：

```bash
npm test -- --runInBand
npx tsc --noEmit
npx expo-doctor
npx expo export --platform web
```

原生验证优先级：

1. `npx expo start --tunnel` 提供 Expo Go 路径。
2. 若模拟器可用：`npx expo run:ios --configuration Release`。
3. 若 Android SDK 可用：`npx expo run:android --variant release`。
4. 若本机没有 iOS simulator runtime，则执行 `npx expo prebuild --platform ios --no-install` 并用 xcodebuild 的 simulator destination 编译校验。

## Self-review

- 覆盖目标：官方功能继承、移动壳、安全存储、错误恢复、外部链接、返回键、屏幕常亮、构建验证均有任务。
- 无占位符：所有任务都有明确实现与验证命令。
- 类型一致性：URL API 名称与测试和实现保持一致。
