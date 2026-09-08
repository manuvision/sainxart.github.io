/* Original Tiny Chao Garden eggs. Prices and atlas coordinates: CREDITS.md. */
export const EGGS = [
  { id:'normal', name:'NORMAL', price:0, atlas:0, rarity:'ORIGINAL', weight:15 },
  { id:'silver', name:'SILVER', price:500, atlas:2, rarity:'SPECIAL', weight:15 },
  { id:'gold', name:'GOLD', price:1000, atlas:1, rarity:'SPECIAL', weight:11.25 },
  { id:'ruby', name:'RUBY', price:5000, atlas:4, rarity:'JEWEL', weight:11.25 },
  { id:'sapphire', name:'SAPPHIRE', price:7000, atlas:6, rarity:'JEWEL', weight:7.5 },
  { id:'amethyst', name:'AMETHYST', price:8000, atlas:5, rarity:'JEWEL', weight:7.5 },
  { id:'emerald', name:'EMERALD', price:10000, atlas:8, rarity:'JEWEL', weight:7.5 },
  { id:'garnet', name:'GARNET', price:12000, atlas:3, rarity:'RARE', weight:5.125 },
  { id:'aquamarine', name:'AQUAMARINE', price:14000, atlas:7, rarity:'RARE', weight:5.125 },
  { id:'peridot', name:'PERIDOT', price:16000, atlas:9, rarity:'RARE', weight:2 },
  { id:'topaz', name:'TOPAZ', price:18000, atlas:10, rarity:'RARE', weight:.125 },
  { id:'onyx', name:'ONYX', price:20000, atlas:11, rarity:'RARE', weight:12.625 },
];
export const EGG_REFRESH_MS = 5 * 60 * 1000;
export const getEgg = id => EGGS.find(egg => egg.id === id) || EGGS[0];
// The original rare pool varies per save. Assign its five weights once and persist them.
export function makeEggWeights(random = Math.random) {
  const rare = [12.625,5.125,5.125,2,.125];
  for (let i=rare.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [rare[i],rare[j]]=[rare[j],rare[i]]; }
  return Object.fromEntries(EGGS.map((egg,i)=>[egg.id,i<7?egg.weight:rare[i-7]]));
}
export function restoreEggWeights(raw) {
  if (raw && EGGS.every(egg=>Number.isFinite(raw[egg.id])&&raw[egg.id]>0&&raw[egg.id]<=100)) return Object.fromEntries(EGGS.map(egg=>[egg.id,raw[egg.id]]));
  return makeEggWeights();
}
export function rollEggStock(collection, weights, random = Math.random) {
  const available=EGGS.filter(egg=>egg.id!=='normal'&&!Object.hasOwn(collection,egg.id));
  const total=available.reduce((sum,egg)=>sum+(weights?.[egg.id]||egg.weight),0);
  let roll=Math.max(0,Math.min(.999999999,random()))*total;
  for (const egg of available) { roll-=weights?.[egg.id]||egg.weight; if(roll<0)return egg.id; }
  return available.at(-1)?.id||null;
}
export function snapshotChao(state) {
  return { color:getEgg(state.color).id, name:state.name, hatched:state.hatched, eggProgress:state.eggProgress,
    mood:state.mood, belly:state.belly, energy:state.energy, x:state.x, y:state.y,
    stats:Object.fromEntries(Object.entries(state.stats).map(([key,value])=>[key,{...value}])) };
}
