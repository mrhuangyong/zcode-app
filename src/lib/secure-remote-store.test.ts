import * as secureStore from 'expo-secure-store';
import { DEVICES_STORAGE_KEY, STORAGE_KEY } from './remote-url';
import {
  deleteDevice,
  loadDevices,
  renameDevice,
  upsertDevice,
  type RemoteDevice,
} from './secure-remote-store';

const remoteUrl =
  'https://zcode.z.ai/remote/v4?sid=session-id&hash=encoded%2Fvalue%3D&t=1&mid=mid&name=Mac.local&app_version=3.7.7';
const otherUrl =
  'https://zcode.z.ai/remote/v4?sid=other-session&hash=other%2Fvalue%3D&t=1&mid=mid2&name=DevBox.local&app_version=3.7.7';

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
const getItemAsync = secureStore.getItemAsync as jest.Mock;
const setItemAsync = secureStore.setItemAsync as jest.Mock;
const deleteItemAsync = secureStore.deleteItemAsync as jest.Mock;

// 内存版 SecureStore：setItemAsync 写入、getItemAsync 读回，模拟真实持久化。
const backing = new Map<string, string>();

function storedDevices(): RemoteDevice[] {
  const raw = backing.get(DEVICES_STORAGE_KEY);

  if (!raw) {
    throw new Error('devices were never saved');
  }

  return JSON.parse(raw);
}

function mockStored(devices: RemoteDevice[]) {
  backing.set(DEVICES_STORAGE_KEY, JSON.stringify(devices));
}

beforeEach(() => {
  backing.clear();
  getItemAsync.mockReset().mockImplementation(async (key: string) => backing.get(key) ?? null);
  setItemAsync.mockReset().mockImplementation(async (key: string, value: string) => {
    backing.set(key, value);
  });
  deleteItemAsync.mockReset().mockImplementation(async (key: string) => {
    backing.delete(key);
  });
});

describe('secure device store', () => {
  it('returns an empty list when nothing is stored', async () => {
    await expect(loadDevices()).resolves.toEqual([]);
  });

  it('migrates the legacy single URL into one device and removes the old key', async () => {
    getItemAsync.mockImplementation(async (key: string) =>
      key === STORAGE_KEY ? remoteUrl : null,
    );

    const devices = await loadDevices();

    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ url: remoteUrl, name: 'Mac.local' });
    expect(setItemAsync).toHaveBeenCalledWith(DEVICES_STORAGE_KEY, expect.any(String));
    expect(deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('drops a corrupt stored payload and recovers to an empty list', async () => {
    getItemAsync.mockResolvedValue('not-json');

    await expect(loadDevices()).resolves.toEqual([]);
    expect(deleteItemAsync).toHaveBeenCalledWith(DEVICES_STORAGE_KEY);
  });

  it('filters out invalid device entries when loading', async () => {
    mockStored([
      { id: 'a', url: remoteUrl, name: 'Workstation', createdAt: 1, lastConnectedAt: 2 },
      { id: 'b', url: 'https://evil.example/remote/v4', name: 'Evil', createdAt: 1, lastConnectedAt: 2 },
      { id: '', url: otherUrl, name: 'NoId', createdAt: 1, lastConnectedAt: 2 },
    ]);

    const devices = await loadDevices();

    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ id: 'a', name: 'Workstation' });
  });

  it('upserts a new device with the name from the URL', async () => {
    const device = (await upsertDevice(remoteUrl))!;

    expect(device).not.toBeNull();
    expect(device).toMatchObject({ url: remoteUrl, name: 'Mac.local' });
    expect(storedDevices()).toHaveLength(1);
  });

  it('rejects an unsafe URL instead of storing it', async () => {
    await expect(upsertDevice('https://evil.example/remote/v4')).resolves.toBeNull();
    expect(setItemAsync).not.toHaveBeenCalled();
  });

  it('updates lastConnectedAt and keeps the custom name when reconnecting', async () => {
    const first = (await upsertDevice(remoteUrl))!;
    await renameDevice(first.id, '主 workstation');
    mockStored(storedDevices());

    const again = await upsertDevice(remoteUrl);

    expect(again).toMatchObject({ id: first.id, name: '主 workstation' });
    expect(again?.lastConnectedAt).toBeGreaterThanOrEqual(first.lastConnectedAt);
    expect(storedDevices()).toHaveLength(1);
  });

  it('renames a device and trims the name', async () => {
    const device = (await upsertDevice(remoteUrl))!;

    await renameDevice(device.id, '  Studio Mac  ');

    expect(storedDevices()[0].name).toBe('Studio Mac');
  });

  it('keeps the old name when renaming to blank', async () => {
    const device = (await upsertDevice(remoteUrl))!;

    await renameDevice(device.id, '   ');

    expect(storedDevices()[0].name).toBe('Mac.local');
  });

  it('deletes a device by id', async () => {
    const a = (await upsertDevice(remoteUrl))!;
    const b = (await upsertDevice(otherUrl))!;

    await deleteDevice(a.id);

    const remaining = storedDevices();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(b.id);
  });

  it('recovers to an empty list when SecureStore fails', async () => {
    getItemAsync.mockRejectedValue(new Error('locked'));

    await expect(loadDevices()).resolves.toEqual([]);
  });
});
