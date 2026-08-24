import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import QRScannerScreen from './QRScannerScreen';
import { decodeQrFromImage } from '../lib/qr-image';

jest.mock('expo-camera', () => ({
  CameraView: jest.fn(() => null),
  useCameraPermissions: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('../lib/qr-image', () => ({
  decodeQrFromImage: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  return {
    SafeAreaView: jest.fn(({ children }) => <>{children}</>),
  };
});

const cameraViewMock = CameraView as unknown as jest.Mock;
const permissionHookMock = useCameraPermissions as unknown as jest.Mock;
const launchImageLibraryAsyncMock = ImagePicker.launchImageLibraryAsync as unknown as jest.Mock;
const decodeQrFromImageMock = decodeQrFromImage as unknown as jest.Mock;

const remoteUrl =
  'https://zcode.z.ai/remote/v4?sid=scan-session&hash=scan-proof&t=1234567890&mid=scan-device&name=Desktop.local&app_version=1.0.0';

function mockPermission(granted: boolean, canAskAgain = true) {
  const requestPermission = jest.fn(async () => ({ granted: true, canAskAgain: true }));
  permissionHookMock.mockReturnValue([
    {
      granted,
      canAskAgain,
      status: granted ? 'granted' : 'denied',
      expires: 'never',
      privileged: false,
    },
    requestPermission,
  ]);
  return requestPermission;
}

function cameraProps() {
  return cameraViewMock.mock.calls[cameraViewMock.mock.calls.length - 1][0];
}

beforeEach(() => {
  cameraViewMock.mockClear();
  permissionHookMock.mockReset();
  launchImageLibraryAsyncMock.mockReset().mockResolvedValue({ canceled: true, assets: [] });
  decodeQrFromImageMock.mockReset().mockResolvedValue(null);
});

describe('QRScannerScreen', () => {
  it('shows the camera and QR-only scanning settings after permission is granted', async () => {
    mockPermission(true);
    await render(<QRScannerScreen visible onClose={jest.fn()} onConnect={jest.fn()} />);

    expect(cameraViewMock).toHaveBeenCalledTimes(1);
    expect(cameraProps().barcodeScannerSettings).toEqual({ barcodeTypes: ['qr'] });

    await fireEvent.press(screen.getByTestId('close-scanner-button'));
  });

  it('connects once for an official QR URL', async () => {
    mockPermission(true);
    const onConnect = jest.fn(async () => undefined);
    await render(<QRScannerScreen visible onClose={jest.fn()} onConnect={onConnect} />);

    await act(async () => {
      cameraProps().onBarcodeScanned({ data: remoteUrl });
    });
    await act(async () => {
      cameraProps().onBarcodeScanned({ data: remoteUrl });
    });

    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith(remoteUrl);
  });

  it('accepts an encoded app deep-link QR', async () => {
    mockPermission(true);
    const onConnect = jest.fn(async () => undefined);
    await render(<QRScannerScreen visible onClose={jest.fn()} onConnect={onConnect} />);

    const payload = `zcode-mobile://connect?url=${encodeURIComponent(remoteUrl)}`;
    await act(async () => {
      cameraProps().onBarcodeScanned({ data: payload });
    });

    expect(onConnect).toHaveBeenCalledWith(remoteUrl);
  });

  it('rejects unsafe QR payloads without connecting', async () => {
    mockPermission(true);
    const onConnect = jest.fn();
    await render(<QRScannerScreen visible onClose={jest.fn()} onConnect={onConnect} />);

    expect(screen.queryByTestId('scanner-error')).toBeNull();
    await act(async () => {
      cameraProps().onBarcodeScanned({ data: 'https://evil.example/remote/v4' });
    });

    expect(screen.getByTestId('scanner-error')).toBeTruthy();
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('offers permission recovery when camera access is denied', async () => {
    const requestPermission = mockPermission(false);
    await render(<QRScannerScreen visible onClose={jest.fn()} onConnect={jest.fn()} />);

    expect(screen.getByTestId('camera-permission-denied')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('request-camera-button'));
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('does not mount a camera when hidden', async () => {
    mockPermission(true);
    await render(<QRScannerScreen visible={false} onClose={jest.fn()} onConnect={jest.fn()} />);

    expect(screen.queryByTestId('close-scanner-button')).toBeNull();
    expect(cameraViewMock).not.toHaveBeenCalled();
  });

  it('renders the alignment frame and gallery entry below the camera area', async () => {
    mockPermission(true);
    await render(<QRScannerScreen visible onClose={jest.fn()} onConnect={jest.fn()} />);

    expect(screen.getByTestId('scan-frame')).toBeTruthy();
    expect(screen.getByTestId('pick-from-gallery-button')).toBeTruthy();
    expect(screen.getByText('将二维码对准取景框')).toBeTruthy();
  });

  it('connects from a QR code decoded out of a picked gallery image', async () => {
    mockPermission(true);
    const onConnect = jest.fn(async () => undefined);
    launchImageLibraryAsyncMock.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/qr.png' }],
    });
    decodeQrFromImageMock.mockResolvedValue(remoteUrl);
    await render(<QRScannerScreen visible onClose={jest.fn()} onConnect={onConnect} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('pick-from-gallery-button'));
    });

    expect(launchImageLibraryAsyncMock).toHaveBeenCalledTimes(1);
    expect(decodeQrFromImageMock).toHaveBeenCalledWith('file:///tmp/qr.png');
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith(remoteUrl);
  });

  it('does nothing when the gallery picker is cancelled', async () => {
    mockPermission(true);
    const onConnect = jest.fn();
    launchImageLibraryAsyncMock.mockResolvedValue({ canceled: true, assets: [] });
    await render(<QRScannerScreen visible onClose={jest.fn()} onConnect={onConnect} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('pick-from-gallery-button'));
    });

    expect(decodeQrFromImageMock).not.toHaveBeenCalled();
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('shows an error when the picked image has no QR code', async () => {
    mockPermission(true);
    const onConnect = jest.fn();
    launchImageLibraryAsyncMock.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/plain.png' }],
    });
    decodeQrFromImageMock.mockResolvedValue(null);
    await render(<QRScannerScreen visible onClose={jest.fn()} onConnect={onConnect} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('pick-from-gallery-button'));
    });

    expect(screen.getByTestId('scanner-error')).toBeTruthy();
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('rejects a decoded but unsafe URL from a gallery image', async () => {
    mockPermission(true);
    const onConnect = jest.fn();
    launchImageLibraryAsyncMock.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/evil.png' }],
    });
    decodeQrFromImageMock.mockResolvedValue('https://evil.example/remote/v4?sid=1');
    await render(<QRScannerScreen visible onClose={jest.fn()} onConnect={onConnect} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('pick-from-gallery-button'));
    });

    expect(screen.getByTestId('scanner-error')).toBeTruthy();
    expect(onConnect).not.toHaveBeenCalled();
  });
});
