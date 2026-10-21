import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewNavigation } from 'react-native-webview';
import { resolveNavigationTarget } from '../lib/navigation';
import { colors, type } from '../lib/theme';
import AuthBrowserModal from './AuthBrowserModal';
import ErrorScreen from './ErrorScreen';

type RemoteShellProps = {
  remoteUrl: string;
  deviceName: string;
  onExit: () => void;
};

export default function RemoteShell({ remoteUrl, deviceName, onExit }: RemoteShellProps) {
  useKeepAwake();
  const webViewRef = useRef<React.ComponentRef<typeof WebView>>(null);
  const [sourceUri, setSourceUri] = useState(remoteUrl);
  const [canGoBack, setCanGoBack] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [showLoginHint, setShowLoginHint] = useState(false);

  const openExternal = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      // Some pages advertise schemes the device cannot open. The remote session stays alive.
    }
  }, []);

  const openAuthBrowser = useCallback((url: string) => {
    setAuthUrl((current) => current ?? url);
  }, []);

  const closeAuthBrowser = useCallback(() => {
    setAuthUrl(null);
  }, []);

  const shouldStartLoad = useCallback(
    (request: Pick<WebViewNavigation, 'url'>) => {
      const target = resolveNavigationTarget(request.url);

      if (target === 'webview') {
        return true;
      }

      if (target === 'auth') {
        openAuthBrowser(request.url);
        return false;
      }

      if (target === 'system') {
        void openExternal(request.url);
      }

      return false;
    },
    [openAuthBrowser, openExternal],
  );

  const handleOpenWindow = useCallback(
    (event: { nativeEvent: { targetUrl: string } }) => {
      const url = event.nativeEvent.targetUrl;
      const target = resolveNavigationTarget(url);

      if (target === 'auth') {
        openAuthBrowser(url);
      } else if (target === 'system') {
        void openExternal(url);
      } else if (url.startsWith('https://zcode.z.ai/')) {
        setSourceUri(url);
      }
      // 其余（about:blank 等）忽略。
    },
    [openAuthBrowser, openExternal],
  );

  // 登录页会把自己的 OAuth 授权页强行送到系统浏览器（intent 逃逸，WebView 层无法拦截）。
  // 好消息是远控页的登录采用 OAuth 轮询设计：只要在浏览器里用与桌面端相同的账号完成登录，
  // 本应用内的轮询会自动接续会话。这里通过页面标题识别登录页，给出回流提示。
  const handleNavigationStateChange = useCallback((event: WebViewNavigation & { title?: string }) => {
    setCanGoBack(event.canGoBack);
    setShowLoginHint(typeof event.title === 'string' && event.title.includes('Sign In'));
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [canGoBack]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.shellHeader}>
        <Pressable
          testID="back-to-devices"
          accessibilityRole="button"
          accessibilityLabel="返回设备列表"
          onPress={onExit}
          style={({ pressed }) => [styles.exitButton, pressed && styles.pressedButton]}
        >
          <Text style={styles.exitIcon}>‹</Text>
          <Text style={styles.exitText}>设备</Text>
        </Pressable>
        <View style={styles.headerIdentity}>
          <View style={styles.linkDot} accessibilityLabel="远控链路已建立" />
          <Text style={styles.shellHeaderText} numberOfLines={1}>
            {deviceName}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>
      {showLoginHint ? (
        <View testID="login-hint-banner" style={styles.loginHint}>
          <Text style={styles.loginHintText} numberOfLines={2}>
            将在系统浏览器完成登录，请使用与电脑端相同的账号；完成后回到本应用，会话会自动继续。
          </Text>
        </View>
      ) : null}
      <WebView
        ref={webViewRef}
        source={{ uri: sourceUri }}
        style={styles.webView}
        originWhitelist={['https://zcode.z.ai', 'about:*', 'data:*', 'blob:*']}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures
        automaticallyAdjustContentInsets
        pullToRefreshEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.ultramarine} size="large" />
          </View>
        )}
        renderError={(code) => (
          <ErrorScreen
            message={`无法加载 ZCode 远控页面（${code}）。请检查网络后重试。`}
            onRetry={() => webViewRef.current?.reload()}
            onSetup={onExit}
          />
        )}
        onShouldStartLoadWithRequest={shouldStartLoad}
        onOpenWindow={handleOpenWindow}
        onNavigationStateChange={handleNavigationStateChange}
        onFileDownload={(event) => {
          const url = event.nativeEvent.downloadUrl;
          if (resolveNavigationTarget(url) !== 'blocked') {
            void openExternal(url);
          }
        }}
        onContentProcessDidTerminate={() => webViewRef.current?.reload()}
        setSupportMultipleWindows
        mixedContentMode="never"
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        geolocationEnabled={false}
        textZoom={100}
        overScrollMode="never"
      />
      {authUrl ? (
        <AuthBrowserModal
          key={authUrl}
          visible
          initialUrl={authUrl}
          onClose={closeAuthBrowser}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.void, flex: 1 },
  shellHeader: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.hairline,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  headerIdentity: { alignItems: 'center', flexDirection: 'row', flex: 1, gap: 8, justifyContent: 'center' },
  exitButton: {
    alignItems: 'center',
    backgroundColor: colors.panelDeep,
    borderColor: colors.hairline,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  exitIcon: { color: '#9DB8FF', fontSize: 17, lineHeight: 20, marginTop: -1 },
  exitText: { color: '#9DB8FF', fontSize: 13, fontWeight: '700' },
  headerSpacer: { paddingHorizontal: 26 },
  loginHint: {
    backgroundColor: colors.ultramarineSoft,
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loginHintText: { ...type.body, fontSize: 12.5, lineHeight: 18 },
  linkDot: {
    backgroundColor: colors.signal,
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  shellHeaderText: { color: colors.text, flexShrink: 1, fontSize: 15, fontWeight: '700' },
  pressedButton: { opacity: colors.pressed },
  webView: { backgroundColor: colors.void, flex: 1 },
  loading: { alignItems: 'center', backgroundColor: colors.void, flex: 1, justifyContent: 'center' },
});
