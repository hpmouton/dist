(() => {
  const audio = document.getElementById('wedding-audio');
  if (!audio) return;
  const widget = document.querySelector('.song-player');
  const toggle = widget.querySelector('.song-toggle');
  const label = widget.querySelector('.song-label');
  const settings = widget.querySelector('.song-settings');
  const panel = widget.querySelector('.song-panel');
  const volume = widget.querySelector('input');
  const note = widget.querySelector('.song-status');
  const read = (store, key) => { try { return window[store].getItem(key); } catch { return null; } };
  const write = (store, key, value) => { try { window[store].setItem(key, String(value)); } catch {} };
  let pausedByGuest = read('localStorage', 'wedding-music-choice') === 'paused';
  const savedVolume = read('localStorage', 'wedding-music-volume');
  audio.volume = savedVolume !== null && Number.isFinite(Number(savedVolume)) ? Math.max(0, Math.min(1, Number(savedVolume))) : 0.35;
  volume.value = Math.round(audio.volume * 100);
  function sync() {
    const playing = !audio.paused;
    toggle.setAttribute('aria-label', playing ? 'Pause wedding music' : 'Play wedding music');
    label.textContent = playing ? 'Pause music' : 'Play music';
    widget.classList.toggle('is-playing', playing);
  }
  function rememberPosition() { if (Number.isFinite(audio.currentTime)) write('sessionStorage', 'wedding-music-position', audio.currentTime); }
  async function play() {
    note.textContent = '';
    try { await audio.play(); }
    catch (error) { note.textContent = error.name === 'NotAllowedError' ? 'Tap Play music to listen.' : 'Music couldn’t load. Tap Play music to try again.'; }
    sync();
  }
  toggle.addEventListener('click', () => {
    if (audio.paused) { pausedByGuest = false; write('localStorage','wedding-music-choice','playing'); play(); }
    else { pausedByGuest = true; write('localStorage','wedding-music-choice','paused'); audio.pause(); rememberPosition(); }
  });
  settings.addEventListener('click', () => { panel.hidden = !panel.hidden; settings.setAttribute('aria-expanded', String(!panel.hidden)); });
  widget.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { panel.hidden = true; settings.setAttribute('aria-expanded','false'); settings.focus(); } });
  volume.addEventListener('input', () => { audio.volume = Number(volume.value) / 100; write('localStorage','wedding-music-volume',audio.volume); });
  audio.addEventListener('play', sync); audio.addEventListener('pause', sync);
  audio.addEventListener('error', () => { note.textContent = 'Music is unavailable right now. Please try again later.'; sync(); });
  audio.addEventListener('loadedmetadata', () => { const position = Number(read('sessionStorage','wedding-music-position')); if (position > 0 && position < audio.duration) audio.currentTime = position; }, {once:true});
  window.addEventListener('pagehide', rememberPosition);
  document.addEventListener('visibilitychange', () => { if (document.hidden) rememberPosition(); });
  // Retry once after a genuine interaction, unless the guest has chosen silence.
  const unlock = event => { if (event.target.closest('.song-player')) return; document.removeEventListener('click', unlock); if (!pausedByGuest && audio.paused) play(); };
  document.addEventListener('click', unlock);
  sync();
  if (!pausedByGuest) play();
})();
