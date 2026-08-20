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
import { colors } from '../lib/theme';
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

  const openExternal = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      // Some pages advertise schemes the device cannot open. The remote session stays alive.
    }
  }, []);

  const shouldStartLoad = useCallback(
    (request: Pick<WebViewNavigation, 'url'>) => {
      const target = resolveNavigationTarget(request.url);

      if (target === 'webview') {
        return true;
      }

      if (target === 'system') {
        void openExternal(request.url);
      }

      return false;
    },
    [openExternal],
  );

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
      <WebView
        ref={webViewRef}
        source={{ uri: sourceUri }}
        style={styles.webView}
        originWhitelist={['https://zcode.z.ai', 'about:*', 'data:*', 'blob:*']}
        applicationNameForUserAgent="ZCodeMobile/1.0.0"
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
        onNavigationStateChange={(event) => setCanGoBack(event.canGoBack)}
        onFileDownload={(event) => {
          const url = event.nativeEvent.downloadUrl;
          if (resolveNavigationTarget(url) !== 'blocked') {
            void openExternal(url);
          }
        }}
        onOpenWindow={(event) => {
          const url = event.nativeEvent.targetUrl;
          const target = resolveNavigationTarget(url);

          if (target === 'system') {
            void openExternal(url);
          } else if (url.startsWith('https://zcode.z.ai/')) {
            setSourceUri(url);
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
