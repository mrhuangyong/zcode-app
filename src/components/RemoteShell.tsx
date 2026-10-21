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
import { resolveIntentTargetUrl, resolveNavigationTarget } from '../lib/navigation';
import { colors, type } from '../lib/theme';
import AuthBrowserModal from './AuthBrowserModal';
import ErrorScreen from './ErrorScreen';

const WEBVIEW_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

// 登录页（zcode/chat.z.ai/bigmodel）会做 WebView 检测并强制跳系统浏览器，
// 导致 OAuth 回调上下文错乱（"OAuth CSRF 检测失败"）。补齐普通浏览器的特征：
// window.chrome 对象 + 覆写 window.open 为当前窗口导航，让授权流程留在应用内完成。
const BROWSER_SHIM = `
(function() {
  if (!window.chrome) {
    window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
  }
  window.open = function(url) {
    if (typeof url === 'string' && url.length > 0) {
      window.location.href = url;
    }
    var stub = { closed: false, opener: null, focus: function() {}, close: function() {} };
    Object.defineProperty(stub, 'location', {
      set: function(value) { window.location.href = value; },
      get: function() { return window.location; },
    });
    return stub;
  };
  var CLIENT_ID = 'client_P8X5CMWmlaRO9gyO-KSqtg';
  var reported = {};
  setInterval(function() {
    try {
      var raw = localStorage.getItem('oauth_pending_logins');
      if (!raw) return;
      var list = JSON.parse(raw);
      if (!Array.isArray(list) || !list.length) return;
      var pending = list[list.length - 1];
      if (!pending || !pending.nonce || reported[pending.nonce]) return;
      reported[pending.nonce] = true;
      var stateJson = JSON.stringify({ nonce: pending.nonce, app_return_to: pending.redirectUri || window.location.href });
      var state = btoa(unescape(encodeURIComponent(stateJson)));
      var provider = pending.provider === 'bigmodel'
        ? 'https://bigmodel.cn/login'
        : 'https://chat.z.ai/api/oauth/authorize';
      var query = pending.provider === 'bigmodel'
        ? new URLSearchParams({
            redirect: pending.redirectUri || window.location.href,
            appId: 'zcode',
            state: state,
          })
        : new URLSearchParams({
            redirect_uri: pending.redirectUri || window.location.href,
            response_type: 'code',
            client_id: CLIENT_ID,
            state: state,
          });
      var authorizeUrl = provider + '?' + query.toString();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage('AUTHORIZE::' + authorizeUrl);
      }
    } catch (e) {}
  }, 400);
})();
`;

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
  // 供 onMessage 回调读取最新值（避免闭包过期）。
  const showLoginHintRef = useRef(false);

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
    // 登录在 overlay 完成后重新加载主页面以接管新会话。
    webViewRef.current?.reload();
  }, []);

  const shouldStartLoad = useCallback(
    (request: Pick<WebViewNavigation, 'url'>) => {
      const target = resolveNavigationTarget(request.url);

      // intent:// 链接必须始终由我们接管（返回 true 阻断）：放行给 Chromium 的默认
      // 处理会解析 package=com.android.chrome 直接拉起系统浏览器。
      if (request.url.startsWith('intent:')) {
        const resolved = resolveIntentTargetUrl(request.url);

        if (target === 'auth' && resolved) {
          openAuthBrowser(resolved);
        } else if (target === 'system' && resolved) {
          void openExternal(resolved);
        }

        return true;
      }

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
        openAuthBrowser(resolveIntentTargetUrl(url) ?? url);
      } else if (target === 'system') {
        void openExternal(url);
      } else if (url.startsWith('https://zcode.z.ai/')) {
        setSourceUri(url);
      }
      // 其余（about:blank 等）忽略。
    },
    [openAuthBrowser, openExternal],
  );

  // 登录页会把 OAuth 授权链接包成 intent:// 强行送系统浏览器（navigation.ts 会解析拦截）。
  // 若用户仍去了浏览器：远控页是 OAuth 轮询设计，浏览器完成登录后回到本应用，
  // 轮询会自动接续会话。通过页面标题识别登录页，给出回流提示。
  const handleNavigationStateChange = useCallback((event: WebViewNavigation & { title?: string }) => {
    setCanGoBack(event.canGoBack);
    const onSignIn = typeof event.title === 'string' && event.title.includes('Sign In');
    showLoginHintRef.current = onSignIn;
    setShowLoginHint(onSignIn);
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
            登录会跳转系统浏览器：请用与电脑端相同的账号完成登录后返回本应用，再点一次登录即可自动接续（第二次无需重复输密码）。
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
        userAgent={WEBVIEW_UA}
        injectedJavaScriptBeforeContentLoaded={BROWSER_SHIM}
        onMessage={(event) => {
          const data = event.nativeEvent.data;
          // 仅在登录页接管：避免旧的待登录请求在正常远控时反复弹窗。
          if (data.startsWith('AUTHORIZE::') && showLoginHintRef.current) {
            openAuthBrowser(data.slice('AUTHORIZE::'.length));
          }
        }}
        onOpenWindow={handleOpenWindow}
        onNavigationStateChange={handleNavigationStateChange}
        onFileDownload={(event) => {
          const url = event.nativeEvent.downloadUrl;
          if (resolveNavigationTarget(url) !== 'blocked') {
            void openExternal(url);
          }
        }}
        onContentProcessDidTerminate={() => webViewRef.current?.reload()}
        // 多窗口必须关闭：登录页的 window.open('_blank') 在多窗口模式下会脱离主
        // WebView（Chromium 直接转系统 intent），OAuth 回调上下文断裂。关闭后配合
        // BROWSER_SHIM，所有 window.open 都变成当前窗口导航，登录全程留在应用内。
        setSupportMultipleWindows={false}
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
