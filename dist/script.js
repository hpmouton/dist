window.initializeWeddingPage = () => {
  window.disposeWeddingPage?.();
  const lifecycle = new AbortController();
  const {signal} = lifecycle;
  const timers = [], observers = [];
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

// A compact, keyboard-accessible menu on phones and smaller screens.
const menuButton = document.querySelector('.menu-button');
const siteNavigation = document.getElementById('site-navigation');
if (menuButton && siteNavigation) {
  const smallScreen = window.matchMedia('(max-width: 980px)');
  const closeMenu = (returnFocus = false) => {
    siteNavigation.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.querySelector('.menu-label').textContent = 'Menu';
    if (returnFocus) menuButton.focus();
  };
  const updateMenu = () => {
    closeMenu();
    menuButton.hidden = !smallScreen.matches;
  };
  document.documentElement.classList.add('js-menu');
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.querySelector('.menu-label').textContent = open ? 'Close' : 'Menu';
    siteNavigation.classList.toggle('is-open', open);
  });
  siteNavigation.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') closeMenu(true);
  }, {signal});
  document.addEventListener('click', event => {
    if (!event.target.closest('.header')) closeMenu();
  }, {signal});
  smallScreen.addEventListener('change', updateMenu, {signal});
  updateMenu();
}

// Count down to the start of holy matrimony at 14:45, Namibia time.
const weddingDate = new Date('2026-12-11T14:45:00+02:00').getTime();
function updateCountdown() {
  const remaining = Math.max(0, weddingDate - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  const values = { days: Math.floor(totalSeconds / 86400), hours: Math.floor(totalSeconds / 3600) % 24, minutes: Math.floor(totalSeconds / 60) % 60, seconds: totalSeconds % 60 };
  for (const [id, value] of Object.entries(values)) {
    const element = document.getElementById(id);
    const next = String(value).padStart(2, '0');
    if (element && element.textContent !== next) {
      const initial = element.textContent === '—';
      element.textContent = next;
      if (!initial && id !== 'seconds' && !motionPreference.matches) {
        element.classList.remove('tick');
        requestAnimationFrame(() => element.classList.add('tick'));
      }
    }
  }
  if (remaining === 0) {
    const now = Date.now();
    document.getElementById('countdown-message').textContent = now < new Date('2026-12-12T00:00:00+02:00').getTime() ? 'Today is the day. Let’s celebrate!' : 'Our forever began on 11 December 2026.';
  }
}
if (document.getElementById('days')) {
  updateCountdown();
  timers.push(setInterval(updateCountdown, 1000));
}
document.querySelector('.closing-monogram')?.classList.add('reveal');
document.querySelectorAll('.attendants-grid, .couple-grid, .detail-grid, .attire-examples, .attire-guidance').forEach(group => {
  [...group.children].forEach((element, index) => element.style.setProperty('--reveal-delay', `${(index % 3) * 90}ms`));
});
let revealObserver;
function setupReveals() {
  revealObserver?.disconnect();
  if (motionPreference.matches || !('IntersectionObserver' in window)) {
    document.documentElement.classList.remove('js-motion');
    document.querySelectorAll('.reveal').forEach(element => element.classList.add('visible'));
    return;
  }
  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {threshold: 0.06});
  document.querySelectorAll('.reveal:not(.visible)').forEach(element => revealObserver.observe(element));
  document.documentElement.classList.add('js-motion');
}
motionPreference.addEventListener('change', setupReveals, {signal});
setupReveals();

// Scripture is readable in full without JavaScript, and selectable with it.
const verses = [...document.querySelectorAll('.verse')];
const verseButtons = [...document.querySelectorAll('[data-verse]')];
if (verses.length && verseButtons.length) {
  const selectVerse = index => {
    verses.forEach((verse, i) => {
      verse.hidden = i !== index;
      verse.classList.toggle('entering', i === index);
    });
    verseButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  };
  document.querySelector('.verse-buttons').hidden = false;
  document.querySelector('.verse-stage').classList.add('is-interactive');
  verseButtons.forEach(button => button.addEventListener('click', () => selectVerse(Number(button.dataset.verse))));
  selectVerse(0);
}

// A quiet progress line and current-section indicator make long-page navigation easier.
const progress = document.querySelector('.reading-progress');
let scrollScheduled = false;
function updateProgress() {
  const distance = document.documentElement.scrollHeight - innerHeight;
  if (progress) progress.style.transform = `scaleX(${distance > 0 ? Math.min(1, Math.max(0, scrollY / distance)) : 0})`;
  document.querySelector('.header')?.classList.toggle('is-scrolled', scrollY > 20);
  scrollScheduled = false;
}
window.addEventListener('scroll', () => {
  if (!scrollScheduled) { scrollScheduled = true; requestAnimationFrame(updateProgress); }
}, { passive: true, signal });
window.addEventListener('resize', updateProgress, {signal});
window.addEventListener('load', updateProgress, {signal});
updateProgress();
if ('IntersectionObserver' in window) {
  const navigation = [...document.querySelectorAll('.header nav a[href^="#"]')];
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) navigation.forEach(link => {
        if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });
  observers.push(sectionObserver);
  navigation.forEach(link => {
    const section = document.querySelector(link.hash);
    if (section) sectionObserver.observe(section);
  });
}

const journeyMap = document.getElementById('journey-map');
if (journeyMap) {
  const mapViews = {
    route: { src: 'https://maps.google.com/maps?saddr=Windhoek%2C%20Namibia&daddr=Eden%20Self%20Catering%20Chalets%2C%20Kappsfarm%2C%20Namibia&output=embed', label: 'Driving route from Windhoek', title: 'Google Maps driving route from Windhoek to Eden Self Catering Chalets at Kappsfarm' },
    venue: { src: 'https://maps.google.com/maps?q=Eden%20Self%20Catering%20Chalets%2C%20Kappsfarm%2C%20Namibia&z=16&output=embed', label: 'Eden Chalets at Kapp’s Farm', title: 'Google Maps location of Eden Self Catering Chalets at Kappsfarm' }
  };
  const buttons = [...document.querySelectorAll('[data-map-view]')];
  buttons.forEach(button => button.addEventListener('click', () => {
    const view = mapViews[button.dataset.mapView];
    if (button.getAttribute('aria-pressed') === 'true') return;
    journeyMap.src = view.src;
    journeyMap.title = view.title;
    document.getElementById('journey-map-label').textContent = view.label;
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
}

  window.disposeWeddingPage = () => {
    lifecycle.abort(); timers.forEach(clearInterval);
    revealObserver?.disconnect(); observers.forEach(observer => observer.disconnect());
  };
};
window.initializeWeddingPage();
