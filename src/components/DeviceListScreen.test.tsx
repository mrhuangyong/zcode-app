import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import DeviceListScreen from './DeviceListScreen';
import type { RemoteDevice } from '../lib/secure-remote-store';

jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  return {
    SafeAreaView: jest.fn(({ children }) => <>{children}</>),
  };
});

const remoteUrl =
  'https://zcode.z.ai/remote/v4?sid=session-id&hash=encoded%2Fvalue%3D&t=1&mid=mid&name=Mac.local&app_version=3.7.7';

function makeDevice(overrides: Partial<RemoteDevice> = {}): RemoteDevice {
  return {
    id: 'dev_1',
    url: remoteUrl,
    name: 'Mac.local',
    createdAt: 1723900000000,
    lastConnectedAt: 1723900000000,
    ...overrides,
  };
}

async function renderScreen(devices: RemoteDevice[] = [makeDevice()]) {
  return render(
    <DeviceListScreen
      devices={devices}
      activeDeviceId={null}
      update={null}
      onUpdateDismissed={jest.fn()}
      onConnect={jest.fn()}
      onRenameDevice={jest.fn()}
      onDeleteDevice={jest.fn()}
      onScanRequest={jest.fn()}
    />,
  );
}

afterEach(cleanup);

describe('DeviceListScreen', () => {
  it('renders each device with a redacted URL', async () => {
    await renderScreen();

    expect(screen.getByText('Mac.local')).toBeTruthy();
    expect(screen.getByText(/sid=%5Bredacted%5D/)).toBeTruthy();
  });

  it('shows an empty state when no devices are paired', async () => {
    await renderScreen([]);

    expect(screen.getByText(/还没有设备/)).toBeTruthy();
  });

  it('connects a device when its card is pressed', async () => {
    const onConnect = jest.fn();
    const device = makeDevice();
    await render(
      <DeviceListScreen
        devices={[device]}
        activeDeviceId={null}
        update={null}
        onUpdateDismissed={jest.fn()}
        onConnect={onConnect}
        onRenameDevice={jest.fn()}
        onDeleteDevice={jest.fn()}
        onScanRequest={jest.fn()}
      />,
    );

    await act(async () => {


      fireEvent.press(screen.getByLabelText(`连接设备 ${device.name}`));


    });

    expect(onConnect).toHaveBeenCalledWith(device.url);
  });

  it('renames a device through the menu dialog', async () => {
    const onRenameDevice = jest.fn();
    const device = makeDevice();
    await render(
      <DeviceListScreen
        devices={[device]}
        activeDeviceId={null}
        update={null}
        onUpdateDismissed={jest.fn()}
        onConnect={jest.fn()}
        onRenameDevice={onRenameDevice}
        onDeleteDevice={jest.fn()}
        onScanRequest={jest.fn()}
      />,
    );

    await act(async () => {


      fireEvent.press(screen.getByTestId(`device-menu-${device.id}`));


    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('menu-rename'));
    });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('rename-input'), '主工作站');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('rename-confirm'));
    });

    expect(onRenameDevice).toHaveBeenCalledWith(device.id, '主工作站');
  });

  it('deletes a device after confirmation', async () => {
    const onDeleteDevice = jest.fn();
    const device = makeDevice();
    await render(
      <DeviceListScreen
        devices={[device]}
        activeDeviceId={null}
        update={null}
        onUpdateDismissed={jest.fn()}
        onConnect={jest.fn()}
        onRenameDevice={jest.fn()}
        onDeleteDevice={onDeleteDevice}
        onScanRequest={jest.fn()}
      />,
    );

    await act(async () => {


      fireEvent.press(screen.getByTestId(`device-menu-${device.id}`));


    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('menu-delete'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-confirm'));
    });

    expect(onDeleteDevice).toHaveBeenCalledWith(device.id);
  });

  it('does not delete when the confirmation is cancelled', async () => {
    const onDeleteDevice = jest.fn();
    const device = makeDevice();
    await render(
      <DeviceListScreen
        devices={[device]}
        activeDeviceId={null}
        update={null}
        onUpdateDismissed={jest.fn()}
        onConnect={jest.fn()}
        onRenameDevice={jest.fn()}
        onDeleteDevice={onDeleteDevice}
        onScanRequest={jest.fn()}
      />,
    );

    await act(async () => {


      fireEvent.press(screen.getByTestId(`device-menu-${device.id}`));


    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('menu-delete'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-cancel'));
    });

    expect(onDeleteDevice).not.toHaveBeenCalled();
  });

  it('rejects an invalid pasted URL with an error message', async () => {
    const onConnect = jest.fn();
    await render(
      <DeviceListScreen
        devices={[]}
        activeDeviceId={null}
        update={null}
        onUpdateDismissed={jest.fn()}
        onConnect={onConnect}
        onRenameDevice={jest.fn()}
        onDeleteDevice={jest.fn()}
        onScanRequest={jest.fn()}
      />,
    );

    await act(async () => {


      fireEvent.changeText(screen.getByTestId('remote-url-input'), 'https://evil.example/remote/v4');


    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('connect-button'));
    });

    expect(screen.getByTestId('setup-error')).toBeTruthy();
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('connects a valid pasted URL from the add card', async () => {
    const onConnect = jest.fn();
    await render(
      <DeviceListScreen
        devices={[]}
        activeDeviceId={null}
        update={null}
        onUpdateDismissed={jest.fn()}
        onConnect={onConnect}
        onRenameDevice={jest.fn()}
        onDeleteDevice={jest.fn()}
        onScanRequest={jest.fn()}
      />,
    );

    await act(async () => {


      fireEvent.changeText(screen.getByTestId('remote-url-input'), remoteUrl);


    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('connect-button'));
    });

    expect(onConnect).toHaveBeenCalledWith(remoteUrl);
  });

  it('renders the update banner and opens the download link', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(
      <DeviceListScreen
        devices={[]}
        activeDeviceId={null}
        update={{
          available: true,
          currentVersion: '1.0.0',
          release: {
            version: '1.0.1',
            apkUrl: 'https://github.com/mrhuangyong/zcode-app/releases/download/v1.0.1/zcode-remote-v1.0.1.apk',
            notes: '',
          },
        }}
        onUpdateDismissed={jest.fn()}
        onConnect={jest.fn()}
        onRenameDevice={jest.fn()}
        onDeleteDevice={jest.fn()}
        onScanRequest={jest.fn()}
      />,
    );

    expect(screen.getByTestId('update-banner')).toBeTruthy();
    expect(screen.getByText(/发现新版本 v1\.0\.1/)).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('update-download-button'));
    });

    expect(openURL).toHaveBeenCalledWith(
      'https://github.com/mrhuangyong/zcode-app/releases/download/v1.0.1/zcode-remote-v1.0.1.apk',
    );
    openURL.mockRestore();
  });

  it('dismisses the update banner until the next launch', async () => {
    const onUpdateDismissed = jest.fn();
    await render(
      <DeviceListScreen
        devices={[]}
        activeDeviceId={null}
        update={{
          available: true,
          currentVersion: '1.0.0',
          release: { version: '1.0.1', apkUrl: 'https://example.com/a.apk', notes: '' },
        }}
        onUpdateDismissed={onUpdateDismissed}
        onConnect={jest.fn()}
        onRenameDevice={jest.fn()}
        onDeleteDevice={jest.fn()}
        onScanRequest={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('update-dismiss-button'));
    });

    expect(onUpdateDismissed).toHaveBeenCalledTimes(1);
  });

  it('shows no update banner when the check reports nothing new', async () => {
    await renderScreen();

    expect(screen.queryByTestId('update-banner')).toBeNull();
  });

  it('opens the scanner from the add card', async () => {
    const onScanRequest = jest.fn();
    await render(
      <DeviceListScreen
        devices={[]}
        activeDeviceId={null}
        update={null}
        onUpdateDismissed={jest.fn()}
        onConnect={jest.fn()}
        onRenameDevice={jest.fn()}
        onDeleteDevice={jest.fn()}
        onScanRequest={onScanRequest}
      />,
    );

    await act(async () => {


      fireEvent.press(screen.getByTestId('open-scanner-button'));


    });

    expect(onScanRequest).toHaveBeenCalledTimes(1);
  });
});
