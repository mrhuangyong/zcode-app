import type { ExpoConfig } from 'expo/config';
import { withAndroidManifest, type ConfigPlugin } from 'expo/config-plugins';
import versionInfo from './version.json';

// Android 9+ 默认禁止明文 http（WebView 报 net::ERR_CLEARTEXT_NOT_PERMITTED）。
// SDK 57 的 app config 不再暴露 android.usesCleartextTraffic 字段，
// 用 config plugin 直接写 manifest 的 application 属性，
// 放行后才能连接局域网自建/NAS 等无证书 http 主链接。
const withCleartextTraffic: ConfigPlugin = (config) =>
  withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];

    if (application) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }

    return mod;
  });

const config: ExpoConfig = {
  name: 'ZCode Remote',
  slug: 'zcode-remote',
  version: versionInfo.version,
  orientation: 'default',
  icon: './assets/icon.png',
  scheme: 'zcode-mobile',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#080B12',
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier: 'ai.zcode.remote',
    buildNumber: String(versionInfo.iosBuildNumber),
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: 'ZCode 页面可能需要摄像头来上传图片或进行视频输入。',
      NSMicrophoneUsageDescription: 'ZCode 页面可能需要麦克风来进行语音输入或通话。',
      NSPhotoLibraryUsageDescription: 'ZCode 页面需要访问相册以选择并上传文件。',
      NSPhotoLibraryAddUsageDescription: 'ZCode 页面可能需要保存下载的图片或文件。',
      UILaunchScreen: {
        backgroundColor: '#080B12',
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
      },
      UIRequiresFullScreen: false,
      // 任意 http(s) 主链接为核心特性：放行 ATS 明文传输，否则 WKWebView 加载
      // 自建/局域网 http:// 地址会被系统直接拦截。
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
    },
  },
  android: {
    package: 'ai.zcode.remote',
    versionCode: versionInfo.androidVersionCode,
    allowBackup: false,
    permissions: ['CAMERA', 'RECORD_AUDIO', 'VIBRATE'],
    softwareKeyboardLayoutMode: 'resize',
    adaptiveIcon: {
      backgroundColor: '#080B12',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: false,
        data: [{ scheme: 'zcode-mobile', host: 'connect' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  plugins: [
    // ExpoConfig 类型只描述序列化后的 plugin 形态；函数式 config plugin
    // 运行时由 @expo/config 支持，prebuild 会正常执行。
    withCleartextTraffic as unknown as string,
    [
      'expo-camera',
      {
        cameraPermission: 'ZCode 使用相机扫描桌面端生成的连接二维码。',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 240,
        resizeMode: 'contain',
        backgroundColor: '#080B12',
      },
    ],
  ],
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/favicon.png',
  },
  extra: {
    project: 'zcode-mobile-remote',
    githubRepo: 'mrhuangyong/zcode-app',
  },
};

export default config;
