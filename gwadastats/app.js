import { estimateAt } from '../dlo/model.js?v=5';
import { summarize, referenceState } from './data.js?v=1';
import { COPY } from './content.js?v=1';
const $ = id => document.getElementById(id);
let language = 'fr', artwork, integers, decimal, snapshot, summary, dataFailed = false, lastRefresh = 0, refreshing = false;
try { if (localStorage.getItem('gwadastats-language') === 'en') language = 'en'; } catch {}
const motion = matchMedia('(prefers-reduced-motion: reduce)');
function renderWater() {
  const estimate = estimateAt(Date.now());
  $('water-value').textContent = integers.format(Math.floor(estimate.today));
  $('water-rate').textContent = String(Math.round(estimate.rate));
  $('day-percent').textContent = decimal.format(estimate.dayFraction * 100) + (language === 'fr' ? ' %' : '%');
  $('day-capacity').textContent = decimal.format(estimate.dayCapacity / 1e6) + ' M L';
  artwork?.setFill(estimate.dayFraction);
}
function updateReference() {
  $('snapshot-note').textContent = summary
    ? (referenceState(new Date(), summary.year) === 'current' ? COPY[language].footer : COPY[language].archive(summary.year))
    : (dataFailed ? COPY[language].dataError : COPY[language].dataLoading);
}
function applyLanguage() {
  const copy = COPY[language], locale = language === 'fr' ? 'fr-FR' : 'en-GB';
  integers = new Intl.NumberFormat(locale, {maximumFractionDigits: 0});
  decimal = new Intl.NumberFormat(locale, {minimumFractionDigits: 1, maximumFractionDigits: 1});
  const date = new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Guadeloupe'});
  document.documentElement.lang = language; document.title = copy.title;
  document.querySelector('meta[name="description"]').content = copy.description;
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = copy[node.dataset.i18n]; });
  document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
  document.querySelector('.language-switch').setAttribute('aria-label', copy.language);
  if (summary) document.querySelector('.breakdown').setAttribute('aria-label', copy.deathAria(summary.year));
  document.querySelector('.sculpture-figure').setAttribute('aria-label', copy.figure);
  $('water-value').setAttribute('aria-label', copy.waterAria);
  if (summary) {
    $('death-value').textContent = integers.format(summary.total);
    $('death-value').setAttribute('aria-label', copy.deathAria(summary.year));
    $('death-label').textContent = copy.deaths(summary.year);
    $('homicide-value').textContent = integers.format(summary.homicides);
    $('road-value').textContent = integers.format(summary.roads);
    $('homicide-date').textContent = date.format(new Date(snapshot.homicides.asOf + 'T12:00:00Z'));
    $('road-date').textContent = date.format(new Date(snapshot.roads.asOf + 'T12:00:00Z'));
    $('method-content').innerHTML = copy.modal(summary, snapshot);
  } else {
    $('method-content').textContent = dataFailed ? copy.dataError : copy.dataLoading;
  }
  $('close-method').setAttribute('aria-label', copy.close);
  $('scene').setAttribute('aria-label', copy.scene);
  $('scene').setAttribute('aria-roledescription', copy.sceneRole);
  renderWater(); updateReference();
}
document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => {
  if (language === button.dataset.language) return;
  language = button.dataset.language;
  try { localStorage.setItem('gwadastats-language', language); } catch {}
  applyLanguage();
}));
const dialog = $('method-dialog');
$('open-method').addEventListener('click', () => { dialog.showModal(); dialog.scrollTop = 0; document.body.style.overflow = 'hidden'; });
$('close-method').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
});
dialog.addEventListener('close', () => { document.body.style.overflow = ''; $('open-method').focus(); });
motion.addEventListener('change', event => artwork?.setPaused(event.matches));
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderWater(); updateReference(); if (Date.now() - lastRefresh > 60000) refreshDeaths(); } });
async function refreshDeaths() {
  if (refreshing) return;
  refreshing = true;
  try {
    const response = await fetch(new URL('./data.json', import.meta.url), {cache: 'no-store'});
    if (!response.ok) throw new Error('Death snapshot unavailable');
    const incoming = await response.json(), next = summarize(incoming);
    const changed = JSON.stringify(incoming) !== JSON.stringify(snapshot);
    snapshot = incoming; summary = next; dataFailed = false; lastRefresh = Date.now();
    if (changed) applyLanguage();
  } catch (error) {
    console.warn('Keeping the last verified death snapshot:', error);
    dataFailed = true;
    if (!summary) applyLanguage();
  } finally { refreshing = false; }
}
applyLanguage();
refreshDeaths();
setInterval(() => { if (!document.hidden) renderWater(); }, 100);
setInterval(() => { if (!document.hidden) refreshDeaths(); }, 15 * 60 * 1000);
import('./scene.js?v=1').then(({createWaterScene}) => {
  artwork = createWaterScene($('scene'), {fraction: estimateAt(Date.now()).dayFraction, paused: motion.matches});
}).catch(error => {
  console.warn('3D scene unavailable:', error); $('graphics-status').hidden = false; $('scene').hidden = true;
});
