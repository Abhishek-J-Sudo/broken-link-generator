/**
 * Client-side-rendering (CSR) detection.
 *
 * Decides whether a page builds its content with JavaScript instead of
 * shipping it as server-rendered HTML. Anchors are counted as real `<a href>`
 * tags — a bare `href=` match also hits stylesheets and favicons, which every
 * CSR shell has, so it can never be used to prove "this page has links".
 */

export function detectJsRendering(html) {
  const frameworks = {
    react: /data-reactroot|react-dom[\w.-]*\.js|__REACT_DEVTOOLS/.test(html),
    next: /id=["']__next["']|\/_next\/|__NEXT_DATA__/.test(html),
    vue: /\sdata-v-[0-9a-f]{6,}|__VUE__|\bvue(?:\.runtime)?(?:\.global)?(?:\.prod)?(?:\.min)?\.js/.test(
      html
    ),
    nuxt: /__NUXT__|id=["']__nuxt["']/.test(html),
    angular: /\sng-version=|<app-root/i.test(html),
    svelte: /__SVELTE|\bsvelte-[0-9a-z]{4,}\b/.test(html),
    gatsby: /id=["']___gatsby["']/.test(html),
  };

  // SSR fills the mount node before sending; CSR ships it empty. An empty
  // (or noscript-only) app container is the strongest single signal.
  const hasEmptyAppShell =
    /<div[^>]*\bid=["'](?:root|app|__next|__nuxt|___gatsby)["'][^>]*>\s*(?:<\/div>|<noscript)/i.test(
      html
    );

  const anchorCount = (html.match(/<a\s[^>]*\bhref\s*=/gi) || []).length;
  const hasScripts = /<script[\s>]/i.test(html);
  const frameworkDetected = Object.values(frameworks).some(Boolean);

  // Framework markers alone must not trigger — SSR Next/Nuxt sites carry them
  // too. It takes an empty shell, or a framework with a near-empty link graph.
  const isJavaScriptHeavy =
    hasEmptyAppShell ||
    (frameworkDetected && anchorCount < 10) ||
    (hasScripts && anchorCount < 3);

  return {
    frameworks,
    frameworkDetected,
    hasEmptyAppShell,
    anchorCount,
    hasScripts,
    isJavaScriptHeavy,
  };
}
