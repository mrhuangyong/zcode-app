import * as secureStore from 'expo-secure-store';
import { STORAGE_KEY } from './remote-url';
import { clearRemoteUrl, loadRemoteUrl, saveRemoteUrl } from './secure-remote-store';

const remoteUrl =
  'https://zcode.z.ai/remote/v4?sid=session-id&hash=encoded%2Fvalue%3D&t=1&mid=mid&name=Mac.local&app_version=3.7.7';

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
const getItemAsync = secureStore.getItemAsync as jest.Mock;
const setItemAsync = secureStore.setItemAsync as jest.Mock;
const deleteItemAsync = secureStore.deleteItemAsync as jest.Mock;

beforeEach(() => {
  getItemAsync.mockReset();
  setItemAsync.mockReset();
  deleteItemAsync.mockReset();
});

describe('secure remote store', () => {
  it('saves only a valid remote URL', async () => {
    await expect(saveRemoteUrl(remoteUrl)).resolves.toBe(true);

    expect(setItemAsync).toHaveBeenCalledWith(STORAGE_KEY, remoteUrl);

    await expect(saveRemoteUrl('https://evil.example/remote/v4')).resolves.toBe(false);

    expect(setItemAsync).toHaveBeenCalledTimes(1);
  });

  it('loads only a valid stored URL', async () => {
    getItemAsync.mockResolvedValue(remoteUrl);

    await expect(loadRemoteUrl()).resolves.toBe(remoteUrl);
    expect(getItemAsync).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('deletes a corrupted stored value and recovers to null', async () => {
    getItemAsync.mockResolvedValue('https://evil.example/remote/v4');

    await expect(loadRemoteUrl()).resolves.toBeNull();
    expect(deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('returns recoverable values when SecureStore fails', async () => {
    getItemAsync.mockRejectedValue(new Error('locked'));
    await expect(loadRemoteUrl()).resolves.toBeNull();

    setItemAsync.mockRejectedValue(new Error('full'));
    await expect(saveRemoteUrl(remoteUrl)).resolves.toBe(false);

    deleteItemAsync.mockRejectedValue(new Error('locked'));
    await expect(clearRemoteUrl()).resolves.toBe(false);
  });

  it('clears the stored URL', async () => {
    deleteItemAsync.mockResolvedValue(undefined);

    await expect(clearRemoteUrl()).resolves.toBe(true);
    expect(deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEY);
  });
});
