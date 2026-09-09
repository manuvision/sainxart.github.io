import { estimateAt, DAY_MS } from './model.js';
const $ = id => document.getElementById(id);
const integers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const utcClock = new Intl.DateTimeFormat('en-GB', {timeZone:'UTC',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
let scenario = 'central', artwork;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
function renderNumbers() {
  const now = new Date();
  const estimate = estimateAt(now.getTime(), scenario);
  const dayCapacity = estimate.rate * DAY_MS / 1000;
  const fraction = estimate.today / dayCapacity;
  $('today-value').textContent = integers.format(Math.floor(estimate.today));
  $('rate-value').textContent = integers.format(estimate.rate);
  $('history-value').textContent = integers.format(Math.floor(estimate.cumulative));
  $('annual-value').textContent = (estimate.annual / 1e9).toLocaleString('en-US', { maximumFractionDigits: 2 });
  $('day-capacity').textContent = (dayCapacity / 1e9).toFixed(2) + ' billion liters';
  $('modal-capacity').textContent = integers.format(dayCapacity) + ' liters';
  $('day-percent').textContent = (fraction * 100).toFixed(1) + '%';
  $('utc-clock').textContent = utcClock.format(now) + ' UTC';
  $('utc-clock').dateTime = now.toISOString();
  $('scene').dataset.fillFraction = fraction.toFixed(6);
  artwork?.setFill(fraction);
}
document.querySelectorAll('input[name="scenario"]').forEach(input => input.addEventListener('change', () => { scenario = input.value; renderNumbers(); }));
function updateMotion() {
  $('toggle-motion').setAttribute('aria-pressed', String(paused));
  $('toggle-motion').setAttribute('aria-label', paused ? 'Resume water animation' : 'Pause water animation');
  $('motion-text').textContent = paused ? 'Resume' : 'Pause';
  $('motion-icon').innerHTML = paused ? '<path d="m7 4 8 6-8 6Z"/>' : '<path d="M7 5v10M13 5v10"/>';
  artwork?.setPaused(paused);
}
$('toggle-motion').addEventListener('click', () => { paused = !paused; updateMotion(); });
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => { paused = event.matches; updateMotion(); });
const dialog = $('method-dialog');
$('open-method').addEventListener('click', () => { dialog.showModal(); document.body.style.overflow = 'hidden'; });
$('close-method').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
});
dialog.addEventListener('close', () => { document.body.style.overflow = ''; $('open-method').focus(); });
renderNumbers(); updateMotion();
setInterval(() => { if (!document.hidden) renderNumbers(); }, 100);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderNumbers(); });
import('./scene.js?v=3').then(({ createWaterScene }) => {
  artwork = createWaterScene($('scene'), {
    fraction: estimateAt(Date.now(), scenario).dayFraction, paused,
    onWaterline(position) { $('fill-label').style.top = (position * 100) + '%'; },
  });
}).catch(error => { console.warn('Water visualization unavailable:', error); $('graphics-status').hidden = false; $('toggle-motion').hidden = true; $('interaction-hint').hidden = true; });

