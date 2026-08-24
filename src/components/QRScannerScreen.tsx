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
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { decodeQrFromImage } from '../lib/qr-image';
import { resolveScannedRemoteConnection } from '../lib/remote-url';
import { colors, type } from '../lib/theme';

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
  const [decoding, setDecoding] = useState(false);
  const handledPayloadRef = useRef<string | null>(null);

  const handlePayload = useCallback(
    (data: string) => {
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

  const handleBarcodeScanned = useCallback(
    ({ data }: BarcodeScanningResult) => handlePayload(data),
    [handlePayload],
  );

  const pickFromGallery = useCallback(() => {
    if (connecting || decoding) {
      return;
    }

    setError(null);

    void (async () => {
      try {
        const picked = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: false,
          quality: 1,
        });

        if (picked.canceled || picked.assets.length === 0) {
          return;
        }

        setDecoding(true);
        const decoded = await decodeQrFromImage(picked.assets[0].uri);

        if (decoded === null) {
          setError('未能从所选图片中识别出二维码，请确认图片清晰完整。');
          return;
        }

        handlePayload(decoded);
      } catch {
        setError('读取图片失败，请重试。');
      } finally {
        setDecoding(false);
      }
    })();
  }, [connecting, decoding, handlePayload]);

  if (!visible) {
    return null;
  }

  if (!permission) {
    return (
      <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loading}>
            <ActivityIndicator color={colors.ultramarine} size="large" />
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
            <Text style={styles.permissionEyebrow}>camera ▸ permission required</Text>
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
            <Text style={styles.title}>扫码连接</Text>
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
          <View testID="scan-frame" style={styles.scanFrame} pointerEvents="none">
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
          {connecting || decoding ? (
            <View style={styles.connectingOverlay}>
              <ActivityIndicator color={colors.ultramarine} size="large" />
              <Text style={styles.connectingText}>
                {connecting ? '正在建立连接…' : '正在识别二维码…'}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.alignArea}>
          <Text style={styles.alignCaption}>将二维码对准取景框</Text>
          <Pressable
            testID="pick-from-gallery-button"
            accessibilityRole="button"
            accessibilityLabel="从相册选择二维码图片"
            onPress={pickFromGallery}
            disabled={decoding}
            style={({ pressed }) => [styles.galleryButton, pressed && styles.pressed]}
          >
            {decoding ? (
              <ActivityIndicator color="#9DB8FF" size="small" />
            ) : (
              <Text style={styles.galleryButtonText}>从相册选择二维码</Text>
            )}
          </Pressable>
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
  safeArea: { backgroundColor: colors.void, flex: 1 },
  loading: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  permissionContainer: { alignItems: 'center', flex: 1, gap: 14, justifyContent: 'center', padding: 28 },
  permissionEyebrow: { ...type.monoEyebrow, color: colors.danger },
  title: { ...type.title, color: colors.text },
  message: { ...type.body, textAlign: 'center' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    padding: 16,
  },
  headerCaption: { color: colors.faint, fontSize: 13, marginTop: 3 },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.hairline,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  closeButtonText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  cameraContainer: {
    backgroundColor: '#000000',
    borderRadius: 20,
    height: '52%',
    margin: 18,
    marginBottom: 0,
    overflow: 'hidden',
  },
  camera: { flex: 1 },
  connectingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(5,7,13,0.82)',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  connectingText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  alignArea: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  alignCaption: { color: colors.dim, fontSize: 14 },
  scanFrame: {
    height: 240,
    left: '50%',
    marginLeft: -120,
    marginTop: -120,
    position: 'absolute',
    top: '50%',
    width: 240,
  },
  corner: {
    borderColor: 'rgba(255,255,255,0.92)',
    height: 34,
    position: 'absolute',
    width: 34,
  },
  cornerTopLeft: { borderLeftWidth: 3, borderStyle: 'solid', borderTopWidth: 3, borderTopLeftRadius: 8, left: 0, top: 0 },
  cornerTopRight: { borderRightWidth: 3, borderStyle: 'solid', borderTopWidth: 3, borderTopRightRadius: 8, right: 0, top: 0 },
  cornerBottomLeft: { borderBottomWidth: 3, borderLeftWidth: 3, borderStyle: 'solid', borderBottomLeftRadius: 8, bottom: 0, left: 0 },
  cornerBottomRight: { borderBottomWidth: 3, borderRightWidth: 3, borderStyle: 'solid', borderBottomRightRadius: 8, bottom: 0, right: 0 },
  galleryButton: {
    alignItems: 'center',
    backgroundColor: colors.ultramarineSoft,
    borderColor: 'rgba(61,110,255,0.45)',
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  galleryButtonText: { color: '#9DB8FF', fontSize: 14, fontWeight: '700' },
  footer: { minHeight: 72, paddingHorizontal: 20, paddingVertical: 14 },
  footerText: { color: colors.faint, fontSize: 13, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.ultramarine,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  primaryButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingHorizontal: 26,
    paddingVertical: 12,
  },
  secondaryButtonText: { color: colors.dim, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: colors.pressed },
});
