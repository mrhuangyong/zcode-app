jest.mock('expo-status-bar', () => ({
  StatusBar: jest.fn(() => null),
}));

jest.mock('./src/lib/secure-remote-store', () => ({
  clearRemoteUrl: jest.fn(async () => true),
  loadRemoteUrl: jest.fn(async () => null),
  saveRemoteUrl: jest.fn(async () => true),
}));

jest.mock('./src/components/QRScannerScreen', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock('./src/components/RemoteShell', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock('./src/components/SetupScreen', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

import { act, render, waitFor } from '@testing-library/react-native';
import { Linking, type EmitterSubscription } from 'react-native';
import App from './App';
import RemoteShell from './src/components/RemoteShell';
import SetupScreen from './src/components/SetupScreen';
import QRScannerScreen from './src/components/QRScannerScreen';
import { clearRemoteUrl, loadRemoteUrl, saveRemoteUrl } from './src/lib/secure-remote-store';

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

const remoteShellMock = RemoteShell as unknown as jest.Mock;
const setupMock = SetupScreen as unknown as jest.Mock;
const scannerMock = QRScannerScreen as unknown as jest.Mock;

beforeEach(() => {
  remoteShellMock.mockClear();
  setupMock.mockClear();
  scannerMock.mockClear();
  (loadRemoteUrl as jest.Mock).mockReset().mockResolvedValue(null);
  (saveRemoteUrl as jest.Mock).mockReset().mockResolvedValue(true);
  (clearRemoteUrl as jest.Mock).mockReset().mockResolvedValue(true);
  (Linking.getInitialURL as jest.Mock).mockReset().mockResolvedValue(null);
  (Linking.addEventListener as jest.Mock).mockClear();
});

describe('App startup and connection state', () => {
  it('restores a safe stored remote URL directly into the shell', async () => {
    (loadRemoteUrl as jest.Mock).mockResolvedValue(remoteUrl);

    await render(<App />);
    await act(async () => {});
    expect(loadRemoteUrl).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(remoteShellMock).toHaveBeenCalledWith(
      expect.objectContaining({ remoteUrl }),
      undefined,
    ));
    expect(loadRemoteUrl).toHaveBeenCalledTimes(1);
    expect(setupMock).not.toHaveBeenCalled();
  });

  it('shows setup when no safe URL is stored', async () => {
    await render(<App />);
    await act(async () => {});

    await waitFor(() => expect(setupMock).toHaveBeenCalledWith(
      expect.objectContaining({ onConnect: expect.any(Function) }),
      undefined,
    ));
    expect(remoteShellMock).not.toHaveBeenCalled();
  });

  it('persists a manual connection and opens the shell', async () => {
    await render(<App />);
    await act(async () => {});
    await waitFor(() => expect(setupMock).toHaveBeenCalled());

    await act(async () => {
      await setupMock.mock.calls[0][0].onConnect(remoteUrl);
    });

    expect(saveRemoteUrl).toHaveBeenCalledWith(remoteUrl);
    await waitFor(() => expect(remoteShellMock).toHaveBeenCalledWith(
      expect.objectContaining({ remoteUrl }),
      undefined,
    ));
  });

  it('accepts a safe connect deep link while the app is running', async () => {
    await render(<App />);
    await act(async () => {});
    await waitFor(() => expect(setupMock).toHaveBeenCalled());
    const listener = (Linking.addEventListener as jest.Mock).mock.calls[0][1];

    await act(async () => {
      listener({ url: deepLink });
    });

    await waitFor(() => expect(saveRemoteUrl).toHaveBeenCalledWith(remoteUrl));
    await waitFor(() => expect(remoteShellMock).toHaveBeenCalledWith(
      expect.objectContaining({ remoteUrl }),
      undefined,
    ));
  });

  it('opens the scanner from setup', async () => {
    await render(<App />);
    await act(async () => {});
    await waitFor(() => expect(setupMock).toHaveBeenCalled());

    await act(async () => {
      setupMock.mock.calls[0][0].onScanRequest();
    });

    expect(scannerMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: true }),
      undefined,
    );
  });

  it('connects and closes the scanner after a valid QR result', async () => {
    await render(<App />);
    await act(async () => {});
    await waitFor(() => expect(setupMock).toHaveBeenCalled());

    await act(async () => {
      setupMock.mock.calls[0][0].onScanRequest();
    });
    await act(async () => {
      await scannerMock.mock.calls[0][0].onConnect(remoteUrl);
    });

    expect(saveRemoteUrl).toHaveBeenCalledWith(remoteUrl);
    await waitFor(() => expect(remoteShellMock).toHaveBeenCalledWith(
      expect.objectContaining({ remoteUrl }),
      undefined,
    ));
    expect(scannerMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: false }),
      undefined,
    );
  });

  it('opens the same scanner from the connected shell', async () => {
    (loadRemoteUrl as jest.Mock).mockResolvedValue(remoteUrl);
    await render(<App />);
    await act(async () => {});
    await waitFor(() => expect(remoteShellMock).toHaveBeenCalled());

    await act(async () => {
      remoteShellMock.mock.calls[0][0].onScanRequest();
    });

    expect(scannerMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: true }),
      undefined,
    );
  });

  it('closes the scanner without changing the active connection', async () => {
    (loadRemoteUrl as jest.Mock).mockResolvedValue(remoteUrl);
    await render(<App />);
    await act(async () => {});
    await waitFor(() => expect(remoteShellMock).toHaveBeenCalled());

    await act(async () => {
      remoteShellMock.mock.calls[0][0].onScanRequest();
    });
    await act(async () => {
      scannerMock.mock.calls.at(-1)?.[0].onClose();
    });

    expect(scannerMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: false }),
      undefined,
    );
    expect(saveRemoteUrl).not.toHaveBeenCalled();
  });

  it('returns to setup from the shell and clears stored credentials', async () => {
    (loadRemoteUrl as jest.Mock).mockResolvedValue(remoteUrl);
    await render(<App />);
    await act(async () => {});
    await waitFor(() => expect(remoteShellMock).toHaveBeenCalled());

    await act(async () => {
      await remoteShellMock.mock.calls[0][0].onSetup();
    });

    expect(clearRemoteUrl).toHaveBeenCalledTimes(1);
    expect(setupMock).toHaveBeenCalledWith(
      expect.objectContaining({ onConnect: expect.any(Function) }),
      undefined,
    );
  });
});
