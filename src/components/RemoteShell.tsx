import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewNavigation } from 'react-native-webview';
import { resolveNavigationTarget } from '../lib/navigation';
import ErrorScreen from './ErrorScreen';

type RemoteShellProps = {
  remoteUrl: string;
  onSetup?: () => void;
};

export default function RemoteShell({ remoteUrl, onSetup }: RemoteShellProps) {
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
            <ActivityIndicator color="#8ab4ff" size="large" />
          </View>
        )}
        renderError={(code, description) => (
          <ErrorScreen
            message={`无法加载 ZCode 远控页面（${code}）。请检查网络后重试。${description ? '' : ''}`}
            onRetry={() => webViewRef.current?.reload()}
            onSetup={onSetup}
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
  container: { backgroundColor: '#080b12', flex: 1 },
  webView: { backgroundColor: '#080b12', flex: 1 },
  loading: { alignItems: 'center', backgroundColor: '#080b12', flex: 1, justifyContent: 'center' },
});
