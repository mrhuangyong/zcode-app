import Constants from 'expo-constants';

// 应用内更新检查：匿名读取 GitHub Releases API（仓库公开），
// 最新 Release 版本高于当前版本时提示更新，下载走系统浏览器（Release 附件直链）。

export const GITHUB_REPO = 'mrhuangyong/zcode-app';
const RELEASES_LATEST_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export type RemoteRelease = {
  version: string;
  apkUrl: string;
  notes: string;
};

export type UpdateCheckResult = {
  currentVersion: string;
} & ({ available: false } | { available: true; release: RemoteRelease });

type GithubReleasePayload = {
  tag_name?: unknown;
  body?: unknown;
  assets?: { name?: unknown; browser_download_url?: unknown }[];
};

function normalizeVersion(tag: string): string {
  const trimmed = tag.trim();
  return trimmed.startsWith('v') ? trimmed.slice(1) : trimmed;
}

export function compareVersions(a: string, b: string): number {
  const parse = (value: string) =>
    value
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0)
      .concat([0, 0, 0])
      .slice(0, 3);
  const [aMajor, aMinor, aPatch] = parse(a);
  const [bMajor, bMinor, bPatch] = parse(b);

  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}

export function getCurrentVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

export function extractRelease(payload: GithubReleasePayload): RemoteRelease | null {
  if (typeof payload.tag_name !== 'string') {
    return null;
  }

  const apk = (Array.isArray(payload.assets) ? payload.assets : []).find(
    (asset) =>
      typeof asset.name === 'string' &&
      asset.name.endsWith('.apk') &&
      typeof asset.browser_download_url === 'string',
  );

  if (!apk || typeof apk.browser_download_url !== 'string') {
    return null;
  }

  return {
    version: normalizeVersion(payload.tag_name),
    apkUrl: apk.browser_download_url,
    notes: typeof payload.body === 'string' ? payload.body : '',
  };
}

export async function fetchLatestRelease(): Promise<RemoteRelease | null> {
  try {
    const response = await fetch(RELEASES_LATEST_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });

    if (!response.ok) {
      return null;
    }

    return extractRelease((await response.json()) as GithubReleasePayload);
  } catch {
    return null;
  }
}

export async function checkForUpdate(): Promise<UpdateCheckResult | null> {
  const [release] = await Promise.all([fetchLatestRelease()]);
  const currentVersion = getCurrentVersion();

  if (!release) {
    return null;
  }

  if (compareVersions(release.version, currentVersion) > 0) {
    return { available: true, currentVersion, release };
  }

  return { available: false, currentVersion };
}
