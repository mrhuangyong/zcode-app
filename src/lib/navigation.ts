export type NavigationTarget = 'webview' | 'auth' | 'system' | 'blocked';

const SYSTEM_SCHEMES = new Set(['https:', 'http:', 'mailto:', 'tel:', 'sms:']);
const WEBVIEW_INTERNAL_SCHEMES = new Set(['about:', 'data:', 'blob:']);

// ZCode 远控页的 OAuth 授权根域（来自 web 端构建产物）：
// zai → chat.z.ai，bigmodel → bigmodel.cn。根域及其子域（www./open. 等登录跳转）都在
// 应用内登录 overlay 中加载；子域由协议方控制，相似域（evil-z.ai / z.ai.evil.com）不会命中。
// 注意不要放宽到 z.ai 根域——docs.z.ai 等文档站仍应走系统浏览器。
export const AUTH_ROOTS = ['chat.z.ai', 'bigmodel.cn'];

export function isAuthHost(hostname: string): boolean {
  return AUTH_ROOTS.some((root) => hostname === root || hostname.endsWith(`.${root}`));
}

export function resolveNavigationTarget(rawUrl: string): NavigationTarget {
  if (WEBVIEW_INTERNAL_SCHEMES.has(rawUrl.slice(0, rawUrl.indexOf(':') + 1))) {
    return 'webview';
  }

  try {
    const url = new URL(rawUrl);

    if (url.protocol === 'https:' && url.hostname === 'zcode.z.ai') {
      return 'webview';
    }

    if (url.protocol === 'https:' && isAuthHost(url.hostname)) {
      return 'auth';
    }

    return SYSTEM_SCHEMES.has(url.protocol) ? 'system' : 'blocked';
  } catch {
    return 'blocked';
  }
}
