import { Platform } from 'react-native';

// 设计令牌：所有界面颜色与字体统一从这里取值，不要在组件里写散落色值。
// 语义约定：ultramarine 只用于可交互元素；signal 只用于"链路已建立/已验证"状态；
// danger 只用于错误与恢复提示。背景保持 #080B12 与启动图、app.config 一致。

export const colors = {
  void: '#080B12',
  panel: '#0F1523',
  panelDeep: '#0A0E19',
  hairline: '#232E45',
  text: '#E9EDF5',
  dim: '#93A0B9',
  faint: '#5C6880',
  ultramarine: '#3D6EFF',
  ultramarineSoft: 'rgba(61,110,255,0.16)',
  signal: '#3ECF8E',
  signalSoft: 'rgba(62,207,142,0.14)',
  danger: '#FF8A80',
  dangerSoft: 'rgba(255,138,128,0.12)',
  onAccent: '#FFFFFF',
  pressed: 0.78,
} as const;

// 终端等宽栈：iOS 用 Menlo，Android 与 Web 落到系统 monospace。
export const monoFont = Platform.select({
  ios: 'Menlo',
  default: 'monospace',
}) as string;

export const type = {
  display: { color: colors.text, fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  body: { color: colors.dim, fontSize: 15, lineHeight: 22 },
  monoEyebrow: {
    color: colors.faint,
    fontFamily: monoFont,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  monoReadout: {
    color: colors.dim,
    fontFamily: monoFont,
    fontSize: 12.5,
    lineHeight: 19,
  },
} as const;
