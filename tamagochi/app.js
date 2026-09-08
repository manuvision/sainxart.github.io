import { PetGame } from './game.js';
import { LCDRenderer } from './lcd.js';
import { PocketAudio } from './audio.js';

const stage = document.getElementById('stage');
const audio = new PocketAudio();
const game = new PetGame({ onSound: name => audio.play(name) });
const lcd = new LCDRenderer();
const help = document.getElementById('help-dialog');
let device = null;
let lastFrame = 0;
let lastSummary = '';
let preference = {};
try { preference = JSON.parse(localStorage.getItem('tamagochi.preferences') || '{}') || {}; } catch { /* Preferences are optional. */ }
if (typeof preference !== 'object' || Array.isArray(preference)) preference = {};
const savePreferences = () => { try { localStorage.setItem('tamagochi.preferences', JSON.stringify(preference)); } catch { /* Keep playing. */ } };

function applySound() {
  audio.setMuted(Boolean(preference.muted));
  const button = document.getElementById('sound-toggle');
  button.setAttribute('aria-pressed', String(Boolean(preference.muted)));
  button.setAttribute('aria-label', preference.muted ? 'Enable sound' : 'Mute sound');
  button.title = preference.muted ? 'Sound off' : 'Sound on';
}
applySound();
document.getElementById('sound-toggle').addEventListener('click', () => {
  audio.unlock(); preference.muted = !preference.muted; applySound(); audio.play('select'); savePreferences();
});

