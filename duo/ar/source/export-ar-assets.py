"""Import the prepared official rig and export animation-preserving native assets.
Run: Blender --background --factory-startup --python this-file
"""
import bpy,json,math,os
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
BUILD=Path(os.environ.get('DUO_AR_BUILD_DIR', str(ROOT.parents[2] / 'ar-export')))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=str(BUILD/'duo-prepared.gltf'))
scene=bpy.context.scene;scene.frame_start=0;scene.frame_end=210
# glTF importer creates hidden bone-widget geometry. Never ship that helper.
for obj in list(scene.objects):
 if obj.parent is None and obj.name != 'Duo AR true-scale metres': bpy.data.objects.remove(obj,do_unlink=True)
print('ACTIONS',[(a.name,a.frame_range[:]) for a in bpy.data.actions])
print('ARMATURES',[(o.name,len(o.data.bones)) for o in scene.objects if o.type=='ARMATURE'])
print('ROOTS',[(o.name,tuple(o.location),tuple(o.rotation_euler),tuple(o.scale)) for o in scene.objects if o.parent is None])
def bounds():
 d=bpy.context.evaluated_depsgraph_get();coords=[]
 for o in scene.objects:
  if o.type=='MESH':
   e=o.evaluated_get(d);mesh=e.to_mesh();coords.extend([e.matrix_world@v.co for v in mesh.vertices]);e.to_mesh_clear()
 return [[min(v[i] for v in coords) for i in range(3)],[max(v[i] for v in coords) for i in range(3)]]
report=[]
for f in [0,30,68,105,135,173,210]:
 scene.frame_set(f);bb=bounds();report.append({'frame':f,'bounds':bb,'size':[bb[1][i]-bb[0][i] for i in range(3)]})
print('BOUNDS',json.dumps(report))
# Material textures stay embedded in GLB; USDZ packages USD Preview Surface.
bpy.ops.wm.usd_export(filepath=str(BUILD/'duo-fold.usdc'),export_animation=True,export_armatures=True,only_deform_bones=False,export_shapekeys=False,export_uvmaps=True,export_materials=True,export_normals=True,generate_preview_surface=True,generate_materialx_network=False,export_textures_mode='NEW',relative_paths=True,convert_orientation=True,export_global_forward_selection='NEGATIVE_Z',export_global_up_selection='Y',convert_scene_units='METERS',meters_per_unit=1.0,export_lights=False,export_cameras=False,export_custom_properties=False,root_prim_path='/Duo',triangulate_meshes=True)
(BUILD/'blender-verification.json').write_text(json.dumps(report,indent=2))
