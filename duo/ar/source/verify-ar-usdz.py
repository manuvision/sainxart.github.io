"""Package the native USD skeleton, inspect compatibility, and render proof frames."""
from pathlib import Path
from collections import Counter
import json,bpy,math,os,sys
from mathutils import Vector
from pxr import Usd,UsdUtils,UsdGeom,UsdSkel,Sdf
ROOT=Path(__file__).resolve().parents[1]
BUILD=Path(os.environ.get('DUO_AR_BUILD_DIR', str(ROOT.parents[2] / 'ar-export')))
p=BUILD/'duo-fold.usdc'
s=Usd.Stage.Open(str(p)); print('USDMETA',s.GetMetadata('upAxis'),s.GetMetadata('metersPerUnit'),s.GetStartTimeCode(),s.GetEndTimeCode(),s.GetTimeCodesPerSecond())
anchor=s.GetDefaultPrim()
anchor.CreateAttribute('preliminary:anchoring:type',Sdf.ValueTypeNames.Token).Set('plane')
anchor.CreateAttribute('preliminary:planeAnchoring:alignment',Sdf.ValueTypeNames.Token).Set('horizontal')
s.GetRootLayer().Save()
print('USDTYPES',dict(Counter(str(p.GetTypeName()) for p in s.Traverse())))
for prim in s.Traverse():
 if prim.IsA(UsdSkel.Animation):
  a=UsdSkel.Animation(prim); print('SKELANIM',str(prim.GetPath()),len(a.GetJointsAttr().Get()),'translate samples',len(a.GetTranslationsAttr().GetTimeSamples()),'rotation samples',len(a.GetRotationsAttr().GetTimeSamples()))
# Apple variant converter is optional: author a compliant package directly with OpenUSD.
out=ROOT/'assets/duo-fold.usdz'
print('PACKED',UsdUtils.CreateNewUsdzPackage(str(p),str(out)))
checker=UsdUtils.ComplianceChecker(arkit=True,skipVariants=False,verbose=False)
checker.CheckCompliance(str(out))
report={'errors':checker.GetErrors(),'warnings':checker.GetWarnings(),'failedChecks':checker.GetFailedChecks()}
print('COMPLIANCE',json.dumps(report));(BUILD/'usdz-compliance.json').write_text(json.dumps(report,indent=2))
if '--skip-renders' in sys.argv:
 raise SystemExit(0)
# Render the imported original model. This is independent from the native preview,
# but verifies ground contact, artwork orientation, and posed geometry.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/duo-fold.glb'))
for obj in list(bpy.context.scene.objects):
 if obj.parent is None and obj.name != 'Duo AR true-scale metres': bpy.data.objects.remove(obj,do_unlink=True)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=750;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.world.color=(.25,.25,.25)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.0001));plane=bpy.context.object
m=bpy.data.materials.new('Proof table');m.diffuse_color=(.23,.23,.23,1);plane.data.materials.append(m)
def aim(obj,target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for loc,power,size in [((.02,-.12,.35),18,.25),((-.25,.1,.2),12,.3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;aim(light,(-.04,0,0))
bpy.ops.object.camera_add(location=(.18,-.24,.3));camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=.27;aim(camera,(-.04,0,.015));scene.camera=camera
for frame,name in [(0,'closed'),(68,'folding'),(105,'open')]:
 scene.frame_set(frame);scene.render.filepath=str(BUILD/f'proof-{name}.png');bpy.ops.render.render(write_still=True)
