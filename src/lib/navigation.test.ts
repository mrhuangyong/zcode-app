import { resolveNavigationTarget } from './navigation';

describe('navigation target policy', () => {
  it('keeps official ZCode documents and browser-internal documents in WebView', () => {
    expect(resolveNavigationTarget('https://zcode.z.ai/remote/v4?sid=1')).toBe('webview');
    expect(resolveNavigationTarget('about:blank')).toBe('webview');
    expect(resolveNavigationTarget('data:text/html,ok')).toBe('webview');
    expect(resolveNavigationTarget('blob:https://zcode.z.ai/session')).toBe('webview');
  });

  it('sends trusted external documents and communication links to the system', () => {
    expect(resolveNavigationTarget('https://docs.z.ai/legal-agreement/terms-of-use')).toBe('system');
    expect(resolveNavigationTarget('http://example.com/help')).toBe('system');
    expect(resolveNavigationTarget('mailto:support@example.com')).toBe('system');
    expect(resolveNavigationTarget('tel:+10000000000')).toBe('system');
  });

  it('blocks script, file, and unknown schemes', () => {
    expect(resolveNavigationTarget('javascript:alert(1)')).toBe('blocked');
    expect(resolveNavigationTarget('file:///etc/passwd')).toBe('blocked');
    expect(resolveNavigationTarget('unknown://payload')).toBe('blocked');
    expect(resolveNavigationTarget('invalid url')).toBe('blocked');
  });
});
