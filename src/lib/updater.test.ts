import {
  checkForUpdate,
  compareVersions,
  extractRelease,
  fetchLatestRelease,
  getCurrentVersion,
} from './updater';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

globalThis.fetch = jest.fn();

const apkPayload = {
  tag_name: 'v1.0.1',
  body: 'release notes',
  assets: [
    { name: 'zcode-remote-v1.0.1.apk', browser_download_url: 'https://github.com/mrhuangyong/zcode-app/releases/download/v1.0.1/zcode-remote-v1.0.1.apk' },
  ],
};

const fetchMock = globalThis.fetch as unknown as jest.Mock;

beforeEach(() => {
  fetchMock.mockReset();
});

describe('compareVersions', () => {
  it('orders semver versions', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersions('1.1.0', '1.0.9')).toBeGreaterThan(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.9.9', '1.0.0')).toBeLessThan(0);
  });
});

describe('getCurrentVersion', () => {
  it('reads the version from expo config', () => {
    expect(getCurrentVersion()).toBe('1.0.0');
  });
});

describe('extractRelease', () => {
  it('normalizes the tag and picks the APK asset', () => {
    const release = extractRelease(apkPayload);

    expect(release).not.toBeNull();
    expect(release?.version).toBe('1.0.1');
    expect(release?.apkUrl).toContain('zcode-remote-v1.0.1.apk');
    expect(release?.notes).toBe('release notes');
  });

  it('rejects payloads without an APK asset', () => {
    expect(extractRelease({ tag_name: 'v1.0.1', assets: [{ name: 'notes.txt', browser_download_url: 'https://x' }] })).toBeNull();
    expect(extractRelease({ assets: [] })).toBeNull();
  });
});

describe('fetchLatestRelease', () => {
  it('returns the parsed release', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => apkPayload });

    await expect(fetchLatestRelease()).resolves.toMatchObject({ version: '1.0.1' });
  });

  it('returns null on HTTP errors and network failures', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(fetchLatestRelease()).resolves.toBeNull();

    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(fetchLatestRelease()).resolves.toBeNull();
  });
});

describe('checkForUpdate', () => {
  it('reports an update when the release is newer than the app version', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => apkPayload });

    const result = await checkForUpdate();

    expect(result).toMatchObject({
      available: true,
      currentVersion: '1.0.0',
      release: { version: '1.0.1' },
    });
  });

  it('reports no update when the release is not newer', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ...apkPayload, tag_name: 'v1.0.0' }),
    });

    const result = await checkForUpdate();

    expect(result).toMatchObject({ available: false, currentVersion: '1.0.0' });
  });

  it('returns null when the release cannot be fetched', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(checkForUpdate()).resolves.toBeNull();
  });
});
