import { PortfolioScreen, fillReader } from './screen.js';

const $=s=>document.querySelector(s);
const large=$('#large-screen'),largeCtx=large.getContext('2d');
let device,screen,sound=false,audioContext,screenOpen=false,lastAnnouncement='';
function update(current){
  device?.updateScreen();largeCtx.imageSmoothingEnabled=false;largeCtx.drawImage(current.canvas,0,0);
  if(current.boot)return;
  const label=current.label;if(label!==lastAnnouncement){$('#announcement').textContent=label;lastAnnouncement=label}
}
screen=new PortfolioScreen(update);
function beep(key){
  if(!sound)return;
  try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.value=key==='a'?660:key==='b'?330:480;gain.gain.setValueAtTime(.04,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.07);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+.075)}catch{sound=false;$('#sound').setAttribute('aria-pressed','false');$('#sound span').textContent='Sound off'}
}
function expanded(open){
  screenOpen=open;$('#screen-view').hidden=!open;document.body.classList.toggle('screen-open',open);$('#expand').setAttribute('aria-pressed',String(open));
  if(open)$('#close-screen').focus({preventScroll:true});else $('#expand').focus({preventScroll:true});
}
function input(key,point){
  if(key==='fallback'){fallback();return}
  if(key==='screen'){expanded(!screenOpen);return}
  beep(key);
  if(key==='touch'){screen.touch(point.x,point.y);return}
  if(key==='select'){screen.action('b');return}
  screen.action(key);
  const button=document.querySelector(`[data-input="${key}"]`);button?.classList.add('pressed');device?.press(key,true);
  setTimeout(()=>{button?.classList.remove('pressed');device?.press(key,false)},110);
}
const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',Enter:'a',' ':'a',z:'a',Z:'a',x:'b',X:'b',Escape:'b',Backspace:'b',h:'home',H:'home'};
window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||e.target.matches('input,textarea,select'))return;
  // Keep native keyboard activation of ordinary links and buttons.
  if((e.key==='Enter'||e.key===' ')&&e.target.closest('button,a'))return;
  if(!$('#reader').hidden&&$('#reader').contains(e.target))return;
  const key=keys[e.key];if(!key)return;
  e.preventDefault();if(e.repeat&&['a','b','home'].includes(key))return;input(key);
});
document.querySelectorAll('[data-input]').forEach(button=>button.addEventListener('click',()=>input(button.dataset.input)));
$('#sound').addEventListener('click',()=>{sound=!sound;$('#sound').setAttribute('aria-pressed',String(sound));$('#sound span').textContent=sound?'Sound on':'Sound off';beep('a')});
$('#replay').addEventListener('click',()=>{device?.replay();beep('a')});
$('#expand').addEventListener('click',()=>expanded(!screenOpen));$('#close-screen').addEventListener('click',()=>expanded(false));
large.addEventListener('click',e=>{const r=large.getBoundingClientRect();input('touch',{x:(e.clientX-r.left)/r.width*480,y:(e.clientY-r.top)/r.height*320})});
let wheelAt=0;large.addEventListener('wheel',e=>{e.preventDefault();if(performance.now()-wheelAt>140){input(e.deltaY<0?'up':'down');wheelAt=performance.now()}},{passive:false});
fillReader($('#reader'));
$('#reader-toggle').addEventListener('click',()=>{const open=$('#reader').hidden;$('#reader').hidden=!open;$('#reader-toggle').setAttribute('aria-expanded',String(open));if(open)$('#reader').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})});
$('.skip-link').addEventListener('click',()=>{$('#reader').hidden=false;$('#reader-toggle').setAttribute('aria-expanded','true')});
function fallback(){document.body.classList.add('fallback');$('#loading').classList.add('done');$('#screen-view').hidden=false;$('#close-screen').hidden=true;$('#expand').hidden=true;$('#replay').hidden=true;screen.boot=false;screen.draw();$('#announcement').textContent='3D is unavailable. The portfolio is ready in screen view.'}
try{
  const {SPConsole}=await import('./console.js');
  device=new SPConsole($('#console'),screen,input,()=>{$('#loading').classList.add('done')});
  // Stop the status overlay once the physical console has appeared.
  setTimeout(()=>$('#loading').classList.add('done'),500);
}catch(error){console.error('Console renderer unavailable:',error);fallback()}
