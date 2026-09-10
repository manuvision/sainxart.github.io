#!/usr/bin/env python3
"""Bake native-AR screen art and a 7 s eased loop from Apple's original rig.
Run with Python containing Pillow and NumPy. Original /duo assets are read-only.
"""
from pathlib import Path
import json, math, shutil, struct, os
import numpy as np
from PIL import Image, ImageOps
DUO = Path(__file__).resolve().parents[2]
OUT = Path(os.environ.get('DUO_AR_BUILD_DIR', str(DUO.parent.parent / 'ar-export')))
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = DUO / 'assets/model'
g = json.loads((SOURCE/'iphone-duo.gltf').read_text())
buffers = [(SOURCE/b['uri']).read_bytes() for b in g['buffers']]
for b in g['buffers']: shutil.copy2(SOURCE/b['uri'],OUT/b['uri'])
for im in g['images']:
    src=SOURCE/im['uri']; img=Image.open(src); img.thumbnail((2048,2048),Image.Resampling.LANCZOS)
    filename=src.stem+'.png'; img.save(OUT/filename); im['uri']=filename; im.pop('mimeType',None)
wallpaper=Image.open(DUO/'assets/wallpaper-raccoon.png').convert('RGB')
for side,w,h,mi in [('inner',2048,1432,8),('outer',1000,1455,7)]:
    cropped=ImageOps.fit(wallpaper,(w,h),method=Image.Resampling.LANCZOS,centering=(.5,.5)).convert('RGBA')
    overlay=Image.open(DUO/f'assets/lockscreen-{side}.avif').convert('RGBA').resize((w,h),Image.Resampling.LANCZOS)
    cropped=Image.alpha_composite(cropped,overlay)
    canvas=Image.new('RGB',(w,h),'black'); canvas.paste(cropped.resize((round(w*.9),round(h*.9)),Image.Resampling.LANCZOS),(round(w*.05),round(h*.05)))
    # Match the endpoint 1.12x UV zoom in screen-material.js, eliminating inset.
    cw,ch=w/1.12,h/1.12
    canvas=canvas.crop(((w-cw)/2,(h-ch)/2,(w+cw)/2,(h+ch)/2)).resize((w,h),Image.Resampling.LANCZOS)
    filename=f'wallpaper-{side}.png';canvas.save(OUT/filename)
    image_index=len(g['images']);g['images'].append({'uri':filename})
    texture_index=len(g['textures']);g['textures'].append({'source':image_index})
    # Fully emissive display, preserved native UVs, black reflective contribution.
    g['materials'][mi]={'name':f'Raccoon lockscreen {side}', 'pbrMetallicRoughness':{'baseColorFactor':[0,0,0,1],'metallicFactor':0,'roughnessFactor':1},'emissiveFactor':[1,1,1], 'emissiveTexture':{'index':texture_index}}

def read_accessor(idx):
    a=g['accessors'][idx];bv=g['bufferViews'][a['bufferView']]
    dt={5126:'<f4',5123:'<u2',5125:'<u4',5121:'u1'}[a['componentType']]
    n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    return np.frombuffer(buffers[bv['buffer']],dtype=dt,count=a['count']*n,offset=bv.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],n)
loopbuf=bytearray();bidx=len(g['buffers'])
def accessor(values,typ):
    arr=np.asarray(values,dtype='<f4');offset=len(loopbuf);loopbuf.extend(arr.tobytes());vi=len(g['bufferViews']);g['bufferViews'].append({'buffer':bidx,'byteOffset':offset,'byteLength':arr.nbytes})
    ai=len(g['accessors']);g['accessors'].append({'bufferView':vi,'componentType':5126,'count':len(arr),'type':typ,'min':arr.min(axis=0).tolist(),'max':arr.max(axis=0).tolist()});return ai
