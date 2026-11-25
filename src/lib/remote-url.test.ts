import {
  extractDeviceName,
  isHomeOrigin,
  isSafeRemoteUrl,
  normalizeRemoteUrl,
  parseConnectDeepLink,
  redactRemoteUrl,
  resolveInitialUrl,
  resolveScannedRemoteConnection,
} from './remote-url';

const remoteUrl =
  'https://zcode.z.ai/remote/v4?sid=session-id&hash=encoded%2Fvalue%3D&t=1234567890&mid=00000000-0000-4000-8000-000000000000&name=mrhuadeMacBook-Pro.local&app_version=3.7.7';

describe('remote URL policy', () => {
  it('accepts any http(s) remote URL', () => {
    expect(normalizeRemoteUrl(remoteUrl)).toBe(remoteUrl);
    expect(normalizeRemoteUrl('https://zcode.z.ai/remote/v4/?x=1')).toBe(
      'https://zcode.z.ai/remote/v4/?x=1',
    );
    expect(normalizeRemoteUrl('https://self-hosted.example.net/panel?sid=1')).toBe(
      'https://self-hosted.example.net/panel?sid=1',
    );
    expect(normalizeRemoteUrl('http://192.168.1.10:8080/remote')).toBe(
      'http://192.168.1.10:8080/remote',
    );
    expect(normalizeRemoteUrl('https://zcode.z.ai/settings')).toBe('https://zcode.z.ai/settings');
    expect(normalizeRemoteUrl('not a url')).toBeNull();
    expect(isSafeRemoteUrl(remoteUrl)).toBe(true);
    expect(isSafeRemoteUrl('https://self-hosted.example.net/panel')).toBe(true);
  });

  it('rejects non-http(s) schemes', () => {
    expect(normalizeRemoteUrl('ftp://files.example.net/panel')).toBeNull();
    expect(normalizeRemoteUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeRemoteUrl('file:///etc/hosts')).toBeNull();
    expect(normalizeRemoteUrl('about:blank')).toBeNull();
    expect(isSafeRemoteUrl('javascript:alert(1)')).toBe(false);
  });

  it('matches home origins by protocol and hostname', () => {
    expect(isHomeOrigin('https://self-hosted.example.net/page', 'https://self-hosted.example.net/panel?sid=1')).toBe(true);
    expect(isHomeOrigin('http://192.168.1.10:9000/other', 'http://192.168.1.10:8080/remote')).toBe(true);
    expect(isHomeOrigin('https://other.example.net/page', 'https://self-hosted.example.net/panel')).toBe(false);
    expect(isHomeOrigin('http://self-hosted.example.net/page', 'https://self-hosted.example.net/panel')).toBe(false);
    expect(isHomeOrigin('https://self-hosted.example.net.evil.com/page', 'https://self-hosted.example.net/panel')).toBe(false);
    expect(isHomeOrigin('not a url', 'https://self-hosted.example.net/panel')).toBe(false);
    expect(isHomeOrigin('https://self-hosted.example.net/page', 'not a url')).toBe(false);
  });

  it('keeps all session query parameters', () => {
    const normalized = normalizeRemoteUrl(remoteUrl);

    expect(normalized).not.toBeNull();
    expect(new URL(normalized as string).searchParams.size).toBe(6);
    expect(new URL(normalized as string).searchParams.get('hash')).toBe(
      'encoded/value=',
    );
  });

  it('redacts credentials from the visible URL', () => {
    const visible = redactRemoteUrl(remoteUrl);

    expect(visible).toContain('sid=%5Bredacted%5D');
    expect(visible).toContain('hash=%5Bredacted%5D');
    expect(visible).toContain('t=%5Bredacted%5D');
    expect(visible).toContain('mid=%5Bredacted%5D');
    expect(visible).not.toContain('session-id');
    expect(visible).not.toContain('encoded%2Fvalue%3D');
    expect(redactRemoteUrl('invalid')).toBe('无效链接');
  });

  it('extracts an encoded connect deep link', () => {
    const deepLink = `zcode-mobile://connect?url=${encodeURIComponent(remoteUrl)}`;

    expect(parseConnectDeepLink(deepLink)).toBe(remoteUrl);
    expect(parseConnectDeepLink('zcode-mobile://connect?url=javascript%3Aalert(1)')).toBeNull();
    expect(parseConnectDeepLink('zcode-mobile://settings')).toBeNull();
  });

  it('resolves scanned remote URLs and connect deep links', () => {
    expect(resolveScannedRemoteConnection(remoteUrl)).toBe(remoteUrl);
    expect(
      resolveScannedRemoteConnection(`zcode-mobile://connect?url=${encodeURIComponent(remoteUrl)}`),
    ).toBe(remoteUrl);
    expect(resolveScannedRemoteConnection('javascript:alert(1)')).toBeNull();
    expect(resolveScannedRemoteConnection('not a url')).toBeNull();
  });

  it('uses only a safely stored URL and has no build-time fallback', () => {
    expect(resolveInitialUrl({ stored: remoteUrl })).toBe(remoteUrl);
    expect(resolveInitialUrl({ stored: 'javascript:alert(1)' })).toBeNull();
    expect(resolveInitialUrl({ stored: null })).toBeNull();
    expect(resolveInitialUrl({})).toBeNull();
  });
});

describe('extractDeviceName', () => {
  it('reads the name query parameter', () => {
    expect(extractDeviceName(remoteUrl)).toBe('mrhuadeMacBook-Pro.local');
  });

  it('returns null when the name is missing, blank, or the URL is unsafe', () => {
    expect(extractDeviceName('https://zcode.z.ai/remote/v4?sid=1')).toBeNull();
    expect(extractDeviceName('https://zcode.z.ai/remote/v4?name=%20%20')).toBeNull();
    expect(extractDeviceName('javascript:alert(1)?name=Mac')).toBeNull();
  });
});
