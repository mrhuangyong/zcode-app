# ZCode Remote

一个 iOS / Android 原生壳，用于完整承载 ZCode 官方 Web Remote Control。官方 Web 前端负责桌面配对、工作区同步、聊天、编辑器、终端与远控业务；原生层负责安全存储、深链、返回手势、外部链接、错误恢复、屏幕常亮与键盘/安全区适配。

## 运行

```bash
npm install
npx expo start
```

用 Expo Go 扫描终端二维码即可运行。首次启动会按以下优先级获取链接：

1. iOS / Android 安全存储中的链接；
2. `.env.local` 中的 `EXPO_PUBLIC_ZCODE_REMOTE_URL`；
3. 若都没有，显示本机链接设置页。

`.env.local` 被 Git 忽略。可以复制 `.env.example` 后填入桌面端生成的远控 URL。链接包含会话凭据，请勿提交、截图或转发。

## 深链

独立构建支持：

```text
zcode-mobile://connect?url=<URL-encoded ZCode remote URL>
```

生成示例：

```bash
python3 -c 'import urllib.parse; print("zcode-mobile://connect?url=" + urllib.parse.quote("PASTE_REMOTE_URL", safe=""))'
```

## 构建

```bash
# Web 打包校验
npm run export:web

# iOS 原生构建
npm run ios:release

# Android 原生构建
npm run android:release
```

如需生成本地原生工程：

```bash
npm run prebuild:ios
npm run prebuild:android
```

## 本机构建产物

当前本机已生成并验证：

- Android APK：`android/app/build/outputs/apk/release/app-release.apk`
- iOS Simulator App：`ios/build/Build/Products/Release-iphonesimulator/ZCodeRemote.app`
- Web 静态包：`dist/`

这些目录按 Expo 约定被 Git 忽略；源码提交中包含完整的可复现构建配置。

## 安全与功能边界

- 只允许加载 `https://zcode.z.ai/remote/v4`。
- 远控链接使用系统安全存储，界面只显示脱敏预览。
- 官方域内导航留在 WebView；文档、支付等外部链接交给系统浏览器。
- JavaScript、Cookie、DOM Storage、文件选择器、摄像头/麦克风权限与内联媒体保持开启。
- Android 后退键优先回退 WebView 历史，不能回退时才退出。
- 远控界面保持屏幕常亮。
- 桌面端离线或远控链接过期时，APP 不崩溃，由官方 Web 端或原生错误页显示恢复操作。

## 开发验证

```bash
npm test -- --runInBand
npm run typecheck
npx expo-doctor
npm run export:web
```