T=np.arange(211,dtype=np.float64)/30
P=np.where(T<=1,0,np.where(T<3.5,(1-np.cos(np.pi*(T-1)/2.5))/2,np.where(T<=4.5,1,(1+np.cos(np.pi*(T-4.5)/2.5))/2)))
times_idx=accessor(T.reshape(-1,1),'SCALAR')
original=next(a for a in g['animations'] if a['name']=='Slider')
loop={'name':'Duo calm fold loop','channels':[],'samplers':[]}
for ch in original['channels']:
    sampler=original['samplers'][ch['sampler']]
    assert sampler.get('interpolation','LINEAR')=='LINEAR'
    source_t=read_accessor(sampler['input'])[:,0];source_v=read_accessor(sampler['output']).astype(np.float64)
    sample_t=P*float(source_t[-1]);hi=np.clip(np.searchsorted(source_t,sample_t,side='right'),1,len(source_t)-1);lo=hi-1
    alpha=np.clip((sample_t-source_t[lo])/(source_t[hi]-source_t[lo]),0,1)[:,None]
    a,b=source_v[lo].copy(),source_v[hi].copy()
    if ch['target']['path']=='rotation':
        dot=(a*b).sum(axis=1);b[dot<0]*=-1;dot=np.abs(dot).clip(-1,1);theta=np.arccos(dot)[:,None]
        sint=np.sin(theta);safe=np.where(sint<1e-8,1,sint)
        value=np.where(sint<1e-8,(1-alpha)*a+alpha*b,(np.sin((1-alpha)*theta)*a+np.sin(alpha*theta)*b)/safe)
        value/=np.linalg.norm(value,axis=1)[:,None]
    else: value=(1-alpha)*a+alpha*b
    oi=accessor(value,'VEC4' if value.shape[1]==4 else 'VEC3');si=len(loop['samplers'])
    loop['samplers'].append({'input':times_idx,'output':oi,'interpolation':'LINEAR'});loop['channels'].append({'sampler':si,'target':ch['target']})
g['animations']=[loop];g['buffers'].append({'uri':'duo-loop.bin','byteLength':len(loopbuf)});(OUT/'duo-loop.bin').write_bytes(loopbuf)
scene=g['scenes'][g.get('scene',0)]
newroot=len(g['nodes']);g['nodes'].append({'name':'Duo AR true-scale metres','children':scene['nodes'],'translation':[-.040250725,.0085146564,.000224145],'scale':[.01,.01,.01]});scene['nodes']=[newroot]
g.setdefault('asset',{})['extras']={'arAnimation':'closed hold 0-1; cosine open 1-3.5; open hold 3.5-4.5; cosine close 4.5-7; loop','originalModel':'Apple iPhone Duo; original 27-joint Slider animation','units':'metres via root scale 0.01'}
(OUT/'duo-prepared.gltf').write_text(json.dumps(g,separators=(',',':')))
# Scene Viewer accepts one UV set and core PBR. Keep original geometry/skin,
# wallpaper, UV0 base artwork; flatten only unsupported coating and UV1 detail.
normalization={'removedSecondaryUvPrimitives':0,'removedSecondaryDetailMaps':[],'removedOptionalMaterialExtensions':[]}
for primitive_mesh in g['meshes']:
    for primitive in primitive_mesh['primitives']:
        if primitive['attributes'].pop('TEXCOORD_1',None) is not None:
            normalization['removedSecondaryUvPrimitives']+=1
for mi,material in enumerate(g['materials']):
    extensions=material.pop('extensions',{})
    normalization['removedOptionalMaterialExtensions'].extend(extensions.keys())
    for key in ['normalTexture','occlusionTexture']:
        if material.get(key,{}).get('texCoord',0)>0:
            material.pop(key);normalization['removedSecondaryDetailMaps'].append({'material':mi,'map':key})
    pbr=material.get('pbrMetallicRoughness',{})
    info=pbr.get('metallicRoughnessTexture',{})
    if info.get('texCoord',0)>0:
        texture=g['textures'][info['index']];image=g['images'][texture['source']]
        rgb=np.asarray(Image.open(OUT/image['uri']).convert('RGB'),dtype=np.float64)/255
        pbr['roughnessFactor']=float(pbr.get('roughnessFactor',1)*rgb[:,:,1].mean())
        pbr['metallicFactor']=float(pbr.get('metallicFactor',1)*rgb[:,:,2].mean())
        pbr.pop('metallicRoughnessTexture');normalization['removedSecondaryDetailMaps'].append({'material':mi,'map':'metallicRoughnessTexture','roughnessFactor':pbr['roughnessFactor'],'metallicFactor':pbr['metallicFactor']})
