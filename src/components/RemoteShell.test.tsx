import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewProps } from 'react-native-webview';
import RemoteShell from './RemoteShell';
import AuthBrowserModal from './AuthBrowserModal';

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));

jest.mock('react-native-webview', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock('./AuthBrowserModal', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  return {
    SafeAreaView: jest.fn(({ children }) => <>{children}</>),
  };
});
const webViewMock = WebView as unknown as jest.Mock;
const safeAreaViewMock = SafeAreaView as unknown as jest.Mock;
const authBrowserMock = AuthBrowserModal as unknown as jest.Mock;

const remoteUrl =
  'https://zcode.z.ai/remote/v4?sid=session-id&hash=encoded%2Fvalue%3D&t=1&mid=mid&name=Mac.local&app_version=3.7.7';

function renderShell(overrides: Partial<Parameters<typeof RemoteShell>[0]> = {}) {
  return render(
    <RemoteShell
      remoteUrl={remoteUrl}
      deviceName="Mac.local"
      onExit={jest.fn()}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  webViewMock.mockClear();
  authBrowserMock.mockClear();
});

describe('RemoteShell', () => {
  it('loads the official remote app with full browser capabilities', async () => {
    await renderShell();

    const props = webViewMock.mock.calls[0][0];
    expect(props.source).toEqual({ uri: remoteUrl });
    expect(props.javaScriptEnabled).toBe(true);
    expect(props.domStorageEnabled).toBe(true);
    expect(props.sharedCookiesEnabled).toBe(true);
    expect(props.allowsInlineMediaPlayback).toBe(true);
    expect(props.originWhitelist).toEqual(expect.arrayContaining(['https://zcode.z.ai', 'about:*', 'data:*', 'blob:*']));
  });

  it('keeps WebView content below the system status bar', async () => {
    await renderShell();

    expect(safeAreaViewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        edges: expect.arrayContaining(['top']),
      }),
      undefined,
    );
  });

  it('returns to the device list from the shell header', async () => {
    const onExit = jest.fn();
    await renderShell({ onExit });

    await fireEvent.press(screen.getByTestId('back-to-devices'));

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('shows the active device name in the header', async () => {
    await renderShell({ deviceName: 'Studio Mac' });

    expect(screen.getByText('Studio Mac')).toBeTruthy();
  });

  it('uses the navigation policy for WebView and external links', async () => {
    await renderShell();

    const decide = webViewMock.mock.calls[0][0].onShouldStartLoadWithRequest;

    expect(decide({ url: remoteUrl })).toBe(true);
    expect(decide({ url: 'https://docs.z.ai/legal-agreement/terms-of-use' })).toBe(false);
    expect(decide({ url: 'javascript:alert(1)' })).toBe(false);
  });

  it('opens OAuth authorize URLs in the in-app auth browser instead of the system browser', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderShell();

    const decide = webViewMock.mock.calls[0][0].onShouldStartLoadWithRequest;
    const authorizeUrl = 'https://chat.z.ai/api/oauth/authorize?client_id=1&state=abc';

    expect(decide({ url: authorizeUrl })).toBe(false);
    expect(openURL).not.toHaveBeenCalledWith(authorizeUrl);

    await waitFor(() => expect(authBrowserMock).toHaveBeenCalledWith(
      expect.objectContaining({ visible: true, initialUrl: authorizeUrl }),
      undefined,
    ));
    openURL.mockRestore();
  });

  it('routes target=_blank windows through the navigation policy', async () => {
    await renderShell();

    const props = webViewMock.mock.calls[0][0];
    expect(props.setSupportMultipleWindows).toBe(true);

    await act(async () => {
      props.onOpenWindow({ nativeEvent: { targetUrl: 'https://bigmodel.cn/login?redirect_uri=x' } });
    });

    expect(authBrowserMock).toHaveBeenCalledWith(
      expect.objectContaining({ visible: true, initialUrl: 'https://bigmodel.cn/login?redirect_uri=x' }),
      undefined,
    );

    const lastCall = webViewMock.mock.calls.at(-1)[0];
    expect(lastCall.source).toEqual({ uri: remoteUrl });
  });

  it('shows the browser-login hint only while the page is the sign-in screen', async () => {
    await renderShell();

    expect(screen.queryByTestId('login-hint-banner')).toBeNull();

    const props = webViewMock.mock.calls[0][0];
    await act(async () => {
      props.onNavigationStateChange({ url: remoteUrl, title: 'ZCode - Web Remote Control Sign In', canGoBack: false });
    });

    expect(screen.getByTestId('login-hint-banner')).toBeTruthy();

    await act(async () => {
      props.onNavigationStateChange({ url: remoteUrl, title: 'ZCode - Web Remote Control', canGoBack: true });
    });

    expect(screen.queryByTestId('login-hint-banner')).toBeNull();
  });

  it('hands file downloads to the system browser or download handler', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await act(async () => {});
    openURL.mockClear();
    await renderShell();

    const props = webViewMock.mock.calls[0][0];
    const event = {
      nativeEvent: { downloadUrl: remoteUrl },
    } as Parameters<NonNullable<WebViewProps['onFileDownload']>>[0];

    await act(async () => {
      props.onFileDownload?.(event);
    });

    expect(openURL).toHaveBeenCalledWith(remoteUrl);
    openURL.mockRestore();
  });
});
