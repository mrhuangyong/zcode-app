export type NavigationTarget = 'webview' | 'system' | 'blocked';

const SYSTEM_SCHEMES = new Set(['https:', 'http:', 'mailto:', 'tel:', 'sms:']);
const WEBVIEW_INTERNAL_SCHEMES = new Set(['about:', 'data:', 'blob:']);

export function resolveNavigationTarget(rawUrl: string): NavigationTarget {
  if (WEBVIEW_INTERNAL_SCHEMES.has(rawUrl.slice(0, rawUrl.indexOf(':') + 1))) {
    return 'webview';
  }

  try {
    const url = new URL(rawUrl);

    if (url.protocol === 'https:' && url.hostname === 'zcode.z.ai') {
      return 'webview';
    }

    return SYSTEM_SCHEMES.has(url.protocol) ? 'system' : 'blocked';
  } catch {
    return 'blocked';
  }
}
