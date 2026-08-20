import * as SecureStore from 'expo-secure-store';
import {
  DEVICES_STORAGE_KEY,
  extractDeviceName,
  normalizeRemoteUrl,
  STORAGE_KEY,
} from './remote-url';

export type RemoteDevice = {
  id: string;
  url: string;
  name: string;
  createdAt: number;
  lastConnectedAt: number;
};

function createDeviceId(): string {
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeDevices(raw: unknown): RemoteDevice[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const now = Date.now();

  return raw.flatMap((item): RemoteDevice[] => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }

    const candidate = item as Partial<RemoteDevice>;
    const url = normalizeRemoteUrl(typeof candidate.url === 'string' ? candidate.url : '');

    if (!url || typeof candidate.id !== 'string' || candidate.id.length === 0) {
      return [];
    }

    const createdAt = typeof candidate.createdAt === 'number' ? candidate.createdAt : now;
    const lastConnectedAt =
      typeof candidate.lastConnectedAt === 'number' ? candidate.lastConnectedAt : createdAt;
    const name =
      typeof candidate.name === 'string' && candidate.name.trim().length > 0
        ? candidate.name.trim().slice(0, 40)
        : (extractDeviceName(url) ?? 'ZCode Remote');

    return [{ id: candidate.id, url, name, createdAt, lastConnectedAt }];
  });
}

// 旧版本只保存单个远控 URL；读到旧 key 时迁移为一条设备记录并删除旧 key。
async function migrateLegacyUrl(): Promise<RemoteDevice[]> {
  try {
    const legacy = await SecureStore.getItemAsync(STORAGE_KEY);

    if (typeof legacy !== 'string') {
      return [];
    }

    const url = normalizeRemoteUrl(legacy);

    if (!url) {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
      return [];
    }

    const now = Date.now();
    const device: RemoteDevice = {
      id: createDeviceId(),
      url,
      name: extractDeviceName(url) ?? 'ZCode Remote',
      createdAt: now,
      lastConnectedAt: now,
    };

    await SecureStore.setItemAsync(DEVICES_STORAGE_KEY, JSON.stringify([device]));
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    return [device];
  } catch {
    return [];
  }
}

export async function loadDevices(): Promise<RemoteDevice[]> {
  try {
    const stored = await SecureStore.getItemAsync(DEVICES_STORAGE_KEY);

    if (typeof stored !== 'string') {
      return migrateLegacyUrl();
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(stored);
    } catch {
      await SecureStore.deleteItemAsync(DEVICES_STORAGE_KEY);
      return [];
    }

    return sanitizeDevices(parsed);
  } catch {
    return [];
  }
}

async function saveDevices(devices: RemoteDevice[]): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(DEVICES_STORAGE_KEY, JSON.stringify(devices));
    return true;
  } catch {
    return false;
  }
}

export async function upsertDevice(url: string): Promise<RemoteDevice | null> {
  const normalized = normalizeRemoteUrl(url);

  if (!normalized) {
    return null;
  }

  const devices = await loadDevices();
  const existing = devices.find((device) => device.url === normalized);
  const now = Date.now();

  if (existing) {
    const updated: RemoteDevice = { ...existing, url: normalized, lastConnectedAt: now };
    const next = devices.map((device) => (device.id === existing.id ? updated : device));

    if (!(await saveDevices(next))) {
      return updated;
    }

    return updated;
  }

  const device: RemoteDevice = {
    id: createDeviceId(),
    url: normalized,
    name: extractDeviceName(normalized) ?? 'ZCode Remote',
    createdAt: now,
    lastConnectedAt: now,
  };

  await saveDevices([...devices, device]);
  return device;
}

export async function renameDevice(id: string, name: string): Promise<RemoteDevice[]> {
  const trimmed = name.trim().slice(0, 40);
  const devices = await loadDevices();

  const next = trimmed
    ? devices.map((device) => (device.id === id ? { ...device, name: trimmed } : device))
    : devices;

  if (next !== devices) {
    await saveDevices(next);
  }

  return next;
}

export async function deleteDevice(id: string): Promise<RemoteDevice[]> {
  const devices = await loadDevices();
  const next = devices.filter((device) => device.id !== id);

  await saveDevices(next);
  return next;
}

export async function findDeviceByUrl(url: string): Promise<RemoteDevice | null> {
  const normalized = normalizeRemoteUrl(url);

  if (!normalized) {
    return null;
  }

  const devices = await loadDevices();
  return devices.find((device) => device.url === normalized) ?? null;
}
