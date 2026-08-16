import { act, render } from '@testing-library/react-native';
import { Linking } from 'react-native';
import WebView, { type WebViewProps } from 'react-native-webview';
import RemoteShell from './RemoteShell';

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));

jest.mock('react-native-webview', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
const webViewMock = WebView as unknown as jest.Mock;

const remoteUrl =
  'https://zcode.z.ai/remote/v4?sid=session-id&hash=encoded%2Fvalue%3D&t=1&mid=mid&name=Mac.local&app_version=3.7.7';

beforeEach(() => {
  webViewMock.mockClear();
});

describe('RemoteShell', () => {
  it('loads the official remote app with full browser capabilities', async () => {
    await render(<RemoteShell remoteUrl={remoteUrl} />);

    const props = webViewMock.mock.calls[0][0];
    expect(props.source).toEqual({ uri: remoteUrl });
    expect(props.javaScriptEnabled).toBe(true);
    expect(props.domStorageEnabled).toBe(true);
    expect(props.sharedCookiesEnabled).toBe(true);
    expect(props.allowsInlineMediaPlayback).toBe(true);
    expect(props.originWhitelist).toEqual(expect.arrayContaining(['https://zcode.z.ai', 'about:*', 'data:*', 'blob:*']));
    expect(props.applicationNameForUserAgent).toContain('ZCodeMobile');
  });

  it('uses the navigation policy for WebView and external links', async () => {
    await render(<RemoteShell remoteUrl={remoteUrl} />);

    const decide = webViewMock.mock.calls[0][0].onShouldStartLoadWithRequest;

    expect(decide({ url: remoteUrl })).toBe(true);
    expect(decide({ url: 'https://docs.z.ai/legal-agreement/terms-of-use' })).toBe(false);
    expect(decide({ url: 'javascript:alert(1)' })).toBe(false);
  });

  it('hands file downloads to the system browser or download handler', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await act(async () => {});
    openURL.mockClear();
    await render(<RemoteShell remoteUrl={remoteUrl} />);

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