# Scene Viewer supports four influences per vertex. Apple's fifth influence
# is floating-point residue (< 1e-6); retain and renormalize the primary four.
weights_blob=bytearray();weights_buffer_index=len(g['buffers']);max_discarded=0.0
for mesh in g['meshes']:
    for primitive in mesh['primitives']:
        attrs=primitive['attributes']
        if 'WEIGHTS_1' not in attrs: continue
        discarded=read_accessor(attrs['WEIGHTS_1']).astype(np.float64)
        max_discarded=max(max_discarded,float(discarded.sum(axis=1).max()))
        assert max_discarded<1e-6, 'Do not discard a meaningful skin influence.'
        weights=read_accessor(attrs['WEIGHTS_0']).astype(np.float64)
        normalized=(weights/weights.sum(axis=1)[:,None]).astype('<f4')
        view_index=len(g['bufferViews']);g['bufferViews'].append({'buffer':weights_buffer_index,'byteOffset':len(weights_blob),'byteLength':normalized.nbytes});weights_blob.extend(normalized.tobytes())
        accessor_index=len(g['accessors']);g['accessors'].append({'bufferView':view_index,'componentType':5126,'count':len(normalized),'type':'VEC4','min':normalized.min(axis=0).tolist(),'max':normalized.max(axis=0).tolist()})
        attrs['WEIGHTS_0']=accessor_index;attrs.pop('WEIGHTS_1');attrs.pop('JOINTS_1',None)
if weights_blob:
    g['buffers'].append({'uri':'android-weights.bin','byteLength':len(weights_blob)});(OUT/'android-weights.bin').write_bytes(weights_blob)
normalization['maxDiscardedSecondarySkinWeight']=max_discarded
normalization['maxInfluencesPerVertex']=4
g.pop('extensionsUsed',None);g.pop('extensionsRequired',None)
normalization['removedOptionalMaterialExtensions']=sorted(set(normalization['removedOptionalMaterialExtensions']))
(OUT/'scene-viewer-normalization.json').write_text(json.dumps(normalization,indent=2))
# Pack original geometry and standard materials directly, avoiding a geometry roundtrip.
blob=bytearray();buffer_offsets=[]
for buffer in g['buffers']:
    while len(blob)%4: blob.append(0)
    buffer_offsets.append(len(blob));blob.extend((OUT/buffer['uri']).read_bytes())
for view in g['bufferViews']:
    view['byteOffset']=view.get('byteOffset',0)+buffer_offsets[view['buffer']];view['buffer']=0
for image in g['images']:
    while len(blob)%4: blob.append(0)
    data=(OUT/image['uri']).read_bytes();vi=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data)});blob.extend(data)
    image.clear();image.update({'bufferView':vi,'mimeType':'image/png'})
while len(blob)%4: blob.append(0)
g['buffers']=[{'byteLength':len(blob)}]
encoded=json.dumps(g,separators=(',',':')).encode()
encoded+=b' '*((-len(encoded))%4)
header=struct.pack('<4sII',b'glTF',2,12+8+len(encoded)+8+len(blob))
(DUO/'ar/assets/duo-fold.glb').write_bytes(header+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(blob),b'BIN\0')+blob)
print(json.dumps({'prepared':str(OUT/'duo-prepared.gltf'),'samples':len(T),'duration':float(T[-1]),'channels':len(loop['channels'])}))