function setColor(name) {
  if (!['apricot', 'sage', 'lilac'].includes(name)) name = 'apricot';
  preference.color = name; device?.setColor(name);
  document.querySelectorAll('.swatch').forEach(button => { const active = button.dataset.color === name; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  document.getElementById('color-name').textContent = name.charAt(0).toUpperCase() + name.slice(1);
  const fallbackColors = { apricot: ['#f6d1a9', '#edb684', '#ca926a'], sage: ['#cbdcc2', '#acc4a5', '#718c71'], lilac: ['#d9cbe5', '#b8a6cc', '#867098'] };
  document.getElementById('fallback-device').style.background = `linear-gradient(135deg,${fallbackColors[name].join(',')})`;
  savePreferences();
}
document.querySelectorAll('.swatch').forEach(button => button.addEventListener('click', () => { audio.unlock(); audio.play('select'); setColor(button.dataset.color); }));

function press(key) {
  if (help.open) return;
  audio.unlock();
  device?.press(key);
  if (navigator.vibrate) navigator.vibrate(9);
  game.tick(Date.now()); game.press(key); refreshStatus();
}
document.querySelectorAll('.physical-button').forEach(button => button.addEventListener('click', () => press(button.dataset.key)));
document.getElementById('leave-game').addEventListener('click', () => { audio.unlock(); game.exitGame(); refreshStatus(); });
const keyMap = { a: 'a', b: 'b', c: 'c', ArrowLeft: 'a', ArrowRight: 'c', Enter: 'b', ' ': 'b' };
document.addEventListener('keydown', event => {
  if (help.open || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  // Native keyboard activation remains available on utility and color buttons.
  if (event.target.closest('button, a') && ['Enter', ' '].includes(event.key)) return;
  const key = keyMap[event.key] || keyMap[event.key.toLowerCase()];
  if (key) { event.preventDefault(); press(key); }
  if (event.key === 'Escape') { event.preventDefault(); if (['catch', 'memory'].includes(game.getSnapshot().mode)) game.exitGame(); else game.press('c'); refreshStatus(); }
});

const closeHelp = () => { help.close(); document.getElementById('reset-confirm').hidden = true; };
document.getElementById('help-open').addEventListener('click', () => help.showModal());
document.getElementById('help-close').addEventListener('click', closeHelp);
document.getElementById('help-done').addEventListener('click', closeHelp);
help.addEventListener('click', event => { if (event.target === help) { const r = help.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeHelp(); } });
document.getElementById('reset-pet').addEventListener('click', () => { document.getElementById('reset-confirm').hidden = false; document.getElementById('reset-cancel').focus(); });
document.getElementById('reset-cancel').addEventListener('click', () => { document.getElementById('reset-confirm').hidden = true; });
document.getElementById('reset-confirm-button').addEventListener('click', () => { game.reset(); closeHelp(); audio.unlock(); audio.play('egg'); refreshStatus(); });
document.getElementById('fullscreen-toggle').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else { document.getElementById('caption').textContent = 'Add to your Home Screen for a fullscreen pocket friend.'; }
  } catch { document.getElementById('caption').textContent = 'Fullscreen is unavailable in this browser.'; }
});
document.addEventListener('fullscreenchange', () => document.getElementById('fullscreen-toggle').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'));

function refreshStatus() {
  const state = game.getSnapshot();
  if (state.summary !== lastSummary) {
    document.getElementById('game-status').textContent = state.summary;
    lastSummary = state.summary;
  }
  let caption = 'A little care goes a long way.';
  if (state.stage === 'egg') caption = state.mode === 'hatching' ? 'A little patience. A little magic.' : 'Press B. A little life is waiting.';
  else if (state.mode === 'catch') caption = state.catch?.active ? 'A: move left · C: move right. Catch the snacks!' : 'A: move left · C: move right · B: start';
  else if (state.mode === 'memory') caption = 'Watch closely. Repeat the melody with A, B, C.';
  else if (state.pet.sleeping) caption = 'Shh. Little dreams in progress.';
  else if (state.mode === 'home') caption = `${state.pet.name.charAt(0) + state.pet.name.slice(1).toLowerCase()} is happy you’re here. Press A to care.`;
  document.getElementById('caption').textContent = caption;
  document.getElementById('leave-game').hidden = !['catch', 'memory'].includes(state.mode);
  const guides = state.buttons || { a: 'Select', b: 'Confirm', c: 'Back' };
  for (const key of ['a', 'b', 'c']) document.getElementById(`button-${key}`).setAttribute('aria-label', `${key.toUpperCase()}: ${guides[key] || { a: 'Select', b: 'Confirm', c: 'Back' }[key]}`);
  document.getElementById('save-state').innerHTML = `<span></span>${state.saveAvailable === false ? 'PLAYING WITHOUT A SAVE' : 'SAVED ON THIS DEVICE'}`;
  // Expose readable state through the DOM for assistive tools and reliable QA.
  stage.dataset.mode = state.mode; stage.dataset.lifeStage = state.stage;
}

function fallback() {
  document.querySelector('#stage > canvas')?.remove();
  document.getElementById('fallback-device').hidden = false;
  document.getElementById('fallback-lcd').append(lcd.canvas);
  const place = () => {
    const outer = stage.getBoundingClientRect();
    document.querySelectorAll('.fallback-keys span').forEach((span, index) => {
      const r = span.getBoundingClientRect(), button = document.getElementById(`button-${['a', 'b', 'c'][index]}`);
      button.style.left = `${r.left + r.width / 2 - outer.left}px`; button.style.top = `${r.top + r.height / 2 - outer.top}px`;
    });
  };
  new ResizeObserver(place).observe(stage); place();
}

try {
  const { PocketDevice } = await import('./device.js');
  device = new PocketDevice(stage, lcd.canvas);
  device.renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); device = null; fallback(); });
} catch (error) { console.info('Using the accessible pocket device fallback.', error.message); fallback(); }
document.getElementById('loading').hidden = true;
setColor(preference.color || 'apricot');
refreshStatus();
let lastStatus = 0;
function frame(time) {
  requestAnimationFrame(frame);
  if (document.hidden || time - lastFrame < 1000 / 30) return;
  lastFrame = time;
  const snapshot = game.tick(Date.now());
  lcd.draw(snapshot, time / 1000);
  device?.update(time / 1000);
  if (time - lastStatus > 1200) { refreshStatus(); lastStatus = time; }
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => { game.tick(Date.now()); refreshStatus(); });
