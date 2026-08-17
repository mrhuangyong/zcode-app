import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { normalizeRemoteUrl, redactRemoteUrl } from '../lib/remote-url';

type SetupScreenProps = {
  onConnect: (url: string) => void | Promise<void>;
  onScanRequest: () => void;
};

export default function SetupScreen({ onConnect, onScanRequest }: SetupScreenProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const normalized = normalizeRemoteUrl(value);
  const preview = normalized ? redactRemoteUrl(normalized) : null;

  const connect = () => {
    if (!normalized) {
      setError('链接无效：请粘贴 ZCode 桌面端生成的 https://zcode.z.ai/remote/v4 远控地址。');
      return;
    }

    setError(null);
    void onConnect(normalized);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Z</Text>
          </View>
          <Text style={styles.title}>ZCode Remote</Text>
          <Text style={styles.subtitle}>
            连接你的 macOS / Windows 桌面端 ZCode，在手机上继续会话、编辑器、终端与远控操作。
          </Text>

          <View style={styles.card}>
            <Pressable
              testID="open-scanner-button"
              accessibilityRole="button"
              accessibilityLabel="扫码连接 ZCode"
              onPress={onScanRequest}
              style={({ pressed }) => [styles.scanButton, pressed && styles.pressedButton]}
            >
              <Text style={styles.scanButtonText}>扫码连接 ZCode</Text>
            </Pressable>
            <View style={styles.divider} />
            <Text style={styles.label}>远控链接</Text>
            <TextInput
              testID="remote-url-input"
              value={value}
              onChangeText={setValue}
              style={[styles.input, error ? styles.inputError : null]}
              placeholder="https://zcode.z.ai/remote/v4?..."
              placeholderTextColor="#667085"
              multiline
              numberOfLines={4}
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
            {preview ? <Text style={styles.preview}>安全预览：{preview}</Text> : null}
            <Text style={styles.security}>凭据只保存在本机安全存储，不会同步到第三方服务，也不会显示完整链接。</Text>

            <Pressable
              testID="connect-button"
              accessibilityRole="button"
              accessibilityLabel="连接 ZCode"
              onPress={connect}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedButton]}
            >
              <Text style={styles.primaryButtonText}>连接 ZCode</Text>
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
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressedButton]}
              >
                <Text style={styles.secondaryButtonText}>清空</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#080b12', flex: 1 },
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 20 },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#155ee3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#155ee3',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  badgeText: { color: '#ffffff', fontSize: 34, fontWeight: '800' },
  title: { color: '#ffffff', fontSize: 34, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { color: '#a5adc8', fontSize: 16, lineHeight: 24 },
  card: {
    backgroundColor: 'rgba(22, 27, 39, 0.96)',
    borderColor: 'rgba(96, 112, 150, 0.35)',
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 13,
  },
  label: { color: '#e7eaf3', fontSize: 15, fontWeight: '700' },
  input: {
    color: '#ffffff',
    backgroundColor: '#0b0f18',
    borderColor: '#283247',
    borderRadius: 15,
    borderWidth: 1,
    minHeight: 104,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  inputError: { borderColor: '#d92d20' },
  error: { color: '#ff9188', fontSize: 13, lineHeight: 19 },
  preview: { color: '#7d8aa5', fontSize: 12, lineHeight: 18 },
  security: { color: '#667085', fontSize: 12, lineHeight: 18 },
  scanButton: {
    alignItems: 'center',
    backgroundColor: '#155ee3',
    borderRadius: 15,
    paddingVertical: 15,
  },
  scanButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  divider: { backgroundColor: 'rgba(96,112,150,0.28)', height: 1 },
  primaryButton: {
    backgroundColor: '#155ee3',
    alignItems: 'center',
    borderRadius: 15,
    paddingVertical: 15,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 15,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  secondaryButtonText: { color: '#cfd5e4', fontSize: 15, fontWeight: '600' },
  pressedButton: { opacity: 0.78 },
});
