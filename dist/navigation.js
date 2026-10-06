// Keep the audio element connected while changing guest-page content.
(() => {
  if (!document.querySelector('.song-player') || location.protocol === 'file:') return;
  const folder = new URL('.', location.href);
  const guestPages = new Set(['', 'index', 'index.html', 'wedding-party', 'wedding-party.html', 'rsvp', 'rsvp.html']);
  const pageKey = url => url.pathname.replace(/(?:index)?\.html$/, '').replace(/\/index$/, '/');
  let current = new URL(location.href), pending;
  function allowed(url) {
    return url.origin === location.origin && url.pathname.startsWith(folder.pathname) && guestPages.has(url.pathname.slice(folder.pathname.length));
  }
  function position(url) {
    let target;
    try { target = url.hash ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null; } catch {}
    if (target) target.scrollIntoView({behavior:'instant'});
    else window.scrollTo({top:0,behavior:'instant'});
  }
  async function navigate(url, push) {
    pending?.abort(); const controller = new AbortController(); pending = controller;
    try {
      const response = await fetch(url.pathname + url.search, {signal:controller.signal});
      if (!response.ok) throw new Error('Page unavailable');
      const next = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (!next.querySelector('main') || !next.querySelector('.song-player')) throw new Error('Not a guest page');
      if (controller.signal.aborted) return;
      const player = document.querySelector('.song-player');
      // Never replace or reinsert player: detaching audio can interrupt playback.
      window.disposeWeddingPage?.();
      if (push) history.pushState(null, '', url.href);
      document.title = next.title;
      document.body.className = next.body.className;
      for (const child of [...document.body.childNodes]) if (child !== player) child.remove();
      for (const child of [...next.body.children]) {
        if (child.matches('script, .song-player')) continue;
        child.querySelectorAll('script').forEach(script => script.remove());
        document.body.insertBefore(document.importNode(child, true), player);
      }
      window.initializeWeddingPage();
      window.initializeWeddingRSVP();
      current = new URL(location.href);
      const main = document.querySelector('main'); main.tabIndex = -1; main.focus({preventScroll:true});
      position(url);
    } catch (error) {
      if (error.name !== 'AbortError') {
        // Normal navigation remains a recovery path if fetching a page fails.
        location.assign(url.href);
      }
    }
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href);
    if (!allowed(url)) return;
    if (pageKey(url) === pageKey(current) && url.search === current.search && !url.hash.startsWith('#invite=')) return;
    event.preventDefault(); navigate(url, true);
  });
  window.addEventListener('popstate', () => {
    const url = new URL(location.href);
    if (!allowed(url)) { location.reload(); return; }
    if (pageKey(url) === pageKey(current) && url.search === current.search) { pending?.abort(); position(url); return; }
    navigate(url, false);
  });
})();
