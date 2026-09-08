import { TinyGarden } from './game.js?v=20260908-2';
import { GardenAudio } from './audio.js';

const $ = selector => document.querySelector(selector);
const prefsKey = 'tinychao.preferences.v1';
let prefs = { sound:true, music:true, haptics:true };
try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(prefsKey) || '{}') }; } catch {}
const audio = new GardenAudio();
audio.setEnabled(prefs.sound);
audio.setMusic(prefs.music);
let device, expanded = false, fallbackMode = false, previousTime = 0, lastStatusTime = 0, previousStatus = '';
const game = new TinyGarden({ onSound:name => audio.play(name) });
const large = $('#large-screen'), largeContext = large.getContext('2d');
largeContext.imageSmoothingEnabled = false;
function persistPrefs(){try{localStorage.setItem(prefsKey, JSON.stringify(prefs));}catch{}}
function updatePrefs(){
  $('#sound').setAttribute('aria-pressed', String(prefs.sound));
  $('#sound').setAttribute('aria-label', prefs.sound ? 'Mute sound' : 'Enable sound');
  $('#sound').title=prefs.sound?'Sound on — click to mute':'Sound off — click to enable';
  $('#music-toggle').checked=prefs.music;
  $('#haptics-toggle').checked=prefs.haptics;
}
updatePrefs();
function unlock(){if(!$('dialog[open]'))audio.unlock().catch(()=>{});}
document.addEventListener('pointerdown', unlock, {passive:true,capture:true});
document.addEventListener('keydown', unlock, {passive:true,capture:true});
function haptic(){if(prefs.haptics)try{navigator.vibrate?.(8);}catch{}}
const pulseTimers = new Map();
function input(key,point){
  if(key==='fallback'){fallback();return;}
  if($('dialog[open]')) return;
  if(key==='screen'){autoLandscape=false;setExpanded(!expanded);return;}
  if(key==='touch'){game.touch(point.x,point.y);haptic();return;}
  game.input(key);haptic();
  document.querySelectorAll(`[data-input="${key}"]`).forEach(b=>b.classList.add('pressed'));
  device?.press(key,true);
  clearTimeout(pulseTimers.get(key));
  pulseTimers.set(key,setTimeout(()=>{document.querySelectorAll(`[data-input="${key}"]`).forEach(b=>b.classList.remove('pressed'));device?.press(key,false);},110));
}
function setExpanded(open){
  if(fallbackMode)open=true;
  expanded=open;$('#screen-view').hidden=!open;document.body.classList.toggle('screen-open',open);
  $('#expand').setAttribute('aria-pressed',String(open));
  $('#expand').title=open?'Return to handheld':'Enlarge game screen';
  if(open)large.focus({preventScroll:true});else $('#console').focus({preventScroll:true});
}
let autoLandscape=false;
$('#expand').addEventListener('click',()=>{autoLandscape=false;setExpanded(!expanded);});
$('#close-screen').addEventListener('click',()=>{autoLandscape=false;setExpanded(false);});
$('#sound').addEventListener('click',()=>{prefs.sound=!prefs.sound;audio.setEnabled(prefs.sound);updatePrefs();persistPrefs();if(prefs.sound){unlock();audio.play('select');}});
$('#music-toggle').addEventListener('change',e=>{prefs.music=e.target.checked;audio.setMusic(prefs.music);persistPrefs();});
$('#haptics-toggle').addEventListener('change',e=>{prefs.haptics=e.target.checked;persistPrefs();haptic();});
const keymap={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',z:'a',Z:'a',a:'a',A:'a',' ':'a',x:'b',X:'b',b:'b',B:'b',Escape:'b',Backspace:'b',Enter:'start',Shift:'select',q:'l',Q:'l',e:'r',E:'r'};
window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select')||$('dialog[open]'))return;
  if((e.key==='Enter'||e.key===' ')&&e.target.closest('button,a'))return;
  const key=keymap[e.key];if(!key)return;e.preventDefault();
  if(e.repeat&&['start','select','b'].includes(key))return;
  input(key);
});
const holds=new Map();
function stopHold(id){const h=holds.get(id);if(!h)return;clearTimeout(h.delay);clearInterval(h.repeat);holds.delete(id);}
document.querySelectorAll('[data-input]').forEach(button=>{
  button.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;e.preventDefault();button.setPointerCapture(e.pointerId);input(button.dataset.input);
    const h={};holds.set(e.pointerId,h);if(['up','down','left','right','a'].includes(button.dataset.input))h.delay=setTimeout(()=>{h.repeat=setInterval(()=>input(button.dataset.input),button.dataset.input==='a'?220:110);},300);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>stopHold(e.pointerId));
  button.addEventListener('click',e=>{if(e.detail===0)input(button.dataset.input);});
});
large.addEventListener('pointerdown',e=>{e.preventDefault();large.focus({preventScroll:true});const rect=large.getBoundingClientRect();input('touch',{x:(e.clientX-rect.left)/rect.width*240,y:(e.clientY-rect.top)/rect.height*160});});
function openDialog(id){const dialog=$(id);dialog.showModal();audio.suspend();}
for(const [button,dialog] of [['#help','#help-dialog'],['#settings','#settings-dialog']])$(button).addEventListener('click',()=>openDialog(dialog));
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
  dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{previousTime=performance.now();audio.resume();$('#reset-confirm').hidden=true;});
});
$('#export-save').addEventListener('click',()=>{
  game.save();const snapshot=game.exportSave?game.exportSave():game.state;
  const blob=new Blob([JSON.stringify({format:'tinychao-garden',version:1,savedAt:new Date().toISOString(),garden:snapshot},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`tinychao-garden-${new Date().toISOString().slice(0,10)}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('#settings-message').textContent='Your garden backup is ready.';
});
$('#import-save').addEventListener('click',()=>$('#import-file').click());
$('#import-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>200000)throw new Error('This file is too large to be a garden backup.');
    const data=JSON.parse(await file.text());
    if(data.format!=='tinychao-garden'||data.version!==1||!data.garden)throw new Error('Please choose a Tiny Chao Garden backup.');
    if(!game.importSave||game.importSave(data.garden)===false)throw new Error('This garden backup could not be read.');
    game.save();$('#settings-message').textContent='Your garden is restored. Welcome home!';
  }catch(error){$('#settings-message').textContent=error instanceof SyntaxError?'This is not a valid garden backup.':error.message;}
  event.target.value='';
});
$('#reset-garden').addEventListener('click',()=>{$('#reset-confirm').hidden=false;});
$('#cancel-reset').addEventListener('click',()=>{$('#reset-confirm').hidden=true;});
$('#confirm-reset').addEventListener('click',()=>{game.reset();game.save();$('#reset-confirm').hidden=true;$('#settings-message').textContent='A new little egg is waiting for you.';$('#settings-dialog').close();});
function fallback(){
  if(fallbackMode)return;fallbackMode=true;if(device){cancelAnimationFrame(device.raf);device.resizeObserver.disconnect();device.renderer.dispose();device=null;}document.body.classList.add('fallback');$('#loading').classList.add('done');$('#expand').hidden=true;setExpanded(true);
}
try{
  const { SPConsole }=await import('./console.js');
  device=new SPConsole($('#console'),game,input,()=>{$('#loading').classList.add('done');});
}catch(error){console.warn('Using 2D garden view:',error);fallback();}
const shortLandscape=matchMedia('(orientation: landscape) and (max-height: 500px)');
function fitOrientation(){if(shortLandscape.matches&&!expanded){setExpanded(true);autoLandscape=true;}else if(!shortLandscape.matches&&autoLandscape){setExpanded(false);autoLandscape=false;}}
shortLandscape.addEventListener('change',fitOrientation);fitOrientation();
function refreshStatus(){
  const status=game.accessibleStatus();
  if(status!==previousStatus){$('#game-status').textContent=status;previousStatus=status;}
  const state=game.state;
  const hatched=state.hatched||state.chao?.hatched||state.egg?.hatched||state.stage==='chao';
  const name=state.name||state.chao?.name||'Your Chao';
  $('#garden-caption').textContent=game.notice&&game.noticeTime>0?game.notice:hatched?(state.belly<25?`${name} could use a little fruit.`:game.anim?.kind==='sleep'?`${name} is taking a little nap.`:`A little time with ${name}.`):'Tap the egg, or press A to hatch.';
  $('.stage-caption').classList.toggle('save-warning',Boolean(game.storageError));
  $('#save-caption').textContent=game.storageError?'SAVING UNAVAILABLE — EXPORT A BACKUP':'SAVED ON THIS DEVICE';
}
function frame(now){
  requestAnimationFrame(frame);
  if(document.hidden)return;
  if(now-previousTime<1000/30)return;
  const dt=Math.min(.1,(now-(previousTime||now))/1000);previousTime=now;
  if(!$('dialog[open]'))game.update(dt);
  audio.setScene(game.mode);
  if(!expanded)device?.updateScreen();
  if(expanded){largeContext.imageSmoothingEnabled=false;largeContext.drawImage(game.canvas,0,0);}
  if(now-lastStatusTime>1200){refreshStatus();lastStatusTime=now;}
}
requestAnimationFrame(frame);
window.addEventListener('blur',()=>{for(const id of holds.keys())stopHold(id);game.save();});
window.addEventListener('pagehide',()=>{game.save();audio.suspend();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){game.save();audio.suspend();for(const id of holds.keys())stopHold(id);}else{previousTime=performance.now();if(!$('dialog[open]'))audio.resume();}});
// Available only in a local preview or when explicitly requested for verification.
if(['localhost','127.0.0.1'].includes(location.hostname)||new URLSearchParams(location.search).has('debug'))window.tinyChao={game,get device(){return device;},audio,input,setExpanded};
