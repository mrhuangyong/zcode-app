import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RemoteShell from './src/components/RemoteShell';
import QRScannerScreen from './src/components/QRScannerScreen';
import SetupScreen from './src/components/SetupScreen';
import { parseConnectDeepLink, resolveInitialUrl } from './src/lib/remote-url';
import { clearRemoteUrl, loadRemoteUrl, saveRemoteUrl } from './src/lib/secure-remote-store';

const initialSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [webViewSession, setWebViewSession] = useState(0);
  const [scannerVisible, setScannerVisible] = useState(false);

  const connect = useCallback(async (url: string) => {
    setRemoteUrl(url);
    setWebViewSession((session) => session + 1);
    await saveRemoteUrl(url);
  }, []);

  const openScanner = useCallback(() => {
    setScannerVisible(true);
  }, []);

  const closeScanner = useCallback(() => {
    setScannerVisible(false);
  }, []);

  const connectFromScanner = useCallback(
    async (url: string) => {
      await connect(url);
      setScannerVisible(false);
    },
    [connect],
  );

  const handleUrlEvent = useCallback(
    (event: { url: string }) => {
      const target = parseConnectDeepLink(event.url);

      if (target) {
        void connect(target);
      }
    },
    [connect],
  );

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const [stored, initialLink] = await Promise.all([
        loadRemoteUrl(),
        Linking.getInitialURL().catch(() => null),
      ]);
      const linked = initialLink ? parseConnectDeepLink(initialLink) : null;

      if (linked) {
        void saveRemoteUrl(linked);
      }

      const initial = resolveInitialUrl({ stored: linked ?? stored });

      if (!active) {
        return;
      }

      setRemoteUrl(initial);
      setReady(true);
    };

    void bootstrap();

    const subscription = Linking.addEventListener('url', handleUrlEvent);

    return () => {
      active = false;
      subscription.remove();
    };
  }, [handleUrlEvent]);

  const setup = useCallback(async () => {
    await clearRemoteUrl();
    setRemoteUrl(null);
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialSafeAreaMetrics}>
      <StatusBar style="light" />
      {ready ? (
        remoteUrl ? (
          <RemoteShell
            key={webViewSession}
            remoteUrl={remoteUrl}
            onScanRequest={openScanner}
            onSetup={setup}
          />
        ) : (
          <SetupScreen onConnect={connect} onScanRequest={openScanner} />
        )
      ) : (
        <View style={styles.boot}>
          <ActivityIndicator color="#8ab4ff" size="large" />
        </View>
      )}
      <QRScannerScreen
        visible={scannerVisible}
        onClose={closeScanner}
        onConnect={connectFromScanner}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { alignItems: 'center', backgroundColor: '#080b12', flex: 1, justifyContent: 'center' },
});
