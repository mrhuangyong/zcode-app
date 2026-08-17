# ZCode 扫码连接实施计划

## 文件结构

- `src/lib/remote-url.ts`：新增 `resolveScannedRemoteConnection(input)`。
- `src/lib/remote-url.test.ts`：新增扫码结果解析测试。
- `src/components/QRScannerScreen.tsx`：相机权限、预览、QR 识别、错误提示。
- `src/components/QRScannerScreen.test.tsx`：组件行为测试。
- `src/components/SetupScreen.tsx`：新增主扫码入口。
- `src/components/SetupScreen.test.tsx`：入口回调测试。
- `src/components/RemoteShell.tsx`：新增原生顶部扫码入口。
- `src/components/RemoteShell.test.tsx`：入口回调测试。
- `App.tsx`：扫码页 visible 状态与扫码连接状态机。
- `App.test.tsx`：入口打开、扫码连接、关闭扫码页测试。
- `app.config.ts`：安装 `expo-camera` 权限插件配置。
- `package.json` / `package-lock.json`：新增 Expo 匹配版本依赖。

## Task 1：安装 Expo Camera

执行：

```bash
node - <<'NODE'
console.log(require('./node_modules/expo/bundledNativeModules.json')['expo-camera'])
NODE
npm install --ignore-scripts "expo-camera@$(node - <<'NODE'
console.log(require('./node_modules/expo/bundledNativeModules.json')['expo-camera'])
NODE
)"
```

在 `app.config.ts` 的 `plugins` 中加入：

```ts
[
  'expo-camera',
  {
    cameraPermission: 'ZCode 使用相机扫描桌面端生成的连接二维码。',
  },
],
```

## Task 2：RED — 扫码结果解析

在 `src/lib/remote-url.test.ts` 增加：

```ts
it('resolves scanned remote URLs and connect deep links', () => {
  expect(resolveScannedRemoteConnection(remoteUrl)).toBe(remoteUrl);
  expect(
    resolveScannedRemoteConnection(`zcode-mobile://connect?url=${encodeURIComponent(remoteUrl)}`),
  ).toBe(remoteUrl);
  expect(resolveScannedRemoteConnection('https://evil.example/remote/v4')).toBeNull();
});
```

先运行并确认因导出缺失失败。

## Task 3：GREEN — 解析函数

```ts
export function resolveScannedRemoteConnection(input: string): string | null {
  return normalizeRemoteUrl(input) ?? parseConnectDeepLink(input);
}
```

运行该测试文件确认通过。

## Task 4：RED — 扫码组件

新增 `src/components/QRScannerScreen.test.tsx`，mock `expo-camera`：

```ts
jest.mock('expo-camera', () => ({
  CameraView: jest.fn(() => null),
  useCameraPermissions: jest.fn(),
}));
```

覆盖：

```ts
it('shows the camera after permission is granted')
it('connects once for an official QR URL')
it('accepts an encoded app deep-link QR')
it('rejects unsafe QR payloads without connecting')
it('offers permission recovery when camera access is denied')
```

先运行并确认组件缺失失败。

## Task 5：GREEN — 扫码组件

组件接口：

```ts
type QRScannerScreenProps = {
  visible: boolean;
  onClose: () => void;
  onConnect: (url: string) => void | Promise<void>;
};
```

实现要点：

- `visible=false` 时不渲染 `Modal`。
- `useCameraPermissions()` 获取权限。
- `CameraView` 设置 `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}`。
- `onBarcodeScanned` 调用 `resolveScannedRemoteConnection(event.data)`。
- 有效结果只提交一次，并等待 `onConnect` 完成后由 App 关闭。
- 无效结果显示 `scanner-error`，不提交连接。
- 提供 `close-scanner-button` 与 `request-camera-button`。

## Task 6：入口与状态机

先给 Setup / RemoteShell / App 补失败测试：

```ts
expect(screen.getByTestId('open-scanner-button')).toBeTruthy();
fireEvent.press(screen.getByTestId('open-scanner-button'));
expect(onScanRequest).toHaveBeenCalledTimes(1);
```

App 测试覆盖：

- Setup 页入口打开扫码 Modal。
- 扫码回调保存 URL 并进入 RemoteShell。
- RemoteShell 页入口也能打开同一个扫码 Modal。
- 关闭回调隐藏扫码 Modal。

再实现：

- `SetupScreenProps` 增加 `onScanRequest`。
- `RemoteShellProps` 增加 `onScanRequest`。
- `App` 增加 `scannerVisible`、`openScanner`、`closeScanner`、`connectFromScanner`。
- `QRScannerScreen` 挂载在主界面之后，避免影响主状态渲染。

## Task 7：原生与模拟器验证

```bash
npm test -- --runInBand
npm run typecheck
npm run lint
npx expo-doctor
npm run export:web
npm run prebuild:android
cd android && ./gradlew assembleRelease --no-daemon
```

在 Android 模拟器：

```bash
adb shell pm grant ai.zcode.remote android.permission.CAMERA
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell am start -W -n ai.zcode.remote/.MainActivity
adb exec-out screencap -p > /tmp/zcode-scanner-android.png
```

验证远控页顶部扫码入口能进入相机预览页，且返回后远控连接仍保持。

## Self-review

- 覆盖初始入口、已连接入口、权限、有效/无效二维码、保存和重建 WebView。
- 无占位符，所有任务均给出明确接口与验证命令。
- helper 名称 `resolveScannedRemoteConnection` 在测试、实现、组件中保持一致。
