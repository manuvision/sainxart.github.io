import {
  CONTROL_DEFINITIONS,
  DEFAULT_SETTINGS,
  createArtwork,
  describeArtwork,
  makeDailySeed,
  makePngFilename,
  makeSeed,
  normalizeSettings,
  renderArtwork,
} from './generator.js?v=20260818-1';

const CONTROL_IDS = Object.keys(CONTROL_DEFINITIONS);
const canvas = document.querySelector('#artworkCanvas');
const canvasCopyButton = document.querySelector('#canvasCopyButton');
const screenGlass = document.querySelector('#screenGlass');
const randomizeButton = document.querySelector('#randomizeButton');
const saveButton = document.querySelector('#saveButton');
const seedValue = document.querySelector('#seedValue');
const toast = document.querySelector('#toast');
const scanBeams = [...document.querySelectorAll('.scanlines span')];
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const controls = Object.fromEntries(
  CONTROL_IDS.map((id) => [id, document.querySelector(`#${id}`)]),
);

let settings = { ...DEFAULT_SETTINGS };
let currentSeed = makeDailySeed();
let usesDailySeed = true;
let artwork = null;
let glitchTimer = 0;
let scanlineTimer = 0;
let toastTimer = 0;

function formatValue(id, value) {
  if (id === 'blackRatio') return `${value}%`;
  if (id === 'pixelSize' || id === 'imageWidth' || id === 'imageHeight') return `${value} px`;
  if (id === 'spriteWidth' || id === 'spriteHeight') return `${value} cells`;
  return String(value);
}

function formatSeed(seed) {
  return (Number(seed) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function updateRangeAppearance(input) {
  const minimum = Number(input.min);
  const maximum = Number(input.max);
  const progress = ((Number(input.value) - minimum) / (maximum - minimum)) * 100;
  input.style.setProperty('--range-progress', `${progress}%`);
}

function syncControl(id) {
  const input = controls[id];
  input.value = String(settings[id]);
  document.querySelector(`#${id}Value`).textContent = formatValue(id, settings[id]);
  updateRangeAppearance(input);
}

function syncAllControls() {
  CONTROL_IDS.forEach(syncControl);
}

function triggerScreenPulse() {
  screenGlass.classList.remove('is-generating');
  requestAnimationFrame(() => screenGlass.classList.add('is-generating'));
  window.setTimeout(() => screenGlass.classList.remove('is-generating'), 320);
}

function renderCurrentArtwork() {
  artwork = createArtwork(settings, currentSeed);
  renderArtwork(canvas, artwork);

  const description = describeArtwork(artwork);
  canvasCopyButton.setAttribute('aria-label', `${description} Copy this image to the clipboard.`);
  seedValue.textContent = formatSeed(artwork.seed);

  const accentColor = artwork.sprites[0]?.palette.at(-1) || '#8DD1E7';
  document.documentElement.style.setProperty('--screen-accent', accentColor);
  triggerScreenPulse();
}

function commitControl(id, value) {
  settings = normalizeSettings({ ...settings, [id]: value });
  syncControl(id);
  renderCurrentArtwork();
}

function adjustControl(id, direction) {
  const input = controls[id];
  if (direction > 0) input.stepUp();
  else input.stepDown();
  commitControl(id, input.value);
  pulseControl(id);
  haptic(7);
}

function pulseControl(id) {
  const card = document.querySelector(`[data-control="${id}"]`);
  card.classList.remove('is-adjusted');
  requestAnimationFrame(() => card.classList.add('is-adjusted'));
  window.setTimeout(() => card.classList.remove('is-adjusted'), 180);
}

function randomizeSeed() {
  const nextSeed = makeSeed();
  currentSeed = nextSeed === currentSeed ? (nextSeed + 1) >>> 0 : nextSeed;
  usesDailySeed = false;
  renderCurrentArtwork();
  haptic(14);
}

function refreshDailyArtwork() {
  if (document.hidden || !usesDailySeed) return;
  const todaySeed = makeDailySeed();
  if (todaySeed === currentSeed) return;

  currentSeed = todaySeed;
  renderCurrentArtwork();
}

function randomizeGlitchGeometry() {
  const horizontalShift = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.round(Math.random() * 16));
  const verticalShift = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.round(Math.random() * 3));
  screenGlass.style.setProperty('--glitch-y-one', `${8 + Math.random() * 72}%`);
  screenGlass.style.setProperty('--glitch-y-two', `${12 + Math.random() * 68}%`);
  screenGlass.style.setProperty('--glitch-shift', `${horizontalShift}px`);
  screenGlass.style.setProperty('--glitch-shift-negative', `${-horizontalShift}px`);
  screenGlass.style.setProperty('--glitch-shift-half', `${Math.round(horizontalShift / 2)}px`);
  screenGlass.style.setProperty('--glitch-vshift', `${verticalShift}px`);
  screenGlass.style.setProperty('--glitch-vshift-negative', `${-verticalShift}px`);
}

