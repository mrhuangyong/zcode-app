import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import WebView from 'react-native-webview';
import AuthBrowserModal from './AuthBrowserModal';

jest.mock('react-native-webview', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const webViewMock = WebView as unknown as jest.Mock;

const authorizeUrl =
  'https://chat.z.ai/api/oauth/authorize?client_id=client_P8X5CMWmlaRO9gyO-KSqtg&state=abc';

function webViewProps() {
  return webViewMock.mock.calls[webViewMock.mock.calls.length - 1][0];
}

beforeEach(() => {
  webViewMock.mockClear();
});

describe('AuthBrowserModal', () => {
  it('loads the authorize URL in its own WebView', async () => {
    await render(
      <AuthBrowserModal visible initialUrl={authorizeUrl} onClose={jest.fn()} />,
    );

    expect(webViewProps().source).toEqual({ uri: authorizeUrl });
    expect(webViewProps().javaScriptEnabled).toBe(true);
    expect(webViewProps().sharedCookiesEnabled).toBe(true);
    expect(screen.getByTestId('auth-close-button')).toBeTruthy();
  });

  it('renders nothing without an initial URL', async () => {
    await render(<AuthBrowserModal visible initialUrl={null} onClose={jest.fn()} />);

    expect(webViewMock).not.toHaveBeenCalled();
  });

  it('allows only zcode and auth hosts inside the overlay', async () => {
    await render(
      <AuthBrowserModal visible initialUrl={authorizeUrl} onClose={jest.fn()} />,
    );

    const decide = webViewProps().onShouldStartLoadWithRequest;

    expect(decide({ url: authorizeUrl })).toBe(true);
    expect(decide({ url: 'https://zcode.z.ai/oauth/callback?code=1' })).toBe(true);
    expect(decide({ url: 'https://bigmodel.cn/login?x=1' })).toBe(true);
    expect(decide({ url: 'https://www.bigmodel.cn/login?x=1' })).toBe(true);
    expect(decide({ url: 'https://evil.example/phish' })).toBe(false);
    expect(decide({ url: 'javascript:alert(1)' })).toBe(false);
  });

  it('keeps auth and zcode popups inside the overlay and hands others to the system', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(
      <AuthBrowserModal visible initialUrl={authorizeUrl} onClose={jest.fn()} />,
    );

    const props = webViewProps();
    expect(props.setSupportMultipleWindows).toBe(true);

    await act(async () => {
      props.onOpenWindow({ nativeEvent: { targetUrl: 'https://open.bigmodel.cn/oauth/next' } });
    });
    await act(async () => {
      props.onOpenWindow({ nativeEvent: { targetUrl: 'https://docs.z.ai/legal/terms' } });
    });

    expect(webViewProps().source).toEqual({ uri: 'https://open.bigmodel.cn/oauth/next' });
    expect(openURL).toHaveBeenCalledWith('https://docs.z.ai/legal/terms');
    openURL.mockRestore();
  });

  it('hands non-auth external documents to the system browser', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(
      <AuthBrowserModal visible initialUrl={authorizeUrl} onClose={jest.fn()} />,
    );

    const decide = webViewProps().onShouldStartLoadWithRequest;
    await act(async () => {
      decide({ url: 'https://docs.z.ai/legal-agreement/terms-of-use' });
    });

    expect(openURL).toHaveBeenCalledWith('https://docs.z.ai/legal-agreement/terms-of-use');
    openURL.mockRestore();
  });

  it('closes automatically shortly after landing on the zcode callback', async () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    await render(
      <AuthBrowserModal visible initialUrl={authorizeUrl} onClose={onClose} />,
    );

    await act(async () => {
      webViewProps().onNavigationStateChange({ url: 'https://zcode.z.ai/oauth/callback?code=1' });
    });

    expect(screen.getByText('登录完成 ✓ 正在返回…')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1600);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('closes manually via the close button', async () => {
    const onClose = jest.fn();
    await render(
      <AuthBrowserModal visible initialUrl={authorizeUrl} onClose={onClose} />,
    );

    await fireEvent.press(screen.getByTestId('auth-close-button'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
