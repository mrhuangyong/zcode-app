import * as SecureStore from 'expo-secure-store';
import { normalizeRemoteUrl, STORAGE_KEY } from './remote-url';

export async function loadRemoteUrl(): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);

    if (typeof stored !== 'string') {
      return null;
    }

    const normalized = normalizeRemoteUrl(stored);

    if (!normalized) {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
      return null;
    }

    return normalized;
  } catch {
    return null;
  }
}

export async function saveRemoteUrl(url: string): Promise<boolean> {
  const normalized = normalizeRemoteUrl(url);

  if (!normalized) {
    return false;
  }

  try {
    await SecureStore.setItemAsync(STORAGE_KEY, normalized);
    return true;
  } catch {
    return false;
  }
}

export async function clearRemoteUrl(): Promise<boolean> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
