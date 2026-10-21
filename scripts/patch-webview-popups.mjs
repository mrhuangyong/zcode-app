// ZCodeRemote 补丁：把导航策略下沉到原生层。
// 背景：RN 0.86（Fabric/bridgeless）+ react-native-webview 13.16 上，
// onShouldStartLoadWithRequest 的同步锁事件无法送达 JS（静默丢失），JS 层导航拦截完全失效。
// 远控页登录页会把 OAuth 授权页用 intent:// 强行送进系统浏览器，而 OAuth 的 CSRF state
// 存在主 WebView 的存储上下文——授权页必须在应用内完成，否则必然 "OAuth CSRF 检测失败"。
//
// 原生策略（zcodeHandleNavigation）：
//   zcode.z.ai / about: / data: / blob:            → 在本 WebView 加载
//   z.ai / bigmodel.cn 及其子域（含 intent 内层）    → 在主 WebView 加载（登录留在应用内）
//   其余 http(s)                                    → 系统浏览器
//   其余 scheme（javascript:/intent 无法解析等）      → 阻断
//
// 幂等：带 ZCODE_REMOTE_PATCH 标记时跳过。npm ci 会还原 node_modules，
// CI 在 npm ci 之后、gradle 之前运行；本地重装依赖后同样需要重跑。

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webviewDir = join(
  root,
  'node_modules',
  'react-native-webview',
  'android',
  'src',
  'main',
  'java',
  'com',
  'reactnativecommunity',
  'webview',
);

const chromeClientFile = join(webviewDir, 'RNCWebChromeClient.java');
const webViewClientFile = join(webviewDir, 'RNCWebViewClient.java');

for (const file of [chromeClientFile, webViewClientFile]) {
  if (!existsSync(file)) {
    console.error(`patch target missing: ${file}`);
    process.exit(1);
  }
}

const NAVIGATION_HELPER = `
    // ZCODE_REMOTE_PATCH: native navigation policy. The JS
    // onShouldStartLoadWithRequest lock is silently broken on Fabric (RN 0.86),
    // so the policy lives here: keep zcode + OAuth login pages inside this
    // WebView's storage context, hand other http(s) to the system browser,
    // block everything else (including intent:// Chrome escapes).
    public static boolean zcodeHandleNavigation(WebView view, String url) {
        try {
            android.net.Uri u = android.net.Uri.parse(url);
            String scheme = u.getScheme() == null ? "" : u.getScheme();
            String host = u.getHost() == null ? "" : u.getHost();

            if (scheme.equals("intent")) {
                String rest = url.substring("intent:".length());
                int hash = rest.indexOf("#Intent;");
                if (hash < 0) {
                    return true;
                }
                String body = rest.substring(0, hash);
                while (body.startsWith("/")) {
                    body = body.substring(1);
                }
                String options = rest.substring(hash + 8).replace(';', '&');
                String innerScheme = android.net.Uri.parse("?" + options).getQueryParameter("scheme");
                if (innerScheme == null) {
                    return true;
                }
                String inner = innerScheme.endsWith(":")
                        ? innerScheme + "//" + body
                        : innerScheme + "://" + body;
                android.net.Uri innerUri = android.net.Uri.parse(inner);
                String innerHost = innerUri.getHost() == null ? "" : innerUri.getHost();
                if (isZcodeOrAuthHost(innerUri)) {
                    final String target = inner;
                    view.post(() -> view.loadUrl(target));
                }
                return true;
            }

            if (scheme.equals("about") || scheme.equals("data") || scheme.equals("blob")) {
                return false;
            }

            if (scheme.equals("https") && host.equals("zcode.z.ai")) {
                return false;
            }

            if (scheme.equals("https") && isZcodeOrAuthHost(u)) {
                return false;
            }

            if (scheme.equals("http") || scheme.equals("https")) {
                final String target = url;
                view.post(() -> {
                    try {
                        android.content.Intent external = new android.content.Intent(
                                android.content.Intent.ACTION_VIEW, android.net.Uri.parse(target));
                        view.getContext().startActivity(external);
                    } catch (Exception ignored) {
                    }
                });
                return true;
            }

            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean isZcodeOrAuthHost(android.net.Uri u) {
        String host = u.getHost() == null ? "" : u.getHost();
        String[] roots = {"z.ai", "bigmodel.cn"};
        for (String rootHost : roots) {
            if (host.equals(rootHost) || host.endsWith("." + rootHost)) {
                return true;
            }
        }
        return false;
    }
`;

// ---- RNCWebChromeClient：popup 子 WebView 也套用原生策略 + 注入 helper ----
let chromeSource = readFileSync(chromeClientFile, 'utf8');

chromeSource = chromeSource
  .split('\n')
  .filter((line) => !line.includes('ZCODE_REMOTE_PATCH') && !line.includes('ZCODE_PATCH_LOG'))
  .join('\n');

const popupClientOriginal = `        final WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
        transport.setWebView(newWebView);
        resultMsg.sendToTarget();`;

const popupClientPatched = `        final WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
        // ZCODE_REMOTE_PATCH: popups follow the same native navigation policy so
        // OAuth popups stay inside the app's storage context.
        final WebView popupWebView = new WebView(view.getContext());
        popupWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView popupView, String popupUrl) {
                return zcodeHandleNavigation(view, popupUrl);
            }
        });
        transport.setWebView(popupWebView);
        resultMsg.sendToTarget();`;

if (!chromeSource.includes(popupClientOriginal)) {
  console.error('unexpected RNCWebChromeClient.java template; patch not applied');
  process.exit(1);
}

chromeSource = chromeSource.replace(popupClientOriginal, popupClientPatched);

const chromeClassMarker = 'public class RNCWebChromeClient extends WebChromeClient implements LifecycleEventListener {';
if (!chromeSource.includes('static boolean zcodeHandleNavigation')) {
  chromeSource = chromeSource.replace(
    chromeClassMarker,
    `${chromeClassMarker}\n${NAVIGATION_HELPER}`,
  );
}

writeFileSync(chromeClientFile, chromeSource);

// ---- RNCWebViewClient：主 WebView 在 JS 分发之前先走原生策略 ----
let clientSource = readFileSync(webViewClientFile, 'utf8');

clientSource = clientSource
  .split('\n')
  .filter((line) => !line.includes('ZCODE_REMOTE_PATCH') && !line.includes('ZCODE_PATCH_LOG'))
  .join('\n');

const mainOriginal = `    public boolean shouldOverrideUrlLoading(WebView view, String url) {
`;

const mainPatched = `    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        // ZCODE_REMOTE_PATCH: native policy first (see RNCWebChromeClient).
        // Returning true here blocks the load before the (Fabric-broken) JS lock runs.
        if (com.reactnativecommunity.webview.RNCWebChromeClient.zcodeHandleNavigation(view, url)) {
            return true;
        }
`;

if (!clientSource.includes(mainOriginal)) {
  console.error('unexpected RNCWebViewClient.java template; patch not applied');
  process.exit(1);
}

if (!clientSource.includes('zcodeHandleNavigation(view, url)')) {
  clientSource = clientSource.replace(mainOriginal, mainPatched);
}

writeFileSync(webViewClientFile, clientSource);

console.log('webview navigation policy patched (chrome client + webview client)');
