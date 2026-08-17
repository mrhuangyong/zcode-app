import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'ZCode Remote',
  slug: 'zcode-remote',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  scheme: 'zcode-mobile',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#080B12',
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier: 'ai.zcode.remote',
    buildNumber: '1',
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
    },
  },
  android: {
    package: 'ai.zcode.remote',
    versionCode: 1,
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
  },
};

export default config;
