// Lightweight privacy-first analytics: stores pageview counts in localStorage
(function () {
  try {
    const key = 'odoe_pageviews';
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    const path = location.pathname || '/';
    data[path] = (data[path] || 0) + 1;
    localStorage.setItem(key, JSON.stringify(data));
      // Optional: try to send to server-side analytics if available (privacy-preserving)
      try {
        // use sendBeacon when possible for fire-and-forget
        const payload = JSON.stringify({ path, ts: Date.now() });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/analytics', payload);
        } else {
          fetch('/api/analytics', { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
        }
      } catch (e) {
        // no-op; do not leak errors
      }
    // console-friendly summary
    // eslint-disable-next-line no-console
    console.debug('Analytics: pageview recorded', path);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Analytics suppressed', e);
  }
})();
