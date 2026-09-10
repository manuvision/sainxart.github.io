/**
 * Losslessly predecode the original studio EXRs using the pinned Three loader.
 * Run from anywhere: node duo/source/precompute-lighting.mjs
 * Runtime DataTextures reproduce exactly the loader's RGBA half-float texels.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';
const base=new URL('../assets/lighting/',import.meta.url);
const config=JSON.parse(readFileSync(new URL('lighting-config.json',base),'utf8'));
const threeVersion=JSON.parse(readFileSync(new URL('./node_modules/three/package.json',import.meta.url),'utf8')).version;
const manifest={schema:'linear-rgba16f-v1',threeVersion,endianness:'little',channels:'RGBA',colorSpace:'srgb-linear',flipY:false,files:[]};
for(const {file:sourceFile} of config.exrs){
  const encoded=readFileSync(new URL(sourceFile,base));
  const input=encoded.buffer.slice(encoded.byteOffset,encoded.byteOffset+encoded.byteLength);
  const parsed=new EXRLoader().parse(input);
  if(!(parsed.data instanceof Uint16Array))throw Error('Expected Three HalfFloatType output.');
  const raw=Buffer.from(parsed.data.buffer,parsed.data.byteOffset,parsed.data.byteLength);
  const packed=gzipSync(raw,{level:9});
  if(!gunzipSync(packed).equals(raw))throw Error('Lossless verification failed.');
  const file=sourceFile.replace(/\.exr$/,'.rgba16f.gz');
  writeFileSync(new URL(file,base),packed);
  manifest.files.push({sourceFile,file,width:parsed.width,height:parsed.height,sourceBytes:encoded.length,rawBytes:raw.length,gzipBytes:packed.length,sourceSha256:createHash('sha256').update(encoded).digest('hex'),decodedSha256:createHash('sha256').update(raw).digest('hex')});
}
const destination=new URL('linear-exr-manifest.json',base);
writeFileSync(destination,JSON.stringify(manifest,null,2)+'\n');
console.log(`Verified lossless lighting assets: ${fileURLToPath(destination)}`);
