export const STORAGE_KEY = 'zcode.remote.url.v1';
export const DEVICES_STORAGE_KEY = 'zcode.remote.devices.v1';

function parseUrl(input: string): URL | null {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return null;
  }

  try {
    return new URL(input.trim());
  } catch {
    return null;
  }
}

function toSafeUrl(input: string): URL | null {
  const url = parseUrl(input);

  if (!url) {
    return null;
  }

  // 任意远控页面均可作为主链接，只要求 http(s) 协议；
  // 其他 scheme（javascript:/file: 等）与非 URL 一律拒绝。
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null;
  }

  return url;
}

// 判断 rawUrl 是否与主 URL 同源（比较协议 + 主机名，忽略端口，与原生导航策略对齐）。
export function isHomeOrigin(rawUrl: string, home: string): boolean {
  const url = parseUrl(rawUrl);
  const homeUrl = parseUrl(home);

  if (!url || !homeUrl) {
    return false;
  }

  return url.protocol === homeUrl.protocol && url.hostname === homeUrl.hostname;
}

export function normalizeRemoteUrl(input: string): string | null {
  return toSafeUrl(input)?.toString() ?? null;
}

export function isSafeRemoteUrl(input: string): boolean {
  return toSafeUrl(input) !== null;
}

export function redactRemoteUrl(input: string): string {
  const url = toSafeUrl(input);

  if (!url) {
    return '无效链接';
  }

  url.searchParams.forEach((_value, key) => {
    url.searchParams.set(key, '[redacted]');
  });

  return url.toString();
}

export function extractDeviceName(input: string): string | null {
  const name = toSafeUrl(input)?.searchParams.get('name');
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 40) : null;
}

export function parseConnectDeepLink(input: string): string | null {
  const link = parseUrl(input);

  if (!link || link.protocol !== 'zcode-mobile:' || link.hostname !== 'connect') {
    return null;
  }

  const target = link.searchParams.get('url');

  return target ? normalizeRemoteUrl(target) : null;
}

export function resolveInitialUrl(options: { stored?: string | null }): string | null {
  return normalizeRemoteUrl(options.stored ?? '');
}

export function resolveScannedRemoteConnection(input: string): string | null {
  return normalizeRemoteUrl(input) ?? parseConnectDeepLink(input);
}
