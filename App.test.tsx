jest.mock('expo-status-bar', () => ({
  StatusBar: jest.fn(() => null),
}));

jest.mock('./src/lib/secure-remote-store', () => ({
  deleteDevice: jest.fn(async () => []),
  loadDevices: jest.fn(async () => []),
  renameDevice: jest.fn(async () => []),
  upsertDevice: jest.fn(async () => null),
}));

jest.mock('./src/components/QRScannerScreen', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock('./src/components/RemoteShell', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

import { act, render, waitFor } from '@testing-library/react-native';
import { Linking, type EmitterSubscription } from 'react-native';
import App from './App';
import RemoteShell from './src/components/RemoteShell';
import DeviceListScreen from './src/components/DeviceListScreen';
import QRScannerScreen from './src/components/QRScannerScreen';
import {
  deleteDevice,
  loadDevices,
  renameDevice,
  upsertDevice,
  type RemoteDevice,
} from './src/lib/secure-remote-store';

jest.mock('./src/components/DeviceListScreen', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

beforeAll(() => {
  jest.spyOn(Linking, 'addEventListener').mockImplementation(
    () => ({ remove: jest.fn() }) as unknown as EmitterSubscription,
  );
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
});

afterAll(() => {
  jest.restoreAllMocks();
});

const remoteUrl =
  'https://zcode.z.ai/remote/v4?sid=session-id&hash=encoded%2Fvalue%3D&t=1&mid=mid&name=Mac.local&app_version=3.7.7';
const deepLink = `zcode-mobile://connect?url=${encodeURIComponent(remoteUrl)}`;

const device: RemoteDevice = {
  id: 'dev_1',
  url: remoteUrl,
  name: 'Mac.local',
  createdAt: 1723900000000,
  lastConnectedAt: 1723900000000,
};

const remoteShellMock = RemoteShell as unknown as jest.Mock;
const listMock = DeviceListScreen as unknown as jest.Mock;
const scannerMock = QRScannerScreen as unknown as jest.Mock;

beforeEach(() => {
  remoteShellMock.mockClear();
  listMock.mockClear();
  scannerMock.mockClear();
  (loadDevices as jest.Mock).mockReset().mockResolvedValue([]);
  (upsertDevice as jest.Mock).mockReset().mockResolvedValue(device);
  (renameDevice as jest.Mock).mockReset().mockResolvedValue([]);
  (deleteDevice as jest.Mock).mockReset().mockResolvedValue([]);
  (Linking.getInitialURL as jest.Mock).mockReset().mockResolvedValue(null);
  (Linking.addEventListener as jest.Mock).mockClear();
});

describe('App startup and device management', () => {
  it('shows the device list on startup instead of auto-connecting', async () => {
    (loadDevices as jest.Mock).mockResolvedValue([device]);

    await render(<App />);
    await act(async () => {});

    expect(loadDevices).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ devices: [device] }),
      undefined,
    ));
    expect(remoteShellMock).not.toHaveBeenCalled();
  });

  it('shows an empty device list when nothing is stored', async () => {
    await render(<App />);
    await act(async () => {});

    await waitFor(() => expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ devices: [] }),
      undefined,
    ));
  });

  it('connects via the list and opens the shell without deleting storage', async () => {
    await render(<App />);
    await act(async () => {});
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    await act(async () => {
      await listMock.mock.calls[0][0].onConnect(remoteUrl);
    });

    expect(upsertDevice).toHaveBeenCalledWith(remoteUrl);
    await waitFor(() => expect(remoteShellMock).toHaveBeenCalledWith(
      expect.objectContaining({ remoteUrl, deviceName: 'Mac.local' }),
      undefined,
    ));
  });

  it('accepts a safe connect deep link while the app is running', async () => {
    await render(<App />);
    await act(async () => {});
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    const listener = (Linking.addEventListener as jest.Mock).mock.calls[0][1];

    await act(async () => {
      listener({ url: deepLink });
    });

    expect(upsertDevice).toHaveBeenCalledWith(remoteUrl);
    await waitFor(() => expect(remoteShellMock).toHaveBeenCalledWith(
      expect.objectContaining({ remoteUrl }),
      undefined,
    ));
  });

  it('returns to the device list from the shell without clearing stored devices', async () => {
    await render(<App />);
    await act(async () => {});
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    await act(async () => {
      await listMock.mock.calls[0][0].onConnect(remoteUrl);
    });
    await waitFor(() => expect(remoteShellMock).toHaveBeenCalled());

    await act(async () => {
      remoteShellMock.mock.calls[0][0].onExit();
    });

    expect(deleteDevice).not.toHaveBeenCalled();
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it('renames and deletes devices through the store', async () => {
    await render(<App />);
    await act(async () => {});
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    await act(async () => {
      await listMock.mock.calls[0][0].onRenameDevice('dev_1', '新名字');
    });
    expect(renameDevice).toHaveBeenCalledWith('dev_1', '新名字');

    await act(async () => {
      await listMock.mock.calls.at(-1)[0].onDeleteDevice('dev_1');
    });
    expect(deleteDevice).toHaveBeenCalledWith('dev_1');
  });

  it('opens the scanner from the device list and connects after a valid QR result', async () => {
    await render(<App />);
    await act(async () => {});
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    await act(async () => {
      listMock.mock.calls[0][0].onScanRequest();
    });
    await act(async () => {
      await scannerMock.mock.calls[0][0].onConnect(remoteUrl);
    });

    expect(upsertDevice).toHaveBeenCalledWith(remoteUrl);
    await waitFor(() => expect(remoteShellMock).toHaveBeenCalledWith(
      expect.objectContaining({ remoteUrl }),
      undefined,
    ));
    expect(scannerMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: false }),
      undefined,
    );
  });
});
