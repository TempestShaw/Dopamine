(() => {
  const debug = new URLSearchParams(location.search).get('analytics_debug') === '1';
  const production = location.hostname === 'tempestshaw.github.io' && location.pathname.startsWith('/Dopamine/');
  if (!production && !debug) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', 'G-D0B389K1E8', {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_path: '/Dopamine/',
    ...(debug ? { debug_mode: true } : {}),
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-D0B389K1E8';
  document.head.appendChild(script);
})();
