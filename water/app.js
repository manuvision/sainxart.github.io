import { estimateAt } from './model.js';

const $ = id => document.getElementById(id);
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const annualFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
let scenario = 'central';
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let artwork;
let lastRender = 0;
const clockFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
function renderNumbers(now = Date.now()) {
  const estimate = estimateAt(now, scenario);
  $('today-value').textContent = integer.format(Math.floor(estimate.today));
  $('history-value').textContent = integer.format(Math.floor(estimate.cumulative));
  $('rate-value').textContent = integer.format(estimate.rate);
  $('annual-value').textContent = annualFormat.format(estimate.annual / 1e9);
  if (!paused || $('day-percent').textContent === '—') $('day-percent').textContent = `${(estimate.dayFraction * 100).toFixed(1)}%`;
  $('world-clock').textContent = `${clockFormat.format(now)} UTC`;
  $('world-clock').dateTime = new Date(now).toISOString();
  if (!paused) artwork?.setFill(estimate.dayFraction);
}
document.querySelectorAll('input[name="scenario"]').forEach(input => input.addEventListener('change', () => { scenario = input.value; renderNumbers(); }));
function updateMotion() {
  $('toggle-motion').setAttribute('aria-pressed', String(paused));
  $('toggle-motion').setAttribute('aria-label', paused ? 'Resume animation' : 'Pause animation');
  $('motion-text').textContent = paused ? 'Resume motion' : 'Pause motion';
  $('pause-icon').innerHTML = paused ? '<path d="m7 4 8 6-8 6Z"/>' : '<path d="M7 5v10M13 5v10"/>';
  artwork?.setPaused(paused);
  if (!paused) renderNumbers();
}
$('toggle-motion').addEventListener('click', () => { paused = !paused; updateMotion(); });
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => { paused = event.matches; updateMotion(); });
const dialog = $('method-dialog');
let dialogTrigger;
function openMethod(event) { dialogTrigger = event.currentTarget; dialog.showModal(); document.body.style.overflow = 'hidden'; }
$('open-method').addEventListener('click', openMethod);
$('open-notes').addEventListener('click', openMethod);
$('close-method').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
dialog.addEventListener('close', () => { document.body.style.overflow = ''; dialogTrigger?.focus(); });
renderNumbers(); updateMotion();
// Re-read the clock every frame; throttling only limits DOM work, never integrates usage.
function tick(time) { if (time - lastRender > 90) { renderNumbers(); lastRender = time; } requestAnimationFrame(tick); }
requestAnimationFrame(tick);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderNumbers(); });
// Keep the counters functional even if graphics are unavailable.
import('./scene.js').then(({ createWaterScene }) => {
  artwork = createWaterScene($('scene'), { fraction: estimateAt(Date.now(), scenario).dayFraction, paused });
}).catch(error => { console.warn('Water visualization unavailable:', error); $('graphics-status').hidden = false; $('toggle-motion').hidden = true; });
