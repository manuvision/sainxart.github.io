/* Tiny Chao Garden — a small, persistent fan-made garden for a 240×160 screen. */
import { getChaoSprite, walkDirection } from './sprites.js';
import { EGGS, getEgg, EGG_REFRESH_MS, makeEggWeights, restoreEggWeights, rollEggStock, snapshotChao, collectEggUnlocks, isEggUnlocked, eggHint } from './eggs.js?v=20260908-3';
export { EGGS } from './eggs.js?v=20260908-3';
export const SAVE_KEY = 'tinychao.garden.v3';
export const FRUITS = [
  { id: 'orange', name: 'ORANGE FRUIT', price: 30, belly: 25, mood: 8, stat: 'swim', xp: 30, sprite: 0, gains: [30,-20,-20,30,10] },
  { id: 'blue', name: 'BLUE FRUIT', price: 60, belly: 15, mood: 0, stat: 'fly', xp: 50, sprite: 1, gains: [20,50,-10,-10,30] },
  { id: 'pink', name: 'PINK FRUIT', price: 55, belly: 25, mood: 16, stat: 'run', xp: 40, sprite: 2, gains: [40,-30,40,-30,20] },
  { id: 'green', name: 'GREEN FRUIT', price: 50, belly: 15, mood: -8, stat: 'power', xp: 40, sprite: 3, gains: [0,-10,30,40,20] },
  { id: 'purple', name: 'PURPLE FRUIT', price: 30, belly: 25, mood: 8, stat: 'fly', xp: 30, sprite: 4, gains: [-20,30,30,-20,10] },
  { id: 'yellow', name: 'YELLOW FRUIT', price: 55, belly: 25, mood: 16, stat: 'power', xp: 40, sprite: 5, gains: [-30,40,-30,40,20] },
  { id: 'red', name: 'RED FRUIT', price: 70, belly: 0, mood: -24, stat: 'run', xp: 30, sprite: 6, gains: [30,10,30,20,-50] },
];
export const TOYS = [{ id: 'trumpet', name: 'TRUMPET', price: 1000 }, { id: 'duck', name: 'RUBBER DUCK', price: 2000 }, { id: 'tv', name: 'TELEVISION', price: 8000 }];
const STATS = ['swim', 'fly', 'run', 'power', 'stamina'];
const COLORS = { navy: '#23345c', blue: '#427bd6', ink: '#182e58', cream: '#fff5bd', white: '#fffdf0', green: '#3be084', yellow: '#ffe547', pink: '#ff82be' };
const FONT = {
  A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['111','010','010','010','010','010','111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','11011','10001'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
  0:['01110','10001','10011','10101','11001','10001','01110'],1:['010','110','010','010','010','010','111'],2:['01110','10001','00001','00010','00100','01000','11111'],3:['11110','00001','00001','01110','00001','00001','11110'],4:['00010','00110','01010','10010','11111','00010','00010'],5:['11111','10000','10000','11110','00001','00001','11110'],6:['01110','10000','10000','11110','10001','10001','01110'],7:['11111','00001','00010','00100','01000','01000','01000'],8:['01110','10001','10001','01110','10001','10001','01110'],9:['01110','10001','10001','01111','00001','00001','01110'],
  '!':['1','1','1','1','1','0','1'],'?':['1110','0001','0001','0110','0100','0000','0100'],'.':['0','0','0','0','0','0','1'],':':['0','1','0','0','1','0','0'],'-':['000','000','000','111','000','000','000'],'/':['0001','0001','0010','0010','0100','1000','1000'],'+':['000','010','010','111','010','010','000'],"'":['1','1','0','0','0','0','0'],'<':['001','010','100','010','001','000','000'],'>':['100','010','001','010','100','000','000'],'(':['01','10','10','10','10','10','01'],')':['10','01','01','01','01','01','10'],'=':['000','000','111','000','111','000','000'],
};
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : a));
const rand = (a, b) => a + Math.random() * (b - a);
const int = (n) => Math.floor(n);
const shuffle = (items) => { const a = [...items]; for (let i = a.length - 1; i > 0; i--) { const j = int(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function freshState() {
  const state = { version: 3, color: 'normal', collection: {}, eggUnlocks: ['normal','silver'], eggWeights: makeEggWeights(), eggStock: 'silver', eggRefreshAt: Date.now() + EGG_REFRESH_MS, name: 'CHAO', rings: 120, hatched: false, eggProgress: 0, mood: 80, belly: 75, energy: 90,
    inventory: { orange: 0, blue: 0, pink: 0, green: 0, purple: 0, yellow: 0, red: 0 }, toys: [],
    stats: Object.fromEntries(STATS.map(k => [k, { level: 0, xp: 0 }])),
    x: 88, y: 105, totalHatches: 0, totalFeeds: 0, totalPets: 0, totalRingsEarned: 0, bestMemory: 0, bestJanken: 0,
    played: 0, lastSaved: Date.now() };
  state.collection.normal = snapshotChao(state);
  return state;
}

export function restoreState(raw, now = Date.now(), withCollection = true) {
  const clean = freshState();
  if (!raw || raw.version !== 3) return clean;
  clean.name = typeof raw.name === 'string' ? raw.name.replace(/[^A-Z0-9 ]/gi, '').slice(0, 8).toUpperCase() || 'CHAO' : 'CHAO';
  clean.hatched = !!raw.hatched;
  clean.eggProgress = clamp(Number(raw.eggProgress), 0, 12);
  clean.rings = int(clamp(Number(raw.rings), 0, 99999));
  for (const key of ['mood', 'belly', 'energy']) clean[key] = clamp(Number(raw[key]));
  for (const key of ['totalHatches', 'totalFeeds', 'totalPets', 'totalRingsEarned', 'bestMemory', 'bestJanken', 'played']) clean[key] = clamp(Number(raw[key]), 0, 1e9);
  for (const fruit of FRUITS) clean.inventory[fruit.id] = int(clamp(Number(raw.inventory?.[fruit.id]), 0, 99));
  clean.toys = Array.isArray(raw.toys) ? [...new Set(raw.toys.filter(k => TOYS.some(t => t.id === k)))] : [];
  for (const key of STATS) clean.stats[key] = { level: int(clamp(Number(raw.stats?.[key]?.level), 0, 99)), xp: clamp(Number(raw.stats?.[key]?.xp), 0, 99) };
  clean.x = clamp(Number(raw.x), 20, 157); clean.y = clamp(Number(raw.y), 38, 132);
  // A garden is a kind place: time away never hurts a Chao. A short rest restores energy.
  const away = Math.max(0, Math.min(8 * 3600, (now - Number(raw.lastSaved || now)) / 1000));
  clean.energy = clamp(clean.energy + away / 120);
  clean.lastSaved = now;
  clean.color = getEgg(raw.color).id;
  clean.eggWeights = restoreEggWeights(raw.eggWeights);
  clean.eggRefreshAt = Number.isFinite(raw.eggRefreshAt) ? clamp(raw.eggRefreshAt, 0, now + EGG_REFRESH_MS) : now + EGG_REFRESH_MS;
  clean.collection = {};
  if (withCollection && raw.collection && typeof raw.collection === 'object') {
    for (const egg of EGGS) {
      const record = raw.collection[egg.id];
      if (record && typeof record === 'object' && typeof record.hatched === 'boolean') {
        const restored = restoreState({ ...record, version:3, color:egg.id, collection:null }, now, false);
        clean.collection[egg.id] = snapshotChao(restored);
      }
    }
  }
  clean.collection[clean.color] = snapshotChao(clean);
  // Existing v3 saves keep their current Chao, name, stats, rings, and all items.
  clean.eggUnlocks = collectEggUnlocks({...clean,eggUnlocks:raw.eggUnlocks});
  clean.eggStock = EGGS.some(egg=>egg.id===raw.eggStock&&!clean.collection[egg.id]&&clean.eggUnlocks.includes(egg.id)) ? raw.eggStock :
    !clean.collection.silver ? 'silver' : rollEggStock(clean.collection,clean.eggWeights,Math.random,clean.eggUnlocks);
  return clean;
}

export class TinyGarden {
  constructor({ onSound = () => {}, onChange = () => {} } = {}) {
    this.onSound = onSound; this.onChange = onChange;
    this.canvas = document.createElement('canvas'); this.canvas.width = 240; this.canvas.height = 160;
    this.canvas.setAttribute?.('aria-label', 'Tiny Chao Garden game screen');
    this.ctx = this.canvas.getContext('2d', { alpha: false }); this.ctx.imageSmoothingEnabled = false;
    this.state = freshState(); this.storageError = false;
    try { this.state = restoreState(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch (error) { this.storageError = error instanceof SyntaxError ? false : true; }
    this.mode = 'garden'; this.time = 0; this.autosave = 0; this.selection = 0; this.gardenAction = 0;
    this.cursor = { x: this.state.x + 20, y: this.state.y - 7, visible: 0 };
    this.anim = { kind: this.state.hatched ? 'idle' : 'egg', remaining: 0, facing: 1, targetX: this.state.x, targetY: this.state.y, next: 5 };
    this.effects = []; this.notice = this.state.hatched ? `WELCOME BACK, ${this.state.name}!` : 'PRESS A TO RUB THE EGG'; this.noticeTime = 5;
    this.hatchTime = 0; this.memory = null; this.janken = null; this.result = null; this.art = {}; this.nameChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split(''); this.renameIndex = 0;
    this.loadArt(); this.render(); this.changed();
  }

  loadArt() {
    if (typeof Image === 'undefined') return;
    for (const file of ['garden', 'chao', 'minigames', 'original-ui', 'original-shop', 'original-name']) {
      const img = new Image();
      img.onload = () => { this.art[file] = img; if (file === 'chao') this.makeTransparent(img); if(file==='minigames'){this.makeTransparent(img,'white','minigamesTransparent');this.makeTransparent(img,'blue','jankenCursor');} this.render(); };
      img.src = new URL(`./assets/${file}.png`, import.meta.url).href;
    }
  }

  makeTransparent(img, key='green', target='chaoTransparent') {
    try {
      const sheet = document.createElement('canvas'); sheet.width = img.naturalWidth || img.width; sheet.height = img.naturalHeight || img.height;
      const c = sheet.getContext('2d'); c.drawImage(img, 0, 0); const image = c.getImageData(0, 0, sheet.width, sheet.height);
      for (let i = 0; i < image.data.length; i += 4) if (key==='blue' ? !(image.data[i+2]>image.data[i]&&image.data[i+2]>=192) : key==='white' ? image.data[i]===255&&image.data[i+1]===255&&image.data[i+2]===255 : image.data[i] < 12 && image.data[i + 1] > 245 && image.data[i + 2] < 12) image.data[i + 3] = 0;
      c.putImageData(image, 0, 0); this.art[target] = sheet;
    } catch { /* optional atlas unavailable */ }
  }

  sound(name) { try { this.onSound(name); } catch {} }
  changed() { try { this.onChange({ mode: this.mode, name: this.state.name, hatched: this.state.hatched, rings: this.state.rings, mood: this.state.mood, belly: this.state.belly, energy: this.state.energy, status: this.accessibleStatus() }); } catch {} }
  save() { this.refreshEggUnlocks(); this.state.collection[this.state.color] = snapshotChao(this.state); this.state.lastSaved = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); this.storageError = false; } catch { this.storageError = true; } this.changed(); }
  exportSave() { this.save(); return JSON.parse(JSON.stringify(this.state)); }
  importSave(data) { if (typeof data === 'string') { try { data = JSON.parse(data); } catch { throw new Error('This file is not a valid garden save.'); } } if (!data || data.version !== 3 || typeof data.hatched !== 'boolean' || !Number.isFinite(data.rings) || !data.stats || !data.inventory) throw new Error('This file is not a Tiny Chao Garden save.'); this.state = restoreState(data); this.mode = 'garden'; this.hatchTime = 0; this.anim = { kind: this.state.hatched ? 'idle' : 'egg', remaining: 0, facing: 1, targetX: this.state.x, targetY: this.state.y, next: 5 }; this.effects = []; this.message(`WELCOME HOME, ${this.state.name}!`); this.save(); this.render(); return true; }
  reset() { this.state = freshState(); this.mode = 'garden'; this.gardenAction = 0; this.heldItem = null; this.cursor = { x: 108, y: 98, visible: 0 }; this.anim = { kind: 'egg', remaining: 0, facing: 1, next: 5, targetX: 88, targetY: 105 }; this.hatchTime = 0; this.effects = []; this.message('A NEW EGG! PRESS A TO RUB', 5); this.save(); this.render(); }
  accessibleStatus() {
    if (this.mode === 'garden') return this.state.hatched ? `${this.state.name}: belly ${Math.round(this.state.belly)}%, happiness ${Math.round(this.state.mood)}%, energy ${Math.round(this.state.energy)}%. ${this.state.rings} rings. ${this.notice || 'A interacts. L opens the shop. R selects a loose fruit. A picks it up; bring it to your Chao. The two GBA icons start mini games. Start opens the menu.'}` : `An egg is waiting to hatch. Press A or tap the egg. ${Math.round(this.state.eggProgress / 12 * 100)}% hatched.`;
    if (this.mode === 'friends') { const egg=EGGS[this.selection];return `Chao Friends. ${Object.keys(this.state.collection).length} of 12 collected. ${egg.name}, ${egg.rarity}. ${this.state.collection[egg.id]?'Press A to visit. Your other Chao stays saved.':isEggUnlocked(egg.id,this.state)?`${egg.price} rings in the rotating egg shop.`:`Still a mystery. ${eggHint(egg.id)}`}`; }
    if (this.mode === 'memory') return `Chao Memory. ${this.memory?.pairs || 0} pairs found. ${this.memory?.mistakes || 0} mistakes. Use the direction pad and A to reveal a card.`;
    if (this.mode === 'janken') return `Chao Janken. ${Math.ceil(this.janken?.remaining || 0)} seconds. ${this.janken?.rings || 0} rings earned. Left or right selects a hand. A shoots.`;
    return `${this.mode}. ${this.notice || ''}`;
  }
  message(text, duration = 3) { this.notice = text; this.noticeTime = duration; this.changed(); }
  gainRings(n) { this.state.rings = Math.min(99999, this.state.rings + n); this.state.totalRingsEarned += n; this.save(); }
  addXP(key, amount) { const s = this.state.stats[key]; s.xp = Math.max(0, s.xp + amount); let levels = 0; while (s.xp >= 100 && s.level < 99) { s.xp -= 100; s.level++; levels++; } if (s.level === 99) s.xp = Math.min(s.xp, 99); if (levels) { this.sound('levelup'); this.message(`${key.toUpperCase()} LEVEL UP!`, 4); this.particles(this.state.x, this.state.y - 20, 'star', 10); } }
  particles(x, y, type = 'heart', count = 4) { for (let i = 0; i < count; i++) this.effects.push({ x: x + rand(-12, 12), y: y + rand(-5, 4), vx: rand(-6, 6), vy: rand(-16, -8), life: rand(0.6, 1.4), max: 1.4, type }); }

  hatch() {
    if (this.state.hatched || this.hatchTime) return;
    this.hatchTime = 1.5; this.state.eggProgress = 12; this.anim.kind = 'hatch'; this.anim.remaining = 1.5;
    this.sound('hatch'); this.message('... A TINY FRIEND IS HATCHING!', 3); this.particles(this.state.x, this.state.y - 10, 'star', 18);
  }
  pet() {
    if (!this.state.hatched) { this.state.eggProgress = Math.min(12, this.state.eggProgress + 1); this.anim.remaining = .42; this.sound('egg'); this.particles(this.state.x, this.state.y - 16, 'star', 2); this.message(this.state.eggProgress > 8 ? 'CRACK... KEEP GOING!' : this.state.eggProgress > 4 ? 'IT IS WIGGLING!' : 'A LITTLE WARMTH...', 2); if (this.state.eggProgress >= 12) this.hatch(); this.save(); return; }
    if (this.anim.kind === 'eat' && this.anim.remaining > 0) return;
    this.state.mood = clamp(this.state.mood + 7); this.state.totalPets++; this.anim.kind = 'happy'; this.anim.remaining = 2.4; this.anim.next = 4;
    this.sound('pet'); this.particles(this.state.x, this.state.y - 25, 'heart', 5); this.message(`${this.state.name} LOVES THAT!`, 2.6); this.save();
  }
  feed(fruitID) {
    if (!this.state.hatched) { this.message('HATCH YOUR EGG FIRST!'); this.sound('error'); return false; }
    const fruit = FRUITS.find(f => f.id === fruitID);
    if (!fruit || !this.state.inventory[fruit.id]) { this.message('NO FRUIT IN YOUR BAG'); this.sound('error'); return false; }
    this.state.inventory[fruit.id]--; this.state.belly = clamp(this.state.belly + fruit.belly); this.state.mood = clamp(this.state.mood + fruit.mood); this.state.energy = clamp(this.state.energy + 8); this.state.totalFeeds++;
    STATS.forEach((stat, i) => this.addXP(stat, fruit.gains[i]));
    this.anim.kind = 'eat'; this.anim.remaining = 3.5; this.anim.next = 5; this.heldFruit = fruit; this.mode = 'garden'; this.sound('eat'); this.message(`YUM! ${fruit.stat.toUpperCase()} +${fruit.xp}`, 3.5); this.particles(this.state.x, this.state.y - 23, 'heart', 4); this.save(); return true;
  }
  buy(index) {
    if(index === 'egg') return this.buyEgg();
    const item = [...FRUITS, ...TOYS][index]; if (!item) return false;
    if (index >= FRUITS.length && this.state.toys.includes(item.id)) { this.message('ALREADY IN YOUR GARDEN'); this.sound('error'); return false; }
    if (this.state.rings < item.price) { this.message('NEED MORE RINGS! PLAY A GAME.'); this.sound('error'); return false; }
    if (index < FRUITS.length && Object.values(this.state.inventory).reduce((a,b) => a+b, 0) >= 8) { this.message('YOUR BAG IS FULL - 8 FRUIT MAX'); this.sound('error'); return false; }
    this.state.rings -= item.price; if (index < FRUITS.length) this.state.inventory[item.id]++; else this.state.toys.push(item.id);
    this.sound('buy'); this.message(`${item.name} IS YOURS!`); this.save(); return true;
  }
  enter(mode) { this.mode = mode; if(mode==='rename'){this.nameDraft=this.state.name;this.nameCaret=this.nameDraft.length;this.renameIndex=0;} this.selection = 0; this.sound('select'); this.notice = ''; this.noticeTime = 0; this.changed(); }
  activateGarden() {
    const { x, y } = this.cursor;
    if(x>=176){if(y<30&&this.state.hatched){this.nameDraft=this.state.name;this.renameIndex=0;this.enter('rename');}else this.enter('stats');return;}
    if (y < 25 && x >= 109) return this.enter(x < 140 ? 'jankenIntro' : 'memoryIntro');
    if (this.heldItem) { if (Math.hypot(x - this.state.x, y - this.state.y) < 30) { const item = this.heldItem; this.heldItem = null; return this.feed(item); } this.heldItem = null; this.sound('move'); return; }
    const item = this.groundFruit().find(f => Math.hypot(x - f.x, y - f.y) < 12);
    if (item && this.state.hatched) { this.heldItem = item.id; this.sound('move'); this.message('BRING THE FRUIT TO YOUR CHAO'); return; }
    if (Math.hypot(x - this.state.x, y - this.state.y) < 35 || !this.state.hatched) this.pet();
  }
  groundFruit() { const fruit = []; for (const f of FRUITS) for (let i = 0; i < this.state.inventory[f.id]; i++) { const n = fruit.length; if (n >= 8) return fruit; fruit.push({ id: f.id, sprite: f.sprite, x: 19 + n % 4 * 24, y: 61 + int(n / 4) * 25 }); } return fruit; }
  shopItems() { const fruit = FRUITS.map((f,index)=>({...f,index})); const next = TOYS.findIndex(t=>!this.state.toys.includes(t.id)); const egg=this.state.eggStock?{...getEgg(this.state.eggStock),index:'egg'}:null; return [...fruit,...(egg?[egg]:[]),...(next<0?[]:[{...TOYS[next],index:FRUITS.length+next}])]; }
  refreshEggUnlocks(announce=false) {
    const previous=this.state.eggUnlocks||[],unlocked=collectEggUnlocks(this.state),fresh=unlocked.filter(id=>!previous.includes(id));
    this.state.eggUnlocks=unlocked;
    const newOffer=fresh.find(id=>id!=='normal'&&!this.state.collection[id]);
    if(newOffer){this.state.eggStock=newOffer;this.state.eggRefreshAt=Date.now()+EGG_REFRESH_MS;if(announce){this.message('A NEW EGG HAS FOUND YOUR SHOP!',6);this.sound('levelup');}}
    return fresh;
  }
  refreshEggStock() { this.state.collection[this.state.color]=snapshotChao(this.state); const fresh=this.refreshEggUnlocks();this.state.eggStock=fresh.find(id=>id!=='normal'&&!this.state.collection[id])||rollEggStock(this.state.collection,this.state.eggWeights,Math.random,this.state.eggUnlocks);this.state.eggRefreshAt=Date.now()+EGG_REFRESH_MS; }

  buyEgg() {
    const egg=this.state.eggStock&&getEgg(this.state.eggStock);
    if(!egg||this.state.collection[egg.id]) { this.message(Object.keys(this.state.collection).length===EGGS.length?'YOU HAVE EVERY EGG!':'KEEP PLAYING. MORE EGGS WILL FIND YOU.'); this.sound('error'); return false; }
    if(!isEggUnlocked(egg.id,this.state)){this.message(eggHint(egg.id),5);this.sound('error');return false;}
    if(!this.state.hatched||Object.entries(this.state.collection).some(([id,chao])=>id!==this.state.color&&!chao.hatched)) { this.message('HATCH YOUR WAITING EGG FIRST!'); this.sound('error'); return false; }
    if(this.state.rings<egg.price) { this.message(`${egg.name} EGG: ${egg.price} RINGS. PLAY TO EARN!`); this.sound('error'); return false; }
    this.state.collection[this.state.color]=snapshotChao(this.state);
    this.state.collection[egg.id]=snapshotChao({...freshState(),color:egg.id});
    this.state.rings-=egg.price; this.refreshEggStock(); this.enter('friends'); this.selection=EGGS.indexOf(egg);
    this.sound('buy'); this.message(`${egg.name} EGG! A: HATCH. YOUR CHAO IS SAFE.`,6); this.save(); return true;
  }
  visitFriend(index) {
    const egg=EGGS[index],friend=egg&&this.state.collection[egg.id];
    if(!friend) { this.message(isEggUnlocked(egg?.id,this.state)?'FIND THIS EGG IN THE SHOP. STOCK CHANGES AFTER GAMES.':eggHint(egg?.id),5); this.sound('error'); return false; }
    this.state.collection[this.state.color]=snapshotChao(this.state);
    const selected=this.state.collection[egg.id]; Object.assign(this.state,snapshotChao(selected));
    this.heldItem=null;this.heldFruit=null;this.effects=[];this.hatchTime=0;
    this.cursor={x:this.state.x+20,y:this.state.y-7,visible:0};
    this.anim={kind:this.state.hatched?'idle':'egg',remaining:0,facing:1,targetX:this.state.x,targetY:this.state.y,next:5};
    this.enter('garden');this.message(this.state.hatched?`WELCOME HOME, ${this.state.name}!`:`A ${egg.name} EGG! TAP OR PRESS A TO HATCH.`,5);this.save();return true;
  }
  input(key) {
    key = String(key).toLowerCase();
    if (!['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select', 'l', 'r'].includes(key)) return;
    if (key === 'select' && ['garden', 'stats'].includes(this.mode)) { this.enter(this.mode === 'stats' ? 'garden' : 'stats'); this.render(); return; }
    if (key === 'start' && this.mode === 'rename') { this.finishName(); this.render(); return; }
    if (key === 'start') {
      if (['memory', 'janken'].includes(this.mode)) { this.pausedMode = this.mode; this.enter('pause'); }
      else if (this.mode === 'pause') { this.mode = this.pausedMode; this.sound('select'); }
      else if (this.mode === 'garden') this.enter('menu');
      else if (this.mode === 'menu') this.enter('garden');
      else this.enter('menu');
      this.render(); return;
    }
    if (key === 'b') {
      if (this.mode === 'garden') { this.enter('menu'); }
      else if (this.mode === 'pause') { this.mode = this.pausedMode; this.sound('select'); }
      else if (['memory', 'janken'].includes(this.mode)) { this.pausedMode = this.mode; this.enter('pause'); }
      else if (this.mode === 'rename') { this.nameCaret=Math.min(this.nameCaret??this.nameDraft.length,this.nameDraft.length);if(this.nameCaret>0){this.nameDraft=this.nameDraft.slice(0,this.nameCaret-1)+this.nameDraft.slice(this.nameCaret);this.nameCaret--;}this.sound('move'); }
      else { this.enter('garden'); this.save(); }
      this.render(); return;
    }
    const delta = ['down', 'right', 'r'].includes(key) ? 1 : ['up', 'left', 'l'].includes(key) ? -1 : 0;
    if (this.mode === 'garden') {
      if (key === 'a') this.activateGarden();
      else if (key === 'l') this.enter('shop');
      else if (key === 'r') { const fruit = this.groundFruit(); if (fruit.length) { this.fruitShortcut = ((this.fruitShortcut ?? -1) + 1) % fruit.length; this.cursor = { x: fruit[this.fruitShortcut].x, y: fruit[this.fruitShortcut].y, visible: 3 }; this.sound('move'); this.message('A: PICK UP FRUIT. BRING IT TO CHAO.'); } else { this.message('PRESS L TO BUY SOME FRUIT'); this.sound('error'); } }
      else if (delta) { this.cursor.x = clamp(this.cursor.x + (key === 'right' ? 8 : key === 'left' ? -8 : 0), 8, 232); this.cursor.y = clamp(this.cursor.y + (key === 'down' ? 8 : key === 'up' ? -8 : 0), 8, 151); this.cursor.visible = 2; this.sound('move'); }
    } else if (this.mode === 'bag' || this.mode === 'shop') {
      const n = this.mode === 'bag' ? FRUITS.length : this.shopItems().length;
      if (key === 'l' && this.mode === 'shop') this.enter('garden');
      else if (delta) { this.selection = (this.selection + delta + n) % n; this.sound('move'); }
      if (key === 'a') { if (this.mode === 'bag') this.feed(FRUITS[this.selection].id); else { this.buy(this.shopItems()[this.selection]?.index); if(this.mode==='shop')this.selection = Math.min(this.selection,this.shopItems().length-1); } }
    } else if (this.mode === 'menu') {
      if (delta) { this.selection = (this.selection + delta + 7) % 7; this.sound('move'); }
      if (key === 'a') {
        const destination = ['garden', 'bag', 'shop', 'games', 'rename', 'stats', 'friends'][this.selection];
        if (destination === 'rename') { this.nameDraft = this.state.name; this.renameIndex = 0; }
        this.enter(destination);
      }
    } else if (this.mode === 'friends') {
      if(delta){const step=key==='down'?4:key==='up'?-4:delta;this.selection=(this.selection+step+EGGS.length)%EGGS.length;this.sound('move');}
      if(key==='a')this.visitFriend(this.selection);
    } else if (this.mode === 'games') {
      if (delta) { this.selection = (this.selection + 1) % 2; this.sound('move'); }
      if (key === 'a') this.enter(this.selection ? 'jankenIntro' : 'memoryIntro');
    } else if (this.mode === 'memoryIntro') { if (key === 'a') this.startMemory(); }
    else if (this.mode === 'jankenIntro') { if (key === 'a') this.startJanken(); }
    else if (this.mode === 'memory') {
      const m = this.memory;
      if (delta) { const shift = key === 'down' ? 6 : key === 'up' ? -6 : delta; m.cursor = (m.cursor + shift + 30) % 30; this.sound('move'); }
      if (key === 'a') this.flipCard(m.cursor);
    } else if (this.mode === 'janken') {
      if (delta) { this.janken.hand = (this.janken.hand + delta + 3) % 3; this.sound('move'); }
      if (key === 'a') this.shoot();
    } else if (this.mode === 'pause') {
      if (delta) { this.selection = 1 - this.selection; this.sound('move'); }
      if (key === 'a') { if (!this.selection) { this.mode = this.pausedMode; this.sound('select'); } else { this.finishGame(this.pausedMode, true); } }
    } else if (this.mode === 'result') {
      if (delta) { this.selection = 1 - this.selection; this.sound('move'); }
      if (key === 'a') { if (this.selection) this.enter('garden'); else this.result.game === 'memory' ? this.startMemory() : this.startJanken(); }
    } else if (this.mode === 'stats') { if (key === 'a') this.enter('garden'); }
    else if (this.mode === 'rename') {
      if(key==='l'||key==='r'){this.nameCaret=clamp((this.nameCaret??this.nameDraft.length)+(key==='l'?-1:1),0,this.nameDraft.length);this.sound('move');}
      else if (delta) { const here=this.renamePosition(this.renameIndex),candidates=Array.from({length:40},(_,i)=>({i,...this.renamePosition(i)})).filter(p=>key==='right'?p.x>here.x:key==='left'?p.x<here.x:key==='down'?p.y>here.y:p.y<here.y);candidates.sort((a,b)=>{const score=p=>['left','right'].includes(key)?Math.abs(p.x-here.x)+Math.abs(p.y-here.y)*2:Math.abs(p.y-here.y)+Math.abs(p.x-here.x)*2;return score(a)-score(b);});if(candidates.length)this.renameIndex=candidates[0].i;this.sound('move'); }
      if (key === 'a') this.chooseName(this.renameIndex);
    }
    this.changed(); this.render();
  }

  touch(x, y) {
    x = clamp(x, 0, 239); y = clamp(y, 0, 159);
    if (this.mode === 'garden') {
      this.cursor = { x, y, visible: 2 };
      if (x >= 176) {
        if (y < 30 && this.state.hatched) { this.nameDraft = this.state.name; this.renameIndex = 0; this.enter('rename'); }
        else this.enter('stats');
      } else if (y < 25 && x >= 109) this.enter(x < 140 ? 'jankenIntro' : 'memoryIntro');
      else if (this.heldItem && Math.hypot(x - this.state.x, y - (this.state.y - 12)) < 29) { const item = this.heldItem; this.heldItem = null; this.feed(item); }
      else if (!this.state.hatched || Math.hypot(x - this.state.x, y - (this.state.y - 12)) < 23) this.pet();
      else if (this.state.toys.includes('trumpet') && Math.hypot(x - 142, y - 112) < 16) this.playToy('trumpet');
      else if (this.state.toys.includes('tv') && Math.hypot(x - 138, y - 61) < 17) this.playToy('tv');
      else if (this.state.toys.includes('duck') && x < 57 && y > 106) this.playToy('duck');
      else this.activateGarden();
    } else if (x < 30 && y < 19 && !['memory','janken','shop'].includes(this.mode)) { this.input('b'); return; }
    else if (this.mode === 'shop') {
      if (x > 48) { this.enter('garden'); return; }
      if (y < 12) { this.enter('garden'); return; }
      const row = y >= 140 ? this.shopItems().findIndex(item=>typeof item.index==='number'&&item.index>=FRUITS.length) : y >= 124 ? this.shopItems().findIndex(item=>item.index==='egg') : int((y - 12) / 16);
      if (row >= 0 && row < this.shopItems().length) { if (this.selection === row) this.input('a'); else { this.selection = row; this.sound('move'); } }
    }
    else if (this.mode === 'bag') {
      if (y > 127) { this.input('a'); return; }
      const col = x >= 120 ? 1 : 0; const row = int((y - 23) / 20); const index = row * 2 + col;
      if (row >= 0 && index < (this.mode === 'shop' ? FRUITS.length + TOYS.length : FRUITS.length)) { this.selection = index; this.sound('move'); }
    } else if (this.mode === 'menu') { const i = int((y - 31) / 14); if (i >= 0 && i < 7) { this.selection = i; this.input('a'); return; } }
    else if (this.mode === 'friends') { const col=int((x-8)/56),row=int((y-25)/34);if(col>=0&&col<4&&row>=0&&row<3){const index=row*4+col;if(this.selection===index)this.visitFriend(index);else {this.selection=index;this.sound('move');}} }
    else if (this.mode === 'games') { if (y > 36 && y < 121) { this.selection = y > 79 ? 1 : 0; this.input('a'); return; } }
    else if (this.mode === 'memory') { const col = int(x / 32), row = int(y / 32); if (col >= 0 && col < 6 && row >= 0 && row < 5) { this.memory.cursor = row * 6 + col; this.flipCard(this.memory.cursor); } }
    else if (this.mode === 'janken') { if (y > 118) { this.janken.hand = clamp(Math.round((x - 26) / 66), 0, 2); this.sound('move'); } else this.shoot(); }
    else if (this.mode === 'pause') { if (y > 96) this.selection = 1; else this.selection = 0; this.input('a'); return; }
    else if (this.mode === 'result') { this.selection = y > 133 ? 1 : 0; this.input('a'); return; }
    else if (this.mode === 'rename') {
      if(x>=159&&y>=94&&y<111){this.finishName();return;}
      if(x>=159&&y>=111&&y<128){this.enter('garden');return;}
      if(x>=159&&y>=78&&y<94){this.nameCaret=clamp((this.nameCaret??this.nameDraft.length)+(x<198?-1:1),0,this.nameDraft.length);this.sound('move');}
      const col=int((x-12)/16),row=int((y-26)/19),index=row*8+col;
      if(col>=0&&col<8&&row>=0&&row<5&&index<38){this.renameIndex=index;this.chooseName(index);}
    }
    else this.input('a');
    this.changed(); this.render();
  }

  renamePosition(index){return index<38?{x:20+index%8*16,y:35+int(index/8)*19}:index===38?{x:193,y:102}:{x:195,y:118};}
  chooseName(index) { if (index === 37) { this.nameDraft = this.nameDraft.slice(0, -1); this.nameCaret=this.nameDraft.length;this.sound('move'); } else if(index===39)this.enter('garden');else if (index === 38) this.finishName(); else if (this.nameDraft.length < 8) { const caret=this.nameCaret??this.nameDraft.length;this.nameDraft=this.nameDraft.slice(0,caret)+this.nameChars[index]+this.nameDraft.slice(caret);this.nameCaret=caret+1;this.sound('move'); } else this.sound('error'); }
  finishName() { this.state.name = this.nameDraft.trim() || 'CHAO'; this.enter('garden'); this.message(`HELLO, ${this.state.name}!`); this.save(); }
  playToy(type) { this.anim.kind = type === 'duck' ? 'swim' : 'play'; this.anim.remaining = 7; this.anim.next = 10; this.state.mood = clamp(this.state.mood + 12); this.state.energy = clamp(this.state.energy - 3); this.addXP(type === 'duck' ? 'swim' : 'stamina', 15); if (type === 'duck') { this.state.x = 42; this.state.y = 126; } this.sound('play'); this.message(type === 'duck' ? 'SPLISH, SPLASH!' : type === 'trumpet' ? 'TOOT TOOT! A LITTLE SONG!' : 'A LITTLE TV TIME!'); this.save(); }

  startMemory() {
    const values = shuffle([...Array.from({ length: 7 }, (_, i) => i).flatMap(value => [value, value]), ...new Array(16).fill(null)]);
    this.memory = { cards: values, matched: new Array(30).fill(false), open: [], cursor: values.findIndex(v => v !== null), pairs: 0, mistakes: 0, rings: 0, preview: 3, delay: 0, elapsed: 0, shuffles: 3, shuffleDelay: .65, moved: -1 };
    this.mode = 'memory'; this.notice = ''; this.sound('game'); this.changed(); this.render();
  }
  flipCard(i) {
    const m = this.memory; if (!m || m.preview > 0 || m.shuffles > 0 || m.delay > 0 || m.cards[i] === null || m.matched[i] || m.open.includes(i) || m.open.length >= 2) return;
    m.open.push(i); this.sound('flip');
    if (m.open.length === 2) {
      if (m.cards[m.open[0]] === m.cards[m.open[1]]) { m.open.forEach(index => { m.matched[index] = true; const depth = Math.min(index % 6, 5 - index % 6, int(index / 6), 4 - int(index / 6)); m.rings += [1,3,5][depth]; }); m.open = []; m.pairs++; this.sound('ring'); if (m.pairs === 7) { m.rings += [60,30,10][m.mistakes] || 0; this.finishGame('memory'); } }
      else { m.mistakes++; m.delay = .9; this.sound('error'); }
    }
    this.changed();
  }
  startJanken() {
    this.janken = { remaining: 30, hand: 0, hands: Array.from({ length: 3 }, () => int(Math.random() * 3)), lives: 5, wave: 0, rings: 0, combo: 0, hits: 0, shots: [], cards: [], cooldown: 0, feedback: '', flash: 0, elapsed: 0 };
    this.newJankenWave();
    this.mode = 'janken'; this.notice = ''; this.sound('game'); this.changed(); this.render();
  }
  newJankenWave() { const g = this.janken; g.cards = Array.from({ length: 10 }, (_, i) => ({ hand: int(Math.random() * 3), position: i * 38, x: 14, y: 19, hit: false })); this.positionJankenCards(); }
  positionJankenCards() { for (const c of this.janken.cards) { const p = ((c.position % 380) + 380) % 380; if (p < 132) { c.x = 14 + p; c.y = 14; } else if (p < 190) { c.x = 146; c.y = 14 + p - 132; } else if (p < 322) { c.x = 146 - (p - 190); c.y = 72; } else { c.x = 14; c.y = 72 - (p - 322); } } }

  shoot() {
    const g = this.janken;
    if (!g || this.mode !== 'janken' || g.cooldown > 0 || g.remaining <= 0 || g.hands[g.hand] === null) return;
    const slot = g.hand, hand = g.hands[slot];
    // The selected yellow card leaves its own slot; it is replaced when the shot resolves.
    g.hands[slot] = null; g.cooldown = .12;
    g.shots.push({ slot, hand, x: 14 + slot * 66, y: 124, vy: -210, state: 'flying' });
    this.sound('shoot'); this.changed();
  }
  resolveJankenShot(shot, target = null) {
    const g = this.janken;
    if (shot.state !== 'flying') return;
    const outcome = target ? (shot.hand - target.hand + 3) % 3 : 2;
    // 0 rock, 1 paper, 2 scissors. A win or tie earns a free replacement.
    g.hands[shot.slot] = int(Math.random() * 3);
    if (target && outcome !== 2) {
      shot.state = 'done'; target.hit = true;
      if (outcome === 1) { g.combo++; g.hits++; g.rings++; g.feedback = '+1 RING!'; this.sound('ring'); this.particles(target.x + 12, target.y + 12, 'star', 4); }
      else { g.combo = 0; g.feedback = 'DRAW!'; this.sound('flip'); }
    } else {
      g.combo = 0; g.lives--; g.feedback = target ? 'OH NO!' : 'MISSED'; this.sound('error');
      // Losing cards bounce visibly away from the card they struck.
      shot.state = target ? 'deflected' : 'done'; shot.vx = shot.slot === 2 ? 95 : -95; shot.vy = -45; shot.life = .7;
    }
    g.flash = .6; this.changed();
    if (g.lives <= 0) this.finishGame('janken');
  }
  finishGame(game, quit = false) {
    if (this.mode === 'result') return;
    const round = game === 'memory' ? this.memory : this.janken; const earned = Math.max(0, round?.rings || 0);
    this.result = { game, earned, quit, perfect: game === 'memory' && round?.pairs === 7, pairs: round?.pairs || 0, hits: round?.hits || 0, mistakes: round?.mistakes || 0 };
    this.state[game === 'memory' ? 'bestMemory' : 'bestJanken'] = Math.max(this.state[game === 'memory' ? 'bestMemory' : 'bestJanken'], earned);
    if(!quit)this.refreshEggStock();
    this.state.mood = clamp(this.state.mood + 5); this.gainRings(earned); this.mode = 'result'; this.selection = 0; this.sound('win'); this.changed();
  }

  update(dt) {
    dt = Math.max(0, Math.min(.1, Number(dt) || 0)); this.time += dt; this.autosave += dt;
    if(['garden','memory','janken'].includes(this.mode)){this.state.played+=dt;this.unlockElapsed=(this.unlockElapsed||0)+dt;if(this.unlockElapsed>=1){this.unlockElapsed=0;if(this.refreshEggUnlocks(true).length)this.save();}}
    if (this.noticeTime > 0) { this.noticeTime -= dt; if (this.noticeTime <= 0) this.notice = ''; }
    this.cursor.visible = Math.max(0, this.cursor.visible - dt);
    this.effects = this.effects.filter(e => { e.life -= dt; e.x += e.vx * dt; e.y += e.vy * dt; return e.life > 0; });
    if (this.mode === 'garden') this.updateGarden(dt);
    if (this.mode === 'memory') { const m = this.memory; m.elapsed += dt; m.preview = Math.max(0, m.preview - dt); if (m.preview <= 0 && m.shuffles > 0) { m.shuffleDelay -= dt; if (m.shuffleDelay <= 0) { const occupied = m.cards.map((v,i) => v === null ? -1 : i).filter(i => i >= 0), empty = m.cards.map((v,i) => v === null ? i : -1).filter(i => i >= 0); const from = occupied[int(Math.random() * occupied.length)], to = empty[int(Math.random() * empty.length)]; [m.cards[from],m.cards[to]] = [m.cards[to],m.cards[from]]; m.moved = to; m.shuffles--; m.shuffleDelay = .65; this.sound('move'); } } if (m.delay > 0) { m.delay -= dt; if (m.delay <= 0) { m.open = []; if (m.mistakes >= 3) this.finishGame('memory'); } } }
    if (this.mode === 'janken') {
      const g = this.janken; g.remaining = Math.max(0, g.remaining - dt); g.elapsed += dt; g.cooldown = Math.max(0, g.cooldown - dt); g.flash = Math.max(0, g.flash - dt);
      if (g.remaining <= 0) this.finishGame('janken');
      // Small physics steps catch the first moving card the visible projectile touches.
      // No target, reward or miss is decided at button-press time.
      const steps = Math.max(1, Math.ceil(dt * 120)), step = dt / steps;
      for (let n = 0; n < steps && this.mode === 'janken'; n++) {
        const speed = 24 + g.wave * 8 + g.cards.filter(c => c.hit).length * 3;
        for (const c of g.cards) c.position += speed * step;
        this.positionJankenCards();
        for (const shot of g.shots) {
          if (shot.state === 'deflected') {
            shot.x += shot.vx * step; shot.y += shot.vy * step; shot.vy += 280 * step; shot.life -= step;
            if (shot.life <= 0) shot.state = 'done';
          } else if (shot.state === 'flying') {
            shot.y += shot.vy * step;
            const target = g.cards.filter(c => !c.hit && shot.x + 22 > c.x + 2 && shot.x + 2 < c.x + 22 && shot.y + 22 > c.y + 2 && shot.y + 2 < c.y + 22).sort((a, b) => b.y - a.y)[0];
            if (target) this.resolveJankenShot(shot, target);
            else if (shot.y + 24 < 0) this.resolveJankenShot(shot);
          }
          if (this.mode !== 'janken') break;
        }
        g.shots = g.shots.filter(shot => shot.state !== 'done');
        if (this.mode === 'janken' && g.cards.every(c => c.hit)) { g.wave++; g.remaining += 10; g.feedback = 'CLEAR! +10 SECONDS'; g.flash = .8; this.newJankenWave(); this.sound('win'); this.changed(); }
      }
    }
    if (this.autosave >= 10) { this.autosave = 0; this.save(); }
    this.render();
  }
  updateGarden(dt) {
    if(Date.now()>=this.state.eggRefreshAt){this.refreshEggStock();this.save();}
    const s = this.state, a = this.anim;
    if (this.hatchTime > 0) {
      this.hatchTime -= dt; if (this.hatchTime <= 0) { this.hatchTime = 0; s.hatched = true; s.totalHatches++; a.kind = 'happy'; a.remaining = 4; a.next = 5; this.message(`HELLO! I AM ${s.name}!`, 5); this.sound('chao'); this.particles(s.x, s.y - 20, 'heart', 8); this.save(); }
      return;
    }
    if (!s.hatched) { s.eggProgress = Math.min(12, s.eggProgress + dt / 10); if (s.eggProgress >= 12) this.hatch(); a.remaining = Math.max(0, a.remaining - dt); return; }
    s.belly = clamp(s.belly - dt / 9); s.mood = clamp(s.mood - dt / 30); s.energy = clamp(s.energy + (a.kind === 'sleep' ? dt * 1.6 : -dt / 22));
    if (a.remaining > 0) { a.remaining -= dt; if (a.remaining <= 0) { a.kind = 'idle'; a.next = rand(2, 5); } }
    else {
      a.next -= dt;
      if (a.next <= 0) {
        if (s.energy < 22) { a.kind = 'sleep'; a.remaining = 14; }
        else if (s.toys.length && Math.random() < .22) { this.playToy(s.toys[int(Math.random() * s.toys.length)]); }
        else if (Math.random() < .65) { a.kind = 'walk'; a.targetX = rand(25, 154); a.targetY = rand(41, 132); a.next = rand(5, 10); }
        else { a.kind = ['idle', 'sit', 'happy'][int(Math.random() * 3)]; a.remaining = rand(2, 4); a.next = 3; }
      }
    }
    if (a.kind === 'walk') {
      const dx = a.targetX - s.x, dy = a.targetY - s.y, distance = Math.hypot(dx, dy);
      if (distance > 2) { s.x += dx / distance * dt * 10; s.y += dy / distance * dt * 10; a.facing = dx < 0 ? -1 : 1; a.direction = walkDirection(dx,dy,a.direction); }
      else { a.kind = s.x < 76 && s.y > 121 ? 'swim' : 'idle'; a.remaining = a.kind === 'swim' ? 4 : 0; }
    }
  }

  // All text is drawn as an explicit bitmap font, so it remains crisp at every scale.
  textWidth(text, scale = 1) { let w = 0; for (const char of String(text).toUpperCase()) w += ((FONT[char]?.[0].length || 3) + 1) * scale; return w ? w - scale : 0; }
  text(text, x, y, color = COLORS.ink, scale = 1, shadow = false) {
    const c = this.ctx; let px = Math.round(x); y = Math.round(y); text = String(text).toUpperCase();
    if (shadow) this.text(text, px + scale, y + scale, '#fff9d8', scale, false);
    c.fillStyle = color;
    for (const char of text) { const glyph = FONT[char]; if (!glyph) { px += 4 * scale; continue; } for (let row = 0; row < glyph.length; row++) for (let col = 0; col < glyph[row].length; col++) if (glyph[row][col] === '1') c.fillRect(px + col * scale, y + row * scale, scale, scale); px += (glyph[0].length + 1) * scale; }
  }
  centered(text, x, y, color = COLORS.ink, scale = 1) { this.text(text, x - this.textWidth(text, scale) / 2, y, color, scale); }
  rect(x, y, w, h, color) { this.ctx.fillStyle = color; this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  panel(x, y, w, h, color = '#fff5be', border = '#34497c') { this.rect(x, y, w, h, border); this.rect(x + 1, y + 1, w - 2, h - 2, '#fff9da'); this.rect(x + 2, y + 2, w - 4, h - 4, color); }
  ring(x, y, scale = 1) { this.rect(x + scale, y, 4 * scale, 7 * scale, '#a66314'); this.rect(x, y + scale, 6 * scale, 5 * scale, '#a66314'); this.rect(x + scale, y + scale, 4 * scale, 5 * scale, '#ffe841'); this.rect(x + 2 * scale, y + 2 * scale, 2 * scale, 3 * scale, '#e79b1c'); this.rect(x + 2 * scale, y + 2 * scale, scale, 3 * scale, '#fffca2'); }
  heart(x, y, color = '#ff78a8') { const rows = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000']; rows.forEach((line, dy) => [...line].forEach((v, dx) => { if (v === '1') this.rect(x + dx, y + dy, 1, 1, color); })); }
  star(x, y) { this.rect(x + 2, y, 1, 5, '#fff9a0'); this.rect(x, y + 2, 5, 1, '#fff9a0'); this.rect(x + 1, y + 1, 3, 3, '#ffeb46'); this.rect(x + 2, y + 2, 1, 1, '#fffbea'); }
  fruit(index, x, y, scale = 1) {
    if (this.art.chaoTransparent) {
      this.ctx.drawImage(this.art.chaoTransparent, 657 + clamp(index, 0, 6) * 17, 257, 16, 16, int(x), int(y), 16 * scale, 16 * scale);
    } else { this.rect(x + 6, y + 6, 9, 10, ['#ffd34d', '#ffa334', '#f74136', '#ffd945', '#7ac94d', '#ff918d', '#5880ee'][index]); this.rect(x + 10, y + 3, 2, 4, '#325724'); }
  }
  drawEggSprite(color,x,y) { const egg=getEgg(color);if(this.art.chaoTransparent)this.ctx.drawImage(this.art.chaoTransparent,657+egg.atlas*17,201,16,16,int(x)-8,int(y)-16,16,16); }
  drawEgg(x, y) {
    const shake = this.anim.remaining > 0 || this.hatchTime ? Math.sin(this.time * 45) * 2 : 0; x = int(x + shake); y = int(y);
    if (this.art.chaoTransparent) { this.drawEggSprite(this.state.color,x,y); return; }
    this.rect(x - 10, y - 2, 20, 4, '#268f27');
    const rows = ['000111111000','001111111100','011111111110','011111111110','111111111111','111111111111','111111111111','111111111111','011111111110','001111111100'];
    rows.forEach((line, r) => [...line].forEach((bit, col) => { if (bit === '1') this.rect(x - 12 + col * 2, y - 22 + r * 2, 2, 2, col < 3 || r > 7 ? '#dfcf83' : '#fff4cc'); }));
    this.rect(x - 5, y - 20, 4, 4, '#86be60'); this.rect(x + 5, y - 13, 4, 6, '#87bd61'); this.rect(x - 8, y - 9, 4, 4, '#82b857');
    if (this.state.eggProgress > 5) { this.rect(x, y - 19, 1, 5, '#7c8661'); this.rect(x - 2, y - 14, 3, 1, '#7c8661'); this.rect(x - 2, y - 13, 1, 4, '#7c8661'); }
    if (this.state.eggProgress > 9) { this.rect(x - 7, y - 8, 6, 1, '#7c8661'); this.rect(x - 7, y - 7, 1, 4, '#7c8661'); }
  }
  drawChao(x, y, kind = this.anim.kind, scale = 1, color = this.state.color) {
    x = int(x); y = int(y); const frame = int(this.time * (kind === 'walk' ? 8 : 3)) % 2;
    if(!this.art.chaoTransparent)this.rect(x - 8 * scale, y - 2 * scale, 16 * scale, 3 * scale, kind === 'swim' ? '#77d8e9' : '#209330');
    if (this.art.chaoTransparent) {
      const at = getChaoSprite(kind,this.time,{color,facing:this.anim.facing,direction:kind==='walk'?this.anim.direction:undefined});
      this.ctx.save(); this.ctx.translate(x, y); if (at.flipX) this.ctx.scale(-1, 1); this.ctx.drawImage(this.art.chaoTransparent, at.x, at.y, at.w, at.h, -int(at.w / 2) * scale, -at.h * scale, at.w * scale, at.h * scale); this.ctx.restore();
    } else {
      const bob = kind === 'walk' || kind === 'happy' || kind === 'play' ? frame * scale : 0; y -= bob;
      const p = (dx, dy, w, h, color) => this.rect(x + dx * scale, y + dy * scale, w * scale, h * scale, color);
      p(-5,-13,10,11,'#228da8'); p(-4,-13,8,10,'#7ce9ed'); p(-6,-3,5,3,'#ffd955'); p(2,-3,5,3,'#ffdc51'); p(-9,-12,4,5,'#70deec'); p(6,-12,4,5,'#70deec');
      p(-9,-25,18,13,'#247c9e'); p(-10,-22,20,9,'#247c9e'); p(-8,-26,15,13,'#75e0f0'); p(-9,-22,18,9,'#75e0f0'); p(-6,-27,9,4,'#8fedef'); p(-4,-29,6,3,'#a1efeb'); p(-3,-31,4,3,'#ffe459'); p(-1,-29,4,3,'#ffd853');
      p(-9,-17,3,4,'#ffc453'); p(7,-17,3,4,'#ffd254');
      if (kind === 'sleep' || kind === 'happy') { p(-6,-20,4,1,'#144160'); p(3,-20,4,1,'#144160'); if (kind === 'happy') { p(-5,-21,2,1,'#144160'); p(4,-21,2,1,'#144160'); } }
      else { p(-5,-22,2,4,'#164064'); p(4,-22,2,4,'#164064'); p(-5,-22,1,1,'#fff5c4'); p(4,-22,1,1,'#fff5c4'); }
      p(-1,-16,3,1,'#248ab1'); p(-2,-10,4,4,'#fff2ba');
      p(-2,-40,5,5,kind === 'happy' ? '#fff283' : '#ffdf48'); p(-1,-41,3,1,'#fff0a2'); p(-3,-39,1,3,'#ffdf48');
    }
    if (kind === 'sleep') this.text('Z', x + 8, y - 31 - frame * 3, '#fff5ce');
    if (kind === 'eat' && this.heldFruit) this.fruit(this.heldFruit.sprite, x - 6, y - 17);
    if (kind === 'swim') { this.rect(x - 13, y - 1, 26, 1, '#9ceafa'); this.rect(x - 9, y + 2, 18, 1, '#52b5e5'); }
  }
  drawGarden() {
    if (this.art.garden) this.ctx.drawImage(this.art.garden, 210, 9, 176, 160, 0, 0, 176, 160);
    else { this.rect(0, 0, 176, 160, '#20bf26'); for (let y = 0; y < 160; y += 8) for (let x = 0; x < 176; x += 8) if ((x / 8 + y / 8) % 2) this.rect(x, y, 8, 8, '#20b527'); this.rect(0, 128, 70, 32, '#1598ca'); }
    if (this.art['original-ui']) { this.ctx.drawImage(this.art['original-ui'],112,5,26,15,112,5,26,15); this.ctx.drawImage(this.art['original-ui'],143,5,26,15,143,5,26,15); }
    else if (this.art.chaoTransparent) { this.ctx.drawImage(this.art.chaoTransparent,657,339,24,16,112,4,24,16); this.ctx.drawImage(this.art.chaoTransparent,657,322,24,16,143,4,24,16); }
    let skippedHeld = false;
    for (const f of this.groundFruit()) { if (this.heldItem === f.id && !skippedHeld) { skippedHeld = true; continue; } this.fruit(f.sprite,f.x-8,f.y-8); }
    if (this.state.toys.includes('trumpet')) { if (this.art.chaoTransparent) this.ctx.drawImage(this.art.chaoTransparent, 657, 281, 16, 17, 134, 103, 16, 17); else { this.rect(134, 110, 13, 5, '#ffd62e'); this.rect(144, 105, 5, 15, '#ffe65a'); } }
    if (this.state.toys.includes('tv') && this.art.chaoTransparent) this.ctx.drawImage(this.art.chaoTransparent, 725, 281, 17, 17, 131, 52, 17, 17);
    if (this.state.toys.includes('duck')) { if (this.art.chaoTransparent) this.ctx.drawImage(this.art.chaoTransparent,674,281,16,17,34,114,16,17); else { this.rect(35, 122, 15, 7, '#ffe529'); this.rect(43, 117, 7, 7, '#ffe529'); this.rect(49, 121, 4, 2, '#ff971f'); } }
    if (!this.state.hatched) this.drawEgg(this.state.x, this.state.y); else this.drawChao(this.state.x, this.state.y);
    for (const e of this.effects) e.type === 'heart' ? this.heart(int(e.x), int(e.y)) : this.star(int(e.x), int(e.y));
    this.drawSidebar();
    if (this.heldItem) { const fruit = FRUITS.find(f => f.id === this.heldItem); this.fruit(fruit.sprite, this.cursor.x - 8, this.cursor.y - 4); }
    if (this.art.chaoTransparent) this.ctx.drawImage(this.art.chaoTransparent,this.heldItem?701:684,321,17,17,int(this.cursor.x)-3,int(this.cursor.y)-16,17,17);
    else { this.rect(this.cursor.x - 2, this.cursor.y - 9, 8, 7, '#fff8e8'); this.rect(this.cursor.x - 4, this.cursor.y - 4, 4, 6, '#fff8e8'); }
    if (this.state.hatched && this.state.belly < 25 && int(this.time * 2) % 2 === 0) this.text('FOOD?', this.state.x - 13, this.state.y - 50, '#fff4ae', 1, true);
    if (this.hatchTime > 0 && this.hatchTime < .6) { this.ctx.globalAlpha = this.hatchTime / .6; this.rect(0, 0, 176, 145, '#fff9c8'); this.ctx.globalAlpha = 1; }
  }
  scrollText(text, max) { if (this.textWidth(text) <= max) return text; const length = Math.floor(max / 6); const start = Math.floor(this.time * 4) % (text.length + 10); return (`${text}          ${text}`).slice(start, start + length); }
  drawSidebar() {
    if (this.art['original-ui']) this.ctx.drawImage(this.art['original-ui'],176,0,64,160,176,0,64,160);
    else { this.rect(176,0,64,160,'#f2e8bc'); for (let y=0;y<160;y+=4) { this.rect(176,y,2,2,'#ffa87c'); this.rect(237,y,2,2,'#ffa87c'); } ['MOOD','BELLY','SWIM','FLY','RUN','POWER','STAMINA'].forEach((s,i)=>this.text(s,181,33+i*16,'#183968')); this.ring(182,147); }
    if (this.state.hatched) { this.text(this.state.name,181,7,'#001048'); if(this.art['original-shop'])this.ctx.drawImage(this.art['original-shop'],185,16,51,8,185,16,51,8);else this.text('CHILD',181,17,'#001048'); }
    [this.state.mood,this.state.belly,...STATS.map(s=>this.state.stats[s].xp)].forEach((value,i)=>{
      const count = this.state.hatched ? Math.round(clamp(value)/10) : 0, y=40+i*16;
      for(let n=0;n<count;n++){ const x=182+n*5;if(this.art['original-shop'])this.ctx.drawImage(this.art['original-shop'],182,40,6,5,x,y,6,5);else this.rect(x+1,y+1,4,3,'#00f8f8'); }
    });
    STATS.forEach((stat,i)=>{ const level=this.state.stats[stat].level;if(!level)return;const y=66+i*16;this.rect(227,y,8,5,'#f0e8b8');this.miniNumber(level,235-(String(level).length*4),y,'#000'); });
    this.rect(193,146,42,13,'#f0e8b8'); this.text(String(this.state.rings),194,150,'#234fba');
  }
  miniNumber(number,x,y,color='#001048'){ const glyphs=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];for(const char of String(number)){const glyph=glyphs[Number(char)];if(glyph)for(let i=0;i<15;i++)if(glyph[i]==='1')this.rect(x+i%3,y+int(i/3),1,1,color);x+=4;} }
  bar(x, y, w, h, value, color) { this.rect(x, y, w, h, '#597c96'); this.rect(x + 1, y + 1, w - 2, h - 2, '#fff4bc'); this.rect(x + 1, y + 1, int((w - 2) * clamp(value) / 100), h - 2, color); }
  screenBase(title, color = '#84bfe7') { this.rect(0, 0, 240, 160, color); for (let y = 18; y < 160; y += 8) for (let x = 0; x < 240; x += 8) if ((x + y) % 16) this.rect(x, y, 8, 8, '#93caec'); this.rect(0, 0, 240, 18, '#30568e'); this.text('< B', 5, 5, '#fff3b0'); this.centered(title, 129, 5, '#fff4b3'); }
  drawMenu() {
    this.drawGarden(); this.rect(22, 16, 196, 139, '#21375c'); this.panel(24, 18, 192, 135, '#fff0a8'); this.centered('TINY CHAO GARDEN', 120, 24, '#275a91');
    ['BACK TO GARDEN', 'FOOD BAG', 'BLACK MARKET', 'MINI GAMES', 'CHAO NAME', 'CHAO STATS', 'CHAO FRIENDS'].forEach((label, i) => { const y = 31 + i * 14; if (i === this.selection) this.panel(34, y - 2, 172, 14, '#a8d3f1'); this.text(i === this.selection ? '>' : ' ', 40, y + 2, '#275c96'); this.text(label, 53, y + 2, '#275c96'); });
    this.centered('A: SELECT   B: RETURN', 120, 138, '#4b75a0');
  }
  drawShop() {
    if (this.mode === 'shop') {
      this.drawGarden();
      if (this.art['original-shop']) this.ctx.drawImage(this.art['original-shop'],0,0,48,160,0,0,48,160);
      else { this.rect(0,0,48,160,'#ffb078'); FRUITS.forEach((f,i)=>{this.fruit(f.sprite,1,12+i*16);this.text(String(f.price),32,17+i*16,'#161820');}); }
      // The original left window reserves its last two rows for an egg and one unlockable toy.
      // Restore the original egg row; visiting an egg uses the standalone Friends collection.
      this.rect(1,124,46,35,'#ffb078'); for(let y=127;y<159;y+=4)for(let x=2;x<47;x+=4)this.rect(x,y,2,2,'#ffc090');
      const egg=this.state.eggStock&&getEgg(this.state.eggStock);
      if(egg){this.drawEggSprite(egg.id,9,140);this.text(String(egg.price),47-this.textWidth(String(egg.price)),131,'#17251d');}
      const next = this.shopItems().find(item=>typeof item.index==='number'&&item.index>=FRUITS.length);
      if(next){ const sx = next.id==='trumpet'?657:next.id==='duck'?674:725; if(this.art.chaoTransparent)this.ctx.drawImage(this.art.chaoTransparent,sx,281,16,17,1,142,16,17); this.text(String(next.price),47-this.textWidth(String(next.price)),148,'#17251d'); }
      const selected=this.shopItems()[this.selection];
      const y=this.selection<7?12+this.selection*16:selected?.index==='egg'?125:142;
      if(this.art.chaoTransparent)this.ctx.drawImage(this.art.chaoTransparent,684,321,17,17,12,y-2,17,17);
      else this.text('>',17,y+4,'#fff5de');
      return;
    }
    const shop = this.mode === 'shop'; this.screenBase(shop ? 'BLACK MARKET' : 'FOOD BAG'); this.ring(190, 5); this.text(this.state.rings, 201, 5, '#fff5bd');
    const items = shop ? [...FRUITS, ...TOYS] : FRUITS;
    items.forEach((f, i) => {
      const x = 5 + (i % 2) * 117, y = 23 + int(i / 2) * 20; const selected = i === this.selection;
      this.panel(x, y, 112, 19, selected ? '#fff1a5' : '#dcefc8', selected ? '#db8b3a' : '#5f8f95');
      if (i < FRUITS.length) this.fruit(f.sprite, x + 4, y + 1); else if (this.art.chaoTransparent) { const sourceX = f.id === 'trumpet' ? 657 : f.id === 'duck' ? 674 : 725; this.ctx.drawImage(this.art.chaoTransparent, sourceX, 281, 16, 17, x + 4, y + 1, 16, 17); }
      this.text(f.name, x + 24, y + 2, '#325788');
      if (shop) { this.ring(x + 25, y + 10); this.text(i >= FRUITS.length && this.state.toys.includes(f.id) ? 'OWNED' : String(f.price), x + 35, y + 10, '#7c6540'); }
      else this.text(`X ${this.state.inventory[f.id]}`, x + 25, y + 10, '#5c804a');
    });
    const item = items[this.selection];
    if (!shop) { this.text('FEED FRUIT TO GROW YOUR CHAO.', 14, 107, '#325b92'); this.text(`FRUIT IN BAG: ${Object.values(this.state.inventory).reduce((a,b) => a+b,0)}/8`, 14, 117, '#325b92'); }
    this.panel(6, 124, 228, 31, '#fff5bc');
    const details = this.selection < FRUITS.length ? `${item.stat.toUpperCase()} +${item.xp}  BELLY +${item.belly}` : item.id === 'trumpet' ? 'A LITTLE MUSIC MAKES A HAPPY CHAO' : item.id === 'duck' ? 'A FRIEND FOR SWIMMING TIME' : 'CARTOONS FOR YOUR TINY FRIEND';
    this.centered(this.notice ? this.scrollText(this.notice, 218) : details, 120, 129, '#345d92');
    this.centered(shop ? 'A: BUY    B: BACK' : 'A: FEED    B: BACK', 120, 143, '#4265a0');
  }
  drawStats() {
    this.screenBase('CHAO STATS'); this.panel(8, 25, 77, 111, '#dff1b7'); this.drawChao(47, 97, 'happy', 2); this.centered(this.state.name, 47, 119, '#2a689c');
    STATS.forEach((stat, i) => { const y = 29 + i * 20; this.text(stat.toUpperCase(), 95, y, '#2a578e'); this.text(`LV ${String(this.state.stats[stat].level).padStart(2, '0')}`, 191, y, '#2a578e'); this.bar(95, y + 10, 132, 6, this.state.stats[stat].xp, '#58c668'); });
    this.centered(`BELLY ${int(this.state.belly)}  MOOD ${int(this.state.mood)}  REST ${int(this.state.energy)}`, 120, 141, '#2a578e'); this.centered('A OR B: GARDEN', 120, 152, '#2a578e');
  }
  drawFriends() {
    this.screenBase('CHAO FRIENDS');
    EGGS.forEach((egg,i)=>{const x=8+i%4*56,y=25+int(i/4)*34,friend=egg.id===this.state.color?this.state:this.state.collection[egg.id];
      this.panel(x,y,54,32,i===this.selection?'#fff1a5':friend?'#dcefc8':'#d9e0da',i===this.selection?'#db8b3a':'#78968c');
      if(friend?.hatched)this.drawChao(x+27,y+25,'idle',1,egg.id);else {this.ctx.globalAlpha=isEggUnlocked(egg.id,this.state)?1:.25;this.drawEggSprite(egg.id,x+27,y+24);this.ctx.globalAlpha=1;}
      if(!friend)this.text('?',x+44,y+4,'#788478');
      if(egg.id===this.state.color)this.text('>',x+4,y+12,'#2f608f');
    });
    const egg=EGGS[this.selection],friend=egg.id===this.state.color?this.state:this.state.collection[egg.id];
    this.centered(`${egg.name} - ${egg.rarity}`,120,132,'#305a94');
    this.centered(friend?(friend.hatched?`A: VISIT ${friend.name}`:'A: HATCH YOUR EGG'):isEggUnlocked(egg.id,this.state)?`${egg.price} RINGS - FIND IN SHOP`:eggHint(egg.id),120,143,'#4265a0');
    this.centered(`${Object.keys(this.state.collection).length}/12 FRIENDS   B: GARDEN`,120,153,'#4265a0');
  }
  drawGames() {
    this.screenBase('MINI GAMES');
    [['CHAO MEMORY', 'MATCH THE FRUIT CARDS'], ['CHAO JANKEN', 'ROCK, PAPER, SCISSORS!']].forEach((lines, i) => { const y = 31 + i * 48; this.panel(12, y, 216, 41, i === this.selection ? '#fff0a2' : '#d8efc3'); this.text(i === this.selection ? '>' : ' ', 20, y + 9, '#315a94'); this.text(lines[0], 33, y + 9, '#315a94'); this.text(lines[1], 33, y + 25, '#487a9a'); });
    this.centered('WIN RINGS FOR FRUIT AND TOYS!', 120, 136, '#2b6098'); this.centered('A: PLAY    B: GARDEN', 120, 149, '#2b6098');
  }
  drawIntro(game) {
    this.screenBase(game === 'memory' ? 'CHAO MEMORY' : 'CHAO JANKEN'); this.panel(8, 26, 224, 103, '#fff1ae');
    const lines = game === 'memory' ? ['REMEMBER THE SEVEN PAIRS!', 'WATCH CLOSELY AS CHAO SHUFFLES.', 'OUTSIDE CARDS: 1 RING EACH.', 'MIDDLE: 3 RINGS. CENTER: 5.', 'THREE MISTAKES ENDS THE GAME.', 'D-PAD: CHOOSE   A: FLIP'] : ['WIN ROCK, PAPER, SCISSORS!', 'CHOOSE A SLOT. ITS CARD FLIES UP.', 'PAPER > ROCK > SCISSORS > PAPER', 'WIN: 1 RING. FIVE MISSES MAX.', 'CLEAR ALL TEN: +10 SECONDS!', 'L/R: HAND   A: SHOOT'];
    lines.forEach((line, i) => this.centered(line, 120, 34 + i * 15, '#305a94'));
    this.centered('PRESS A OR TAP TO START', 120, 141, '#284f86');
  }
  drawMemory() {
    const m=this.memory;
    if(this.art.minigames)this.ctx.drawImage(this.art.minigames,311,104,240,160,0,0,240,160);
    else this.rect(0,0,240,160,'#acc9ee');
    m.cards.forEach((value,i)=>{
      const x=i%6*32,y=int(i/6)*32;
      if(value!==null&&!m.matched[i]){
        if(m.preview>0||m.open.includes(i)){
          if(this.art.minigamesTransparent)this.ctx.drawImage(this.art.minigamesTransparent,400+value*24,75,24,27,x+4,y+2,24,27);
          else this.fruit(value,x+8,y+8);
        } else if(this.art.minigamesTransparent)this.ctx.drawImage(this.art.minigamesTransparent,568,75,24,27,x+4,y+2,24,27);
        else{this.panel(x+8,y+3,17,26,'#58dbfa');this.text('?',x+13,y+12,'#166ec0');}
      }
      if(m.shuffles>0&&i===m.moved)this.drawChao(x+16,y+29,'walk');
      if(i===m.cursor&&m.preview<=0&&m.shuffles<=0){
        const color=int(this.time*5)%2?'#fff8f8':'#08b0f8';
        for(const [dx,dy,sx,sy] of [[1,1,1,1],[30,1,-1,1],[1,30,1,-1],[30,30,-1,-1]]){this.rect(x+dx+(sx<0?-4:0),y+dy,5,1,color);this.rect(x+dx,y+dy+(sy<0?-4:0),1,5,color);}
      }
    });
    if(this.art.minigamesTransparent)this.ctx.drawImage(this.art.minigamesTransparent,245,130,14,15,197,48,14,15);
    this.text(String(m.rings).padStart(2,'0'),214,52,'#fff830');
    for(let n=0;n<3;n++)if(this.art.minigamesTransparent)this.ctx.drawImage(this.art.minigamesTransparent,n>=3-m.mistakes?594:553,192+n*24,40,22,198,95+n*21,40,22);
    if(m.preview>0)this.miniNumber(Math.ceil(m.preview),213,13,'#001848');
  }

  hand(hand, x, y, size = 25, selected = false, yellow = false) {
    if (this.art.minigamesTransparent) { const sx = hand === 0 ? 58 : hand === 1 ? 31 : 4; const sy = yellow ? 77 : 50; this.ctx.drawImage(this.art.minigamesTransparent, sx, sy, 24, 24, x, y, 24, 24); }
    else { this.panel(x,y,size,size,selected?'#fff06a':['#ff92cf','#bda1f2','#b1df77'][hand],'#4c4678');this.centered(['R', 'P', 'S'][hand], x + size / 2, y + int(size / 2) - 3, '#345984'); }
  }
  drawJanken() {
    const g=this.janken;
    if(this.art.minigames)this.ctx.drawImage(this.art.minigames,3,104,240,160,0,0,240,160);
    else this.rect(0,0,240,160,'#f4d84b');
    for(const c of g.cards)if(!c.hit)this.hand(c.hand,int(c.x),int(c.y),24);
    if(this.art.minigamesTransparent){this.ctx.drawImage(this.art.minigamesTransparent,245,130,14,15,189,23,14,15);this.ctx.drawImage(this.art.minigamesTransparent,245,178,14,15,189,71,14,15);this.ctx.drawImage(this.art.minigamesTransparent,245,235,14,15,189,132,14,15);}
    this.text(String(g.rings).padStart(2,'0'),208,26,'#fff83a');
    this.text(String(Math.ceil(g.remaining)).padStart(2,'0'),207,76,'#fff83a');
    this.text(String(g.lives),218,140,'#fff83a');
    this.drawChao(89,74,'idle');
    for(const e of this.effects)this.star(int(e.x),int(e.y));
    for(let i=0;i<3;i++){
      const x=14+i*66;
      if(i===g.hand){
        if(this.art.jankenCursor)this.ctx.drawImage(this.art.jankenCursor,27,15,32,32,x-4,120,32,32);
        else {this.rect(x-2,123,5,2,'#00b8f8');this.rect(x-2,123,2,5,'#00b8f8');this.rect(x+22,123,5,2,'#00b8f8');this.rect(x+25,123,2,5,'#00b8f8');this.rect(x-2,148,5,2,'#00b8f8');this.rect(x+22,148,5,2,'#00b8f8');}
      }
      if(g.hands[i]!==null)this.hand(g.hands[i],x,124,24,false,true);
    }
    for(const shot of g.shots)this.hand(shot.hand,int(shot.x),int(shot.y),24,false,true);
  }

  drawPause() { this.pausedMode === 'memory' ? this.drawMemory() : this.drawJanken(); this.ctx.globalAlpha = .6; this.rect(0, 0, 240, 160, '#24365b'); this.ctx.globalAlpha = 1; this.panel(29, 34, 182, 92, '#fff1ad'); this.centered('TAKE A LITTLE BREAK', 120, 46, '#315b96'); ['KEEP PLAYING', 'FINISH AND KEEP RINGS'].forEach((str, i) => { if (this.selection === i) this.panel(40, 69 + i * 27, 160, 18, '#acdbeb'); this.centered(str, 120, 75 + i * 27, '#315b96'); }); }
  drawResult() {
    this.screenBase('GREAT PLAY!'); this.panel(15, 27, 210, 87, '#fff1aa'); this.centered(this.result.perfect ? 'ALL THE PAIRS! AMAZING!' : 'THANKS FOR PLAYING!', 120, 37, '#386295');
    this.ring(55, 57, 2); this.text(`+${this.result.earned}`, 77, 57, '#bc7d31', 2); this.text('RINGS', 145, 64, '#3c7294');
    this.centered(this.result.game === 'memory' ? `${this.result.pairs} PAIRS FOUND` : `${this.result.hits} WINNING SHOTS`, 120, 83, '#3b7495'); this.centered(`YOUR RINGS: ${this.state.rings}`, 120, 100, '#3b7495');
    ['PLAY AGAIN', 'BACK TO GARDEN'].forEach((label, i) => { const y = 122 + i * 20; this.panel(49, y - 4, 142, 17, this.selection === i ? '#fff1ab' : '#c4e6db'); this.centered(label, 120, y + 1, '#355c93'); });
  }
  drawRename() {
    if(this.art['original-name'])this.ctx.drawImage(this.art['original-name'],0,0,240,160,0,0,240,160);else this.rect(0,0,240,160,'#f8f890');
    // The native frame and Roman glyphs are preserved; this page contains only working ASCII keys.
    this.rect(12,18,133,127,'#f8f890');this.centered('A B C',77,19,'#202020');
    for(let i=0;i<38;i++){
      const p=this.renamePosition(i),x=p.x-4,y=p.y-4;
      if(i<36&&this.art['original-name']){
        const sx=i<15?24+i*8:i<26?16+(i-15)*8:16+(i-26)*8,sy=i<15?76:i<26?84:68;
        this.ctx.drawImage(this.art['original-name'],sx,sy,8,8,x,y,8,8);
      }else if(i===36){this.rect(x,y+5,8,1,'#000');this.rect(x,y+3,1,3,'#000');this.rect(x+7,y+3,1,3,'#000');}
      else if(i===37)this.text('<',x+2,y,'#000');else this.text(this.nameChars[i],x,y,'#000');
      if(i===this.renameIndex){const c='#f82080';this.rect(x-3,y-3,5,1,c);this.rect(x-3,y-3,1,5,c);this.rect(x+7,y-3,5,1,c);this.rect(x+11,y-3,1,5,c);this.rect(x-3,y+10,5,1,c);this.rect(x+7,y+10,5,1,c);}
    }
    this.rect(165,58,62,13,'#f8f8f8');this.text(this.nameDraft,167,61,'#000');
    if(int(this.time*3)%2===0){const caret=this.nameCaret??this.nameDraft.length;this.rect(167+this.textWidth(this.nameDraft.slice(0,caret))+(caret?1:0),60,2,9,'#f81870');}
    if(this.renameIndex>=38){const y=this.renameIndex===38?96:112;this.rect(159,y,72,1,'#fff850');this.rect(159,y+13,72,1,'#fff850');this.rect(159,y,1,14,'#fff850');this.rect(230,y,1,14,'#fff850');}
  }

  render() {
    if (!this.ctx) return; this.ctx.imageSmoothingEnabled = false; this.ctx.globalAlpha = 1;
    switch (this.mode) { case 'garden': this.drawGarden(); break; case 'menu': this.drawMenu(); break; case 'bag': case 'shop': this.drawShop(); break; case 'stats': this.drawStats(); break; case 'friends': this.drawFriends(); break; case 'games': this.drawGames(); break; case 'memoryIntro': this.drawIntro('memory'); break; case 'jankenIntro': this.drawIntro('janken'); break; case 'memory': this.drawMemory(); break; case 'janken': this.drawJanken(); break; case 'pause': this.drawPause(); break; case 'result': this.drawResult(); break; case 'rename': this.drawRename(); break; default: this.mode = 'garden'; this.drawGarden(); }
  }
  draw() { this.render(); }
}
