import { estimateAt, TIME_ZONE } from './model.js?v=5';
import { COPY } from './content.js?v=6';
const $ = id => document.getElementById(id);
let language = 'fr';
try { if (localStorage.getItem('dlo-language') === 'en') language = 'en'; } catch {}
let artwork, sceneFailed = false;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let integers, decimal, clock;
function renderNumbers() {
  const now = new Date(), estimate = estimateAt(now.getTime());
  $('today-value').textContent = integers.format(Math.floor(estimate.today));
  $('rate-value').textContent = integers.format(estimate.rate);
  $('day-capacity').textContent = decimal.format(estimate.dayCapacity / 1e6) + ' ' + COPY[language].millionLitres;
  $('day-percent').textContent = decimal.format(estimate.dayFraction * 100) + (language === 'fr' ? ' %' : '%');
  $('local-clock').textContent = clock.format(now);
  $('local-clock').dateTime = now.toISOString();
  $('scene').dataset.fillFraction = estimate.dayFraction.toFixed(6);
  artwork?.setFill(estimate.dayFraction);
}
function updateMotion() {
  const text = COPY[language];
  $('toggle-motion').setAttribute('aria-pressed', String(paused));
  $('toggle-motion').setAttribute('aria-label', paused ? text.resumeLabel : text.pauseLabel);
  $('motion-text').textContent = paused ? text.resume : text.pause;
  $('motion-icon').innerHTML = paused ? '<path d="m7 4 8 6-8 6Z"/>' : '<path d="M7 5v10M13 5v10"/>';
  artwork?.setPaused(paused);
}
function applyLanguage() {
  const text = COPY[language], locale = language === 'fr' ? 'fr-FR' : 'en-GB';
  integers = new Intl.NumberFormat(locale, {maximumFractionDigits: 0});
  decimal = new Intl.NumberFormat(locale, {minimumFractionDigits: 1, maximumFractionDigits: 1});
  clock = new Intl.DateTimeFormat(locale, {timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});
  document.documentElement.lang = language;
  // The canonical social card stays French; the page language is a local preference.
  document.title = text.title;
  document.querySelector('meta[name="description"]').content = text.description;
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = text[node.dataset.i18n]; });
  $('method-content').innerHTML = text.modal;
  $('language-toggle').textContent = language === 'fr' ? 'EN' : 'FR';
  $('language-toggle').lang = language === 'fr' ? 'en' : 'fr';
  $('language-toggle').setAttribute('aria-label', language === 'fr' ? 'Read in English' : 'Lire en français');
  document.querySelector('.header-actions').setAttribute('aria-label', text.navLabel);
  $('scene').setAttribute('aria-label', text.sceneLabel);
  $('scene').setAttribute('aria-roledescription', text.sceneRole);
  $('today-value').setAttribute('aria-label', text.counterLabel);
  $('close-method').setAttribute('aria-label', text.close);
  $('interaction-hint').hidden = sceneFailed;
  renderNumbers(); updateMotion();
}
$('language-toggle').addEventListener('click', () => {
  language = language === 'fr' ? 'en' : 'fr';
  try { localStorage.setItem('dlo-language', language); } catch {}
  applyLanguage();
});
$('toggle-motion').addEventListener('click', () => { paused = !paused; updateMotion(); });
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => { paused = event.matches; updateMotion(); });
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
import('./scene.js?v=5').then(({createWaterScene}) => {
  artwork = createWaterScene($('scene'), {
    fraction: estimateAt(Date.now()).dayFraction, paused,
    onWaterline(position) { $('fill-label').style.top = (position * 100) + '%'; },
  });
}).catch(error => {
  console.warn('Water visualization unavailable:', error);
  sceneFailed = true;
  $('graphics-status').hidden = false; $('toggle-motion').hidden = true; $('interaction-hint').hidden = true;
});
