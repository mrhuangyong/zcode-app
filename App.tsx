import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RemoteShell from './src/components/RemoteShell';
import QRScannerScreen from './src/components/QRScannerScreen';
import DeviceListScreen from './src/components/DeviceListScreen';
import { parseConnectDeepLink } from './src/lib/remote-url';
import {
  deleteDevice,
  loadDevices,
  renameDevice,
  upsertDevice,
  type RemoteDevice,
} from './src/lib/secure-remote-store';
import { colors, monoFont } from './src/lib/theme';
import { checkForUpdate, type UpdateCheckResult } from './src/lib/updater';

const initialSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [devices, setDevices] = useState<RemoteDevice[]>([]);
  const [activeDevice, setActiveDevice] = useState<RemoteDevice | null>(null);
  const [webViewSession, setWebViewSession] = useState(0);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);

  useEffect(() => {
    let active = true;

    void checkForUpdate().then((result) => {
      // 静默检查：网络失败或无更新都不打扰用户。
      if (active && result?.available) {
        setUpdateInfo(result);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const connect = useCallback(async (url: string) => {
    const device = await upsertDevice(url);

    if (device) {
      setDevices(await loadDevices());
      setActiveDevice(device);
      setWebViewSession((session) => session + 1);
    }
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

  const handleRenameDevice = useCallback(async (id: string, name: string) => {
    setDevices(await renameDevice(id, name));
  }, []);

  const handleDeleteDevice = useCallback(
    async (id: string) => {
      const next = await deleteDevice(id);
      setDevices(next);
      setActiveDevice((current) => (current?.id === id ? null : current));
    },
    [],
  );

  const exitToDevices = useCallback(() => {
    setActiveDevice(null);
  }, []);

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
      const [storedDevices, initialLink] = await Promise.all([
        loadDevices(),
        Linking.getInitialURL().catch(() => null),
      ]);

      if (!active) {
        return;
      }

      setDevices(storedDevices);
      setReady(true);

      const linked = initialLink ? parseConnectDeepLink(initialLink) : null;

      if (linked) {
        void connect(linked);
      }
    };

    void bootstrap();

    const subscription = Linking.addEventListener('url', handleUrlEvent);

    return () => {
      active = false;
      subscription.remove();
    };
  }, [connect, handleUrlEvent]);

  return (
    <SafeAreaProvider initialMetrics={initialSafeAreaMetrics}>
      <StatusBar style="light" />
      {ready ? (
        activeDevice ? (
          <RemoteShell
            key={webViewSession}
            remoteUrl={activeDevice.url}
            deviceName={activeDevice.name}
            onExit={exitToDevices}
          />
        ) : (
          <DeviceListScreen
            devices={devices}
            activeDeviceId={null}
            update={updateInfo}
            onUpdateDismissed={() => setUpdateInfo(null)}
            onConnect={connect}
            onRenameDevice={handleRenameDevice}
            onDeleteDevice={handleDeleteDevice}
            onScanRequest={openScanner}
          />
        )
      ) : (
        <View style={styles.boot}>
          <ActivityIndicator color={colors.ultramarine} size="large" />
          <Text style={styles.bootText}>zcode ▸ linking</Text>
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
  boot: { alignItems: 'center', backgroundColor: colors.void, flex: 1, gap: 14, justifyContent: 'center' },
  bootText: { color: colors.faint, fontFamily: monoFont, fontSize: 12, letterSpacing: 0.8 },
});
