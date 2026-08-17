import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resolveScannedRemoteConnection } from '../lib/remote-url';

type QRScannerScreenProps = {
  visible: boolean;
  onClose: () => void;
  onConnect: (url: string) => void | Promise<void>;
};

export default function QRScannerScreen({
  visible,
  onClose,
  onConnect,
}: QRScannerScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const handledPayloadRef = useRef<string | null>(null);

  const handleBarcodeScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (handledPayloadRef.current === data || connecting) {
        return;
      }

      const target = resolveScannedRemoteConnection(data);

      if (!target) {
        handledPayloadRef.current = data;
        setError('二维码无效：请扫描 ZCode 桌面端当前生成的连接二维码。');
        return;
      }

      handledPayloadRef.current = data;
      setError(null);
      setConnecting(true);

      void (async () => {
        try {
          await onConnect(target);
        } finally {
          setConnecting(false);
        }
      })();
    },
    [connecting, onConnect],
  );

  if (!visible) {
    return null;
  }

  if (!permission) {
    return (
      <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loading}>
            <ActivityIndicator color="#8ab4ff" size="large" />
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <SafeAreaView style={styles.safeArea}>
          <View testID="camera-permission-denied" style={styles.permissionContainer}>
            <Text style={styles.title}>需要相机权限</Text>
            <Text style={styles.message}>
              ZCode Remote 使用相机扫描桌面端生成的连接二维码。你可以在系统设置中重新开启权限。
            </Text>
            {permission.canAskAgain ? (
              <Pressable
                testID="request-camera-button"
                accessibilityRole="button"
                accessibilityLabel="重新请求相机权限"
                onPress={() => void requestPermission()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>重新授权</Text>
              </Pressable>
            ) : null}
            <Pressable
              testID="close-scanner-button"
              accessibilityRole="button"
              accessibilityLabel="关闭扫码页"
              onPress={onClose}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>返回</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>扫码连接 ZCode</Text>
            <Text style={styles.headerCaption}>对准桌面端连接二维码</Text>
          </View>
          <Pressable
            testID="close-scanner-button"
            accessibilityRole="button"
            accessibilityLabel="关闭扫码页"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Text style={styles.closeButtonText}>关闭</Text>
          </Pressable>
        </View>

        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
          <View style={styles.scanFrame} pointerEvents="none" />
          {connecting ? (
            <View style={styles.connectingOverlay}>
              <ActivityIndicator color="#ffffff" size="large" />
              <Text style={styles.connectingText}>正在建立连接…</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          {error ? (
            <Text testID="scanner-error" style={styles.error}>
              {error}
            </Text>
          ) : (
            <Text style={styles.footerText}>仅识别 ZCode 官方远控二维码，链接会保存在本机安全存储。</Text>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#080B12', flex: 1 },
  loading: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  permissionContainer: { alignItems: 'center', flex: 1, gap: 14, justifyContent: 'center', padding: 28 },
  title: { color: '#ffffff', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  message: { color: '#a5adc8', fontSize: 15, lineHeight: 23, textAlign: 'center' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    padding: 16,
  },
  headerCaption: { color: '#98a2b8', fontSize: 13, marginTop: 3 },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 13,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  closeButtonText: { color: '#e7eaf3', fontSize: 14, fontWeight: '600' },
  cameraContainer: { backgroundColor: '#000000', borderRadius: 22, flex: 1, margin: 18, overflow: 'hidden' },
  camera: { flex: 1 },
  scanFrame: {
    alignSelf: 'center',
    borderColor: '#8ab4ff',
    borderRadius: 26,
    borderWidth: 3,
    height: 240,
    marginBottom: 'auto',
    marginTop: 'auto',
    width: 240,
  },
  connectingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(5,7,13,0.76)',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  connectingText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  footer: { minHeight: 72, paddingHorizontal: 20, paddingVertical: 14 },
  footerText: { color: '#7d8aa5', fontSize: 13, lineHeight: 20 },
  error: { color: '#ff9188', fontSize: 13, lineHeight: 20 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#155ee3',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingHorizontal: 26,
    paddingVertical: 12,
  },
  secondaryButtonText: { color: '#cfd5e4', fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.76 },
});
