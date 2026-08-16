import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ErrorScreenProps = {
  message: string;
  onRetry: () => void;
  onSetup?: () => void;
};

export default function ErrorScreen({ message, onRetry, onSetup }: ErrorScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>!</Text>
        </View>
        <Text style={styles.title}>连接遇到问题</Text>
        <Text style={styles.message}>{message}</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#080b12', flex: 1 },
  container: { alignItems: 'center', flexGrow: 1, gap: 14, justifyContent: 'center', padding: 24 },
  icon: {
    alignItems: 'center',
    backgroundColor: 'rgba(217,45,32,0.14)',
    borderColor: 'rgba(255,145,136,0.36)',
    borderRadius: 24,
    borderWidth: 1,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  iconText: { color: '#ff9188', fontSize: 32, fontWeight: '800' },
  title: { color: '#ffffff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  message: { color: '#a5adc8', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#155ee3',
    borderRadius: 15,
    paddingHorizontal: 34,
    paddingVertical: 14,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 15,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  secondaryButtonText: { color: '#cfd5e4', fontSize: 15, fontWeight: '600' },
  pressedButton: { opacity: 0.76 },
});
