(() => {
  const badge = document.querySelector('[data-page-counter]');
  if (!badge) return;
  const page = badge.dataset.pageCounter;
  const knownPages = new Set(['home', 'tools', 'keyboard-builder', 'links', 'updates', 'aniimo-counter']);
  if (!knownPages.has(page)) return;

  function countVisit() {
    // A fresh image request records this page view and returns the shared total.
    // The unique query value prevents a browser cache from hiding a reload.
    badge.hidden = false;
    badge.src = `https://hits.sh/ubereats6.github.io/${page}.svg?label=${encodeURIComponent('瀏覽次數')}&color=1b8cff&labelColor=0b1c35&v=${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  badge.addEventListener('error', () => { badge.hidden = true; });
  countVisit();
  window.addEventListener('pageshow', event => {
    if (event.persisted) countVisit();
  });
})();