function haptic(duration) {
  if ('vibrate' in navigator) navigator.vibrate(duration);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function downloadBlob(blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = makePngFilename(artwork);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function savePng() {
  if (!artwork) renderCurrentArtwork();

  saveButton.disabled = true;
  canvas.toBlob((blob) => {
    saveButton.disabled = false;
    if (!blob) {
      showToast('PNG COULD NOT BE SAVED');
      return;
    }

    downloadBlob(blob);
    showToast('CLEAN PNG SAVED');
    haptic([8, 35, 12]);
  }, 'image/png');
}

function makeCanvasPngBlob() {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The Glyxel canvas could not be converted to PNG.'));
    }, 'image/png');
  });
}

async function copyPng() {
  if (!artwork) renderCurrentArtwork();

  const ClipboardItemConstructor = globalThis.ClipboardItem;
  const supportsPngClipboard = window.isSecureContext
    && navigator.clipboard?.write
    && ClipboardItemConstructor
    && (typeof ClipboardItemConstructor.supports !== 'function'
      || ClipboardItemConstructor.supports('image/png'));

  if (!supportsPngClipboard) {
    showToast('COPY UNAVAILABLE — USE SAVE BUTTON');
    return;
  }

  canvasCopyButton.setAttribute('aria-busy', 'true');

  try {
    const pngPromise = makeCanvasPngBlob();
    const clipboardItem = new ClipboardItemConstructor({ 'image/png': pngPromise });
    await navigator.clipboard.write([clipboardItem]);
    showToast('CLEAN PNG COPIED — PASTE IT NOW');
    haptic([8, 35, 12]);
  } catch (error) {
    console.error('Could not copy the Glyxel PNG.', error);
    showToast('COPY FAILED — USE SAVE BUTTON');
  } finally {
    canvasCopyButton.removeAttribute('aria-busy');
  }
}

function scheduleGlitch() {
  window.clearTimeout(glitchTimer);
  if (motionPreference.matches || document.hidden) return;

  glitchTimer = window.setTimeout(() => {
    randomizeGlitchGeometry();
    screenGlass.classList.add('is-glitching');
    window.setTimeout(() => screenGlass.classList.remove('is-glitching'), 260);
    scheduleGlitch();
  }, 900 + Math.random() * 2100);
}

function randomizeScanBeams() {
  const activeCount = 1 + Math.floor(Math.random() * scanBeams.length);
  const zoneSize = 100 / activeCount;

  scanBeams.forEach((beam, index) => {
    beam.classList.remove('is-active');
    if (index >= activeCount) return;

    const start = index * zoneSize + 8 + Math.random() * Math.max(4, zoneSize - 16);
    const direction = Math.random() < 0.5 ? -1 : 1;
    const distance = 8 + Math.random() * 28;
    const end = Math.min(104, Math.max(-4, start + direction * distance));
    const duration = 2200 + index * 350 + Math.random() * 4800;

    beam.style.setProperty('--scan-start', `${start.toFixed(1)}%`);
    beam.style.setProperty('--scan-end', `${end.toFixed(1)}%`);
    beam.style.setProperty('--scan-height', `${(2 + Math.random() * 5).toFixed(1)}px`);
    beam.style.setProperty('--scan-opacity', (0.58 + Math.random() * 0.35).toFixed(2));
    beam.style.setProperty('--scan-duration', `${Math.round(duration)}ms`);
    beam.style.setProperty('--scan-delay', `${-Math.round(Math.random() * duration)}ms`);
    requestAnimationFrame(() => beam.classList.add('is-active'));
  });
}

function scheduleScanBeams() {
  window.clearTimeout(scanlineTimer);
  scanBeams.forEach((beam) => beam.classList.remove('is-active'));
  if (motionPreference.matches || document.hidden) return;

  randomizeScanBeams();
  scanlineTimer = window.setTimeout(scheduleScanBeams, 6500 + Math.random() * 5500);
}

for (const id of CONTROL_IDS) {
  controls[id].addEventListener('input', () => commitControl(id, controls[id].value));
}

document.querySelectorAll('[data-adjust]').forEach((button) => {
  button.addEventListener('click', () => {
    adjustControl(button.dataset.target, Number(button.dataset.adjust));
  });
});

document.querySelector('#controls').addEventListener('submit', (event) => event.preventDefault());
randomizeButton.addEventListener('click', randomizeSeed);
saveButton.addEventListener('click', savePng);
canvasCopyButton.addEventListener('click', copyPng);

if (motionPreference.addEventListener) {
  motionPreference.addEventListener('change', scheduleGlitch);
  motionPreference.addEventListener('change', scheduleScanBeams);
} else {
  motionPreference.addListener?.(scheduleGlitch);
  motionPreference.addListener?.(scheduleScanBeams);
}
document.addEventListener('visibilitychange', scheduleGlitch);
document.addEventListener('visibilitychange', scheduleScanBeams);
document.addEventListener('visibilitychange', refreshDailyArtwork);

syncAllControls();
renderCurrentArtwork();
scheduleGlitch();
scheduleScanBeams();
