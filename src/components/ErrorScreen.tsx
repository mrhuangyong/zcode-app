import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, monoFont, type } from '../lib/theme';

type ErrorScreenProps = {
  message: string;
  onRetry: () => void;
  onSetup?: () => void;
};

export default function ErrorScreen({ message, onRetry, onSetup }: ErrorScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>remote ▸ unreachable</Text>
        <Text style={styles.title}>连接遇到问题</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.actions}>
          <Pressable
            testID="retry-button"
            accessibilityRole="button"
            accessibilityLabel="重试连接"
            onPress={onRetry}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedButton]}
          >
            <Text style={styles.primaryButtonText}>重试</Text>
          </Pressable>
          {onSetup ? (
            <Pressable
              testID="reconfigure-button"
              accessibilityRole="button"
              accessibilityLabel="更换远控链接"
              onPress={onSetup}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressedButton]}
            >
              <Text style={styles.secondaryButtonText}>更换远控链接</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.hint}>桌面端离线或链接过期也会中断连接；重新扫码可获得新链接。</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.void, flex: 1 },
  container: { flex: 1, gap: 12, justifyContent: 'center', padding: 28 },
  eyebrow: {
    color: colors.danger,
    fontFamily: monoFont,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  title: { ...type.display, fontSize: 28 },
  message: { ...type.body, color: colors.dim },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.ultramarine,
    borderRadius: 14,
    paddingHorizontal: 30,
    paddingVertical: 13,
  },
  primaryButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  secondaryButtonText: { color: colors.dim, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.faint, fontSize: 12, lineHeight: 18, marginTop: 6 },
  pressedButton: { opacity: colors.pressed },
});
