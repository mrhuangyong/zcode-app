import {
  isSafeRemoteUrl,
  normalizeRemoteUrl,
  parseConnectDeepLink,
  redactRemoteUrl,
  resolveInitialUrl,
} from './remote-url';

const remoteUrl =
  'https://zcode.z.ai/remote/v4?sid=session-id&hash=encoded%2Fvalue%3D&t=1786803761869&mid=729fe692-5067-4ba0-af0f-4d0b3843b03e&name=mrhuadeMacBook-Pro.local&app_version=3.7.7';

describe('remote URL policy', () => {
  it('accepts only the official HTTPS ZCode remote route', () => {
    expect(normalizeRemoteUrl(remoteUrl)).toBe(remoteUrl);
    expect(normalizeRemoteUrl('https://zcode.z.ai/remote/v4/?x=1')).toBe(
      'https://zcode.z.ai/remote/v4/?x=1',
    );
    expect(normalizeRemoteUrl('http://zcode.z.ai/remote/v4?sid=1')).toBeNull();
    expect(normalizeRemoteUrl('https://evil.example/remote/v4?sid=1')).toBeNull();
    expect(normalizeRemoteUrl('https://zcode.z.ai/settings')).toBeNull();
    expect(normalizeRemoteUrl('not a url')).toBeNull();
    expect(isSafeRemoteUrl(remoteUrl)).toBe(true);
    expect(isSafeRemoteUrl('https://evil.example/remote/v4')).toBe(false);
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
    expect(parseConnectDeepLink('zcode-mobile://connect?url=https%3A%2F%2Fevil.example')).toBeNull();
    expect(parseConnectDeepLink('zcode-mobile://settings')).toBeNull();
  });

  it('prefers stored URL over build-time URL and ignores unsafe values', () => {
    expect(
      resolveInitialUrl({
        stored: remoteUrl,
        configured: 'https://zcode.z.ai/remote/v4?sid=build',
      }),
    ).toBe(remoteUrl);
    expect(resolveInitialUrl({ stored: 'https://evil.example', configured: remoteUrl })).toBe(remoteUrl);
    expect(resolveInitialUrl({ stored: null, configured: remoteUrl })).toBe(remoteUrl);
    expect(resolveInitialUrl({ stored: null, configured: 'https://evil.example' })).toBeNull();
    expect(resolveInitialUrl({})).toBeNull();
  });
});
