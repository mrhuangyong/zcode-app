import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewNavigation } from 'react-native-webview';
import { AUTH_ROOTS, resolveIntentTargetUrl, resolveNavigationTarget } from '../lib/navigation';
import { colors } from '../lib/theme';

type AuthBrowserModalProps = {
  visible: boolean;
  initialUrl: string | null;
  onClose: () => void;
};

// 登录 overlay：承载 ZCode 远控页的 OAuth 授权页（chat.z.ai / bigmodel.cn）。
// 主远控 WebView 不被打断，登录回调（zcode.z.ai）完成后自动关闭，
// 会话由远控页自身的轮询接管。

const AUTO_CLOSE_DELAY_MS = 1500;

// 与 RemoteShell 相同的道理：登录页（尤其国内站点）常用 window.open / target=_blank
// 自行跳转，shim 归拢程序化调用，onOpenWindow 接住锚点，全部在 overlay 内消化。
const windowOpenShim = `
(function() {
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
})();
`;

export default function AuthBrowserModal({ visible, initialUrl, onClose }: AuthBrowserModalProps) {
  const webViewRef = useRef<React.ComponentRef<typeof WebView>>(null);
  // RemoteShell 以 key={authUrl} 挂载本组件：每次新的授权 URL 都是一次全新挂载，
  // 状态天然从 props 初始化，无需在 effect 里同步。
  const [sourceUri, setSourceUri] = useState(initialUrl);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!completed) {
      return;
    }

    const timer = setTimeout(onClose, AUTO_CLOSE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [completed, onClose]);

  const openExternal = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      // 授权页偶尔宣传设备打不开的 scheme；保留 overlay 等待用户操作。
    }
  }, []);

  const shouldStartLoad = useCallback((request: Pick<WebViewNavigation, 'url'>) => {
    // intent:// 一律接管：放行会被 Chromium 解析成外部 intent 直接拉起浏览器。
    if (request.url.startsWith('intent:')) {
      const target = resolveNavigationTarget(request.url);
      const resolved = resolveIntentTargetUrl(request.url);

      if ((target === 'auth' || target === 'webview') && resolved) {
        setSourceUri(resolved);
      } else if (target === 'system' && resolved) {
        void openExternal(resolved);
      }

      return true;
    }

    const target = resolveNavigationTarget(request.url);

    if (target === 'webview' || target === 'auth') {
      return true;
    }

    if (target === 'system') {
      void openExternal(request.url);
    }

    return false;
  }, [openExternal]);

  const handleOpenWindow = useCallback((event: { nativeEvent: { targetUrl: string } }) => {
    const url = event.nativeEvent.targetUrl;
    const target = resolveNavigationTarget(url);

    if (target === 'auth' || target === 'webview') {
      setSourceUri(resolveIntentTargetUrl(url) ?? url);
    } else if (target === 'system') {
      void openExternal(url);
    }
  }, [openExternal]);

  const handleNavigationStateChange = useCallback((event: { url: string }) => {
    try {
      const { hostname } = new URL(event.url);

      if (hostname === 'zcode.z.ai') {
        setCompleted(true);
      }
    } catch {
      // ignore malformed navigation URLs
    }
  }, []);

  if (!initialUrl) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerIdentity}>
            <View style={[styles.statusDot, completed && styles.statusDotDone]} />
            <Text style={styles.headerText}>
              {completed ? '登录完成 ✓ 正在返回…' : '登录 ZCode 账号'}
            </Text>
          </View>
          <Pressable
            testID="auth-close-button"
            accessibilityRole="button"
            accessibilityLabel="关闭登录页"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Text style={styles.closeButtonText}>关闭</Text>
          </Pressable>
        </View>
        <WebView
          key={sourceUri ?? 'auth'}
          ref={webViewRef}
          source={{ uri: sourceUri ?? initialUrl }}
          style={styles.webView}
          originWhitelist={[
            'https://zcode.z.ai',
            ...AUTH_ROOTS.map((root) => `https://*.${root}`),
            ...AUTH_ROOTS.map((root) => `https://${root}`),
          ]}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.ultramarine} size="large" />
            </View>
          )}
          onShouldStartLoadWithRequest={shouldStartLoad}
          onNavigationStateChange={handleNavigationStateChange}
          onOpenWindow={handleOpenWindow}
          injectedJavaScriptBeforeContentLoaded={windowOpenShim}
          injectedJavaScriptBeforeContentLoadedForMainFrameOnly
          onContentProcessDidTerminate={() => setSourceUri(initialUrl)}
          setSupportMultipleWindows
          mixedContentMode="never"
          allowFileAccess={false}
          allowUniversalAccessFromFileURLs={false}
          geolocationEnabled={false}
          textZoom={100}
          overScrollMode="never"
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.void, flex: 1 },
  header: {
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
  headerIdentity: { alignItems: 'center', flexDirection: 'row', flex: 1, gap: 8 },
  statusDot: {
    backgroundColor: colors.ultramarine,
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  statusDotDone: { backgroundColor: colors.signal },
  headerText: { color: colors.text, flexShrink: 1, fontSize: 15, fontWeight: '700' },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.panelDeep,
    borderColor: colors.hairline,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 7,
  },
  closeButtonText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  webView: { backgroundColor: colors.void, flex: 1 },
  loading: { alignItems: 'center', backgroundColor: colors.void, flex: 1, justifyContent: 'center' },
  pressed: { opacity: colors.pressed },
});
