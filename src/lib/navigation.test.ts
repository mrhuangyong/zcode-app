import { resolveIntentTargetUrl, resolveNavigationTarget } from './navigation';

describe('navigation target policy', () => {
  it('classifies intent:// escape links by their inner https target', () => {
    const intent =
      'intent://chat.z.ai/auth?response_type=code&client_id=c1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fchat.z.ai%2Fauth;end';

    expect(resolveNavigationTarget(intent)).toBe('auth');
    expect(resolveIntentTargetUrl(intent)).toBe('https://chat.z.ai/auth?response_type=code&client_id=c1');

    const evilIntent =
      'intent://evil.example/login#Intent;scheme=https;package=com.android.chrome;end';
    expect(resolveNavigationTarget(evilIntent)).toBe('system');
    expect(resolveNavigationTarget('intent://bigmodel.cn/login#Intent;scheme=https;end')).toBe('auth');
    expect(resolveNavigationTarget('intent:unknown')).toBe('blocked');
  });
  it('keeps official ZCode documents and browser-internal documents in WebView', () => {
    expect(resolveNavigationTarget('https://zcode.z.ai/remote/v4?sid=1')).toBe('webview');
    expect(resolveNavigationTarget('about:blank')).toBe('webview');
    expect(resolveNavigationTarget('data:text/html,ok')).toBe('webview');
    expect(resolveNavigationTarget('blob:https://zcode.z.ai/session')).toBe('webview');
  });

  it('routes OAuth pages on the auth provider trees to the in-app auth browser', () => {
    expect(resolveNavigationTarget('https://chat.z.ai/api/oauth/authorize?client_id=1')).toBe('auth');
    expect(resolveNavigationTarget('https://bigmodel.cn/login?redirect_uri=x')).toBe('auth');
    expect(resolveNavigationTarget('https://www.bigmodel.cn/login?redirect_uri=x')).toBe('auth');
    expect(resolveNavigationTarget('https://open.bigmodel.cn/oauth')).toBe('auth');
    expect(resolveNavigationTarget('https://www.chat.z.ai/login')).toBe('auth');
  });

  it('keeps look-alike hosts, unrelated z.ai subdomains, and non-HTTPS schemes on the system browser', () => {
    expect(resolveNavigationTarget('https://evil-z.ai/api/oauth/authorize')).toBe('system');
    expect(resolveNavigationTarget('https://z.ai.evil.example/login')).toBe('system');
    expect(resolveNavigationTarget('https://notzcode.z.ai.evil.com/login')).toBe('system');
    expect(resolveNavigationTarget('https://docs.z.ai/legal-agreement/terms-of-use')).toBe('system');
    expect(resolveNavigationTarget('http://chat.z.ai/api/oauth/authorize')).toBe('system');
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
