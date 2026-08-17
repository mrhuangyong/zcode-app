# ZCode 扫码连接设计

## 已确认需求

- ZCode 桌面端二维码内容是官方 `https://zcode.z.ai/remote/v4?...` URL。
- 移动 App 初始连接页提供「扫码连接 ZCode」主入口。
- 已连接远控页保留一个原生扫码入口，用于切换桌面端或重新连接。
- 扫码结果必须经过既有 URL 安全策略校验；有效 URL 保存到 SecureStore 并重建 WebView。
- 支持直接二维码 URL 与 `zcode-mobile://connect?url=...` 深链二维码。
- 相机仅在扫码页可见时启用；关闭页面即停止预览。

## 用户流程

1. 用户点击扫码入口。
2. App 请求相机权限；被拒绝时提供说明和重新授权按钮。
3. 相机预览只识别 QR 码。
4. 有效结果调用既有 `connect(url)` 流程。
5. 连接保存后关闭扫码页，WebView 以新的 session key 重建。
6. 无效二维码显示错误，不保存、不切换连接。

## 安全策略

- 扫码结果先经过 `resolveScannedRemoteConnection`。
- 该函数仅接受官方 remote URL 或 App 深链，并复用 `normalizeRemoteUrl` / `parseConnectDeepLink`。
- 错误内容不记录扫码 payload，避免把会话凭据写入日志。
- 二维码连接仍只显示脱敏预览。

## 验收标准

1. URL 解析测试覆盖直接 URL、深链、无效值。
2. 扫码组件测试覆盖权限拒绝、权限通过、有效扫码、无效扫码、关闭入口。
3. 初始页与远控页入口测试通过。
4. App 状态机测试证明扫码连接会保存 URL、关闭扫码页并进入远控壳。
5. Android Release 构建并在模拟器安装，验证扫码入口可打开相机预览。
6. 现有测试、类型检查、lint、Expo Doctor、Web export 全部保持通过。
