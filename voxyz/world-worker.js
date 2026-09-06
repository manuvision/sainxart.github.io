import { Terrain } from './terrain.js';
import { meshChunk } from './mesher.js';
let terrain;
self.onmessage=({data})=>{
  try {
    if(!terrain||terrain.seed!==data.seed)terrain=new Terrain(data.seed);
    const {cx,cz,requestId,version}=data;
    const generated=data.kind==='generate'?terrain.generateChunk(cx,cz,data.edits):{blocks:data.blocks,levels:data.levels};
    const geometry=meshChunk(generated.blocks,generated.levels,cx,cz,terrain.seed);
    const result={cx,cz,requestId,version,...generated,...geometry};
    const transfer=[generated.blocks.buffer,generated.levels.buffer];
    for(const part of [geometry.solid,geometry.water])for(const array of Object.values(part))transfer.push(array.buffer);
    self.postMessage(result,transfer);
  } catch(error) { self.postMessage({requestId:data.requestId,error:error.message}); }
};
