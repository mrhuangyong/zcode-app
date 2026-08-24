import React, { useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { normalizeRemoteUrl, redactRemoteUrl } from '../lib/remote-url';
import type { RemoteDevice } from '../lib/secure-remote-store';
import { colors, monoFont, type } from '../lib/theme';
import type { UpdateCheckResult } from '../lib/updater';

type DeviceListScreenProps = {
  devices: RemoteDevice[];
  activeDeviceId: string | null;
  update: UpdateCheckResult | null;
  onUpdateDismissed: () => void;
  onConnect: (url: string) => void | Promise<void>;
  onRenameDevice: (id: string, name: string) => void | Promise<void>;
  onDeleteDevice: (id: string) => void | Promise<void>;
  onScanRequest: () => void;
};

function formatLastConnected(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => value.toString().padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export default function DeviceListScreen({
  devices,
  activeDeviceId,
  update,
  onUpdateDismissed,
  onConnect,
  onRenameDevice,
  onDeleteDevice,
  onScanRequest,
}: DeviceListScreenProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [menuDeviceId, setMenuDeviceId] = useState<string | null>(null);
  const [renameDevice, setRenameDevice] = useState<RemoteDevice | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteDevice, setDeleteDevice] = useState<RemoteDevice | null>(null);
  const normalized = normalizeRemoteUrl(value);
  const preview = normalized ? redactRemoteUrl(normalized) : null;
  const menuDevice = devices.find((device) => device.id === menuDeviceId) ?? null;

  const connect = () => {
    if (!normalized) {
      setError('链接无效：请粘贴 ZCode 桌面端生成的 https://zcode.z.ai/remote/v4 远控地址。');
      return;
    }

    setError(null);
    setValue('');
    void onConnect(normalized);
  };

  const submitRename = () => {
    if (!renameDevice) {
      return;
    }

    const name = renameValue.trim();

    if (name.length === 0) {
      return;
    }

    setRenameDevice(null);
    void onRenameDevice(renameDevice.id, name);
  };

  const submitDelete = () => {
    if (!deleteDevice) {
      return;
    }

    const target = deleteDevice;
    setDeleteDevice(null);
    setMenuDeviceId(null);
    void onDeleteDevice(target.id);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>zcode ▸ paired hosts</Text>
        <Text style={styles.title}>我的设备</Text>
        <Text style={styles.subtitle}>
          扫码或粘贴远控链接添加桌面端设备，点击设备即可继续远控会话。
        </Text>

        {update?.available ? (
          <View testID="update-banner" style={styles.updateCard}>
            <Text style={styles.updateEyebrow}>update ▸ available</Text>
            <View style={styles.updateRow}>
              <View style={styles.updateMain}>
                <Text style={styles.updateText}>
                  发现新版本 v{update.release.version}（当前 v{update.currentVersion}）
                </Text>
              </View>
              <Pressable
                testID="update-download-button"
                accessibilityRole="button"
                accessibilityLabel={`下载新版本 v${update.release.version}`}
                onPress={() => void Linking.openURL(update.release.apkUrl)}
                style={({ pressed }) => [styles.updateButton, pressed && styles.pressed]}
              >
                <Text style={styles.updateButtonText}>下载</Text>
              </Pressable>
              <Pressable
                testID="update-dismiss-button"
                accessibilityRole="button"
                accessibilityLabel="忽略本次更新提示"
                onPress={onUpdateDismissed}
                style={({ pressed }) => [styles.updateDismiss, pressed && styles.pressed]}
                hitSlop={8}
              >
                <Text style={styles.updateDismissText}>✕</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {devices.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyReadout}>no paired hosts</Text>
            <Text style={styles.emptyText}>
              还没有设备。用下方「添加设备」扫描桌面端 ZCode 生成的连接二维码。
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {devices.map((device) => (
              <View key={device.id} style={styles.deviceCard} testID={`device-item-${device.id}`}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`连接设备 ${device.name}`}
                  onPress={() => void onConnect(device.url)}
                  style={({ pressed }) => [styles.deviceMain, pressed && styles.pressed]}
                >
                  <View style={styles.deviceNameRow}>
                    <Text style={styles.deviceName} numberOfLines={1}>
                      {device.name}
                    </Text>
                    {device.id === activeDeviceId ? (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>当前</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.deviceUrl} numberOfLines={1}>
                    {redactRemoteUrl(device.url)}
                  </Text>
                  <Text style={styles.deviceMeta}>
                    last link ▸ {formatLastConnected(device.lastConnectedAt)}
                  </Text>
                </Pressable>
                <Pressable
                  testID={`device-menu-${device.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`管理设备 ${device.name}`}
                  onPress={() => setMenuDeviceId(device.id)}
                  style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
                  hitSlop={8}
                >
                  <Text style={styles.menuIcon}>⋯</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View testID="add-device-card" style={styles.card}>
          <Text style={styles.cardEyebrow}>add host</Text>
          <Pressable
            testID="open-scanner-button"
            accessibilityRole="button"
            accessibilityLabel="扫码连接桌面端 ZCode"
            onPress={onScanRequest}
            style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}
          >
            <Text style={styles.scanButtonText}>扫码添加</Text>
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orRule} />
            <Text style={styles.orLabel}>或粘贴远控链接</Text>
            <View style={styles.orRule} />
          </View>

          <TextInput
            testID="remote-url-input"
            value={value}
            onChangeText={(next) => {
              setValue(next);
              setError(null);
            }}
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="https://zcode.z.ai/remote/v4?..."
            placeholderTextColor={colors.faint}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
          />
          {error ? (
            <Text testID="setup-error" style={styles.error}>
              {error}
            </Text>
          ) : null}
          {preview ? (
            <View style={styles.previewBlock}>
              <Text style={styles.previewLabel}>安全预览</Text>
              <Text style={styles.previewValue} numberOfLines={2}>
                {preview}
              </Text>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable
              testID="connect-button"
              accessibilityRole="button"
              accessibilityLabel="连接桌面端"
              onPress={connect}
              style={({ pressed }) => [styles.connectButton, pressed && styles.pressed]}
            >
              <Text style={styles.connectButtonText}>添加并连接</Text>
            </Pressable>
            {value.length > 0 ? (
              <Pressable
                testID="clear-button"
                accessibilityRole="button"
                accessibilityLabel="清空链接"
                onPress={() => {
                  setValue('');
                  setError(null);
                }}
                style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
              >
                <Text style={styles.clearButtonText}>清空</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.security}>
            凭据只保存在本机安全存储，不会同步到第三方服务，也不会显示完整链接。
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={menuDevice !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuDeviceId(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setMenuDeviceId(null)}>
          <View style={styles.menuSheet}>
            {menuDevice ? (
              <>
                <Text style={styles.menuTitle} numberOfLines={1}>
                  {menuDevice.name}
                </Text>
                <Pressable
                  testID="menu-rename"
                  accessibilityRole="button"
                  accessibilityLabel="重命名设备"
                  onPress={() => {
                    setRenameDevice(menuDevice);
                    setRenameValue(menuDevice.name);
                    setMenuDeviceId(null);
                  }}
                  style={({ pressed }) => [styles.menuAction, pressed && styles.pressed]}
                >
                  <Text style={styles.menuActionText}>重命名</Text>
                </Pressable>
                <Pressable
                  testID="menu-delete"
                  accessibilityRole="button"
                  accessibilityLabel="删除设备"
                  onPress={() => {
                    setDeleteDevice(menuDevice);
                    setMenuDeviceId(null);
                  }}
                  style={({ pressed }) => [styles.menuActionDanger, pressed && styles.pressed]}
                >
                  <Text style={styles.menuActionDangerText}>删除设备</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={renameDevice !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameDevice(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>重命名设备</Text>
            <TextInput
              testID="rename-input"
              value={renameValue}
              onChangeText={setRenameValue}
              style={styles.renameInput}
              placeholder="设备名称"
              placeholderTextColor={colors.faint}
              autoFocus
              maxLength={40}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={submitRename}
            />
            <View style={styles.dialogActions}>
              <Pressable
                testID="rename-cancel"
                accessibilityRole="button"
                accessibilityLabel="取消重命名"
                onPress={() => setRenameDevice(null)}
                style={({ pressed }) => [styles.dialogButton, pressed && styles.pressed]}
              >
                <Text style={styles.dialogCancelText}>取消</Text>
              </Pressable>
              <Pressable
                testID="rename-confirm"
                accessibilityRole="button"
                accessibilityLabel="确认重命名"
                onPress={submitRename}
                disabled={renameValue.trim().length === 0}
                style={({ pressed }) => [
                  styles.dialogButtonPrimary,
                  renameValue.trim().length === 0 && styles.dialogButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.dialogConfirmText}>保存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteDevice !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteDevice(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>删除设备</Text>
            <Text style={styles.dialogBody}>
              确定删除「{deleteDevice?.name}」吗？删除后需要重新扫码或粘贴链接才能连接。
            </Text>
            <View style={styles.dialogActions}>
              <Pressable
                testID="delete-cancel"
                accessibilityRole="button"
                accessibilityLabel="取消删除"
                onPress={() => setDeleteDevice(null)}
                style={({ pressed }) => [styles.dialogButton, pressed && styles.pressed]}
              >
                <Text style={styles.dialogCancelText}>取消</Text>
              </Pressable>
              <Pressable
                testID="delete-confirm"
                accessibilityRole="button"
                accessibilityLabel="确认删除设备"
                onPress={submitDelete}
                style={({ pressed }) => [styles.dialogButtonDanger, pressed && styles.pressed]}
              >
                <Text style={styles.dialogDangerText}>删除</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.void, flex: 1 },
  container: { padding: 24, paddingBottom: 48, gap: 14 },
  eyebrow: { ...type.monoEyebrow, color: colors.ultramarine },
  title: { ...type.display, marginTop: 0 },
  subtitle: { ...type.body, marginBottom: 8 },
  updateCard: {
    backgroundColor: colors.panel,
    borderColor: 'rgba(61,110,255,0.45)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    marginBottom: 4,
    padding: 14,
  },
  updateEyebrow: { ...type.monoEyebrow, color: '#9DB8FF' },
  updateRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  updateMain: { flex: 1 },
  updateText: { color: colors.text, fontSize: 14 },
  updateButton: {
    alignItems: 'center',
    backgroundColor: colors.ultramarine,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  updateButtonText: { color: colors.onAccent, fontSize: 13, fontWeight: '700' },
  updateDismiss: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 30,
  },
  updateDismissText: { color: colors.faint, fontSize: 15 },
  emptyCard: {
    backgroundColor: colors.panel,
    borderColor: colors.hairline,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 22,
  },
  emptyReadout: { ...type.monoReadout, color: colors.faint },
  emptyText: { color: colors.dim, fontSize: 14, lineHeight: 21 },
  list: { gap: 10 },
  deviceCard: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.hairline,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  deviceMain: { flex: 1, gap: 4 },
  deviceNameRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  deviceName: { color: colors.text, flexShrink: 1, fontSize: 16, fontWeight: '700' },
  activeBadge: {
    backgroundColor: colors.signalSoft,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  activeBadgeText: { color: colors.signal, fontFamily: monoFont, fontSize: 11 },
  deviceUrl: { ...type.monoReadout, color: colors.faint },
  deviceMeta: { ...type.monoEyebrow, fontSize: 11 },
  menuButton: {
    alignItems: 'center',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  menuIcon: { color: colors.dim, fontSize: 20, lineHeight: 24 },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 20,
    marginTop: 10,
    padding: 18,
    gap: 13,
  },
  cardEyebrow: { ...type.monoEyebrow },
  scanButton: {
    alignItems: 'center',
    backgroundColor: colors.ultramarine,
    borderRadius: 14,
    paddingVertical: 15,
  },
  scanButtonText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
  orRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  orRule: { backgroundColor: colors.hairline, flex: 1, height: 1 },
  orLabel: { ...type.monoEyebrow, color: colors.faint },
  input: {
    color: colors.text,
    fontFamily: monoFont,
    backgroundColor: colors.panelDeep,
    borderColor: colors.hairline,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 88,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 13,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  previewBlock: { gap: 5 },
  previewLabel: { ...type.monoEyebrow, color: colors.faint },
  previewValue: { ...type.monoReadout },
  actionRow: { flexDirection: 'row', gap: 10 },
  connectButton: {
    alignItems: 'center',
    backgroundColor: colors.ultramarineSoft,
    borderColor: 'rgba(61,110,255,0.55)',
    borderRadius: 14,
    borderWidth: 1.5,
    flex: 1,
    paddingVertical: 14,
  },
  connectButtonText: { color: '#9DB8FF', fontSize: 15, fontWeight: '700' },
  clearButton: {
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  clearButtonText: { color: colors.faint, fontSize: 15, fontWeight: '600' },
  security: { color: colors.faint, fontSize: 12, lineHeight: 18 },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(4,6,12,0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  menuSheet: {
    backgroundColor: colors.panel,
    borderColor: colors.hairline,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 240,
    overflow: 'hidden',
  },
  menuTitle: {
    color: colors.faint,
    fontFamily: monoFont,
    fontSize: 12,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 6,
  },
  menuAction: { paddingVertical: 14, paddingHorizontal: 18 },
  menuActionText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  menuActionDanger: { paddingVertical: 14, paddingHorizontal: 18, borderTopWidth: 1, borderColor: colors.hairline },
  menuActionDangerText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  dialog: {
    backgroundColor: colors.panel,
    borderColor: colors.hairline,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 20,
    width: '100%',
  },
  dialogTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  dialogBody: { color: colors.dim, fontSize: 14, lineHeight: 21 },
  renameInput: {
    backgroundColor: colors.panelDeep,
    borderColor: colors.hairline,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dialogActions: { flexDirection: 'row', gap: 10 },
  dialogButton: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 13,
  },
  dialogCancelText: { color: colors.dim, fontSize: 15, fontWeight: '600' },
  dialogButtonPrimary: {
    alignItems: 'center',
    backgroundColor: colors.ultramarine,
    borderRadius: 12,
    flex: 1,
    paddingVertical: 13,
  },
  dialogButtonDisabled: { opacity: 0.4 },
  dialogConfirmText: { color: colors.onAccent, fontSize: 15, fontWeight: '700' },
  dialogButtonDanger: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderColor: 'rgba(255,138,128,0.45)',
    borderRadius: 12,
    borderWidth: 1.5,
    flex: 1,
    paddingVertical: 13,
  },
  dialogDangerText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: colors.pressed },
});
