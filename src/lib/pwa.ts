/**
 * Service-worker registration.
 *
 * Kept out of the dev server: a worker caching a hot-reloaded build serves
 * stale files and makes changes look like they never happened.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  // A worker that never yields pins the shop to the build it was installed
  // with: a fix can be deployed and simply never arrive. So we check for a new
  // worker on every load, and reload once as soon as one takes control.
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => registration.update())
      .catch((err) => console.warn('Service worker registration failed:', err));
  });
}

/** Whether the app is running as an installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari predates the display-mode media query.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** iOS offers no install prompt API, so it needs written instructions instead. */
export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}
