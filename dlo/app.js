import { estimateAt } from './model.js?v=5';
import { COPY } from './content.js?v=9';
const $ = id => document.getElementById(id);
let language = 'fr';
try { if (localStorage.getItem('dlo-language') === 'en') language = 'en'; } catch {}
let artwork;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let integers, decimal;
function renderNumbers() {
  const estimate = estimateAt(Date.now());
  $('today-value').textContent = integers.format(Math.floor(estimate.today));
  $('rate-value').textContent = String(Math.round(estimate.rate));
  $('day-capacity').textContent = decimal.format(estimate.dayCapacity / 1e6) + ' ' + COPY[language].millionLitres;
  $('day-percent').textContent = decimal.format(estimate.dayFraction * 100) + (language === 'fr' ? ' %' : '%');
  $('scene').dataset.fillFraction = estimate.dayFraction.toFixed(6);
  artwork?.setFill(estimate.dayFraction);
}
function applyLanguage() {
  const text = COPY[language], locale = language === 'fr' ? 'fr-FR' : 'en-GB';
  integers = new Intl.NumberFormat(locale, {maximumFractionDigits: 0});
  decimal = new Intl.NumberFormat(locale, {minimumFractionDigits: 1, maximumFractionDigits: 1});
  document.documentElement.lang = language;
  // The canonical social card stays French; the page language is a local preference.
  document.title = text.title;
  document.querySelector('meta[name="description"]').content = text.description;
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = text[node.dataset.i18n]; });
  $('method-content').innerHTML = text.modal;
  document.querySelectorAll('[data-language]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.language === language));
  });
  document.querySelector('.language-switch').setAttribute('aria-label', text.languageLabel);
  document.querySelector('.bottle-figure').setAttribute('aria-label', text.figureLabel);
  $('scene').setAttribute('aria-label', text.sceneLabel);
  $('scene').setAttribute('aria-roledescription', text.sceneRole);
  $('today-value').setAttribute('aria-label', text.counterLabel);
  $('close-method').setAttribute('aria-label', text.close);
  renderNumbers();
}
document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => {
  if (language === button.dataset.language) return;
  language = button.dataset.language;
  try { localStorage.setItem('dlo-language', language); } catch {}
  applyLanguage();
}));
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
  paused = event.matches;
  artwork?.setPaused(paused);
});
const dialog = $('method-dialog');
$('open-method').addEventListener('click', () => { dialog.showModal(); dialog.scrollTop = 0; document.body.style.overflow = 'hidden'; });
$('close-method').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
});
dialog.addEventListener('close', () => { document.body.style.overflow = ''; $('open-method').focus(); });
applyLanguage();
setInterval(() => { if (!document.hidden) renderNumbers(); }, 100);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderNumbers(); });
import('./scene.js?v=7').then(({createWaterScene}) => {
  artwork = createWaterScene($('scene'), {
    fraction: estimateAt(Date.now()).dayFraction, paused,
    onWaterline(position) {
      const label = $('fill-label'), figure = label.parentElement;
      const top = Math.min(position * figure.clientHeight, figure.clientHeight - label.offsetHeight - 12);
      label.style.top = Math.max(0, top) + 'px';
    },
  });
}).catch(error => {
  console.warn('Water visualization unavailable:', error);
  $('graphics-status').hidden = false;
  $('scene').hidden = true;
});
