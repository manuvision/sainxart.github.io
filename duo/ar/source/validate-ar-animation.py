"""Validate every baked USDZ pose in native USD skeleton space."""
from pathlib import Path
import os,json
import numpy as np
from pxr import Usd,UsdGeom,UsdSkel
ROOT=Path(__file__).resolve().parents[1]
BUILD=Path(os.environ.get('DUO_AR_BUILD_DIR', str(ROOT.parents[2]/'ar-export')))
s=Usd.Stage.Open(str(ROOT/'assets/duo-fold.usdz'))
cache=UsdSkel.Cache();root=UsdSkel.Root(next(p for p in s.Traverse() if p.IsA(UsdSkel.Root)))
cache.Populate(root,Usd.TraverseInstanceProxies());bindings=cache.ComputeSkelBindings(root,Usd.TraverseInstanceProxies())
assert len(bindings)==1
b=bindings[0];skel=cache.GetSkelQuery(b.GetSkeleton());targets=b.GetSkinningTargets();assert len(targets)==62
allbounds=[];poses={}
for frame in range(211):
    transforms=skel.ComputeSkinningTransforms(frame)
    world=np.array(UsdGeom.XformCache(frame).GetLocalToWorldTransform(b.GetSkeleton().GetPrim()))
    groups=[]
    for q in targets:
        points=UsdGeom.Mesh(q.GetPrim()).GetPointsAttr().Get(frame)
        assert q.ComputeSkinnedPoints(transforms,points,frame)
        points=np.asarray(points);coords=np.column_stack((points,np.ones(len(points))))@world
        groups.append(coords[:,:3])
    pose=np.concatenate(groups);allbounds.append([pose.min(axis=0).tolist(),pose.max(axis=0).tolist()])
    if frame in [0,30,105,135,210]:poses[frame]=pose
bb=np.array(allbounds)
closed_hold=float(np.max(np.abs(poses[0]-poses[30])));open_hold=float(np.max(np.abs(poses[105]-poses[135])));loop=float(np.max(np.abs(poses[0]-poses[210])))
report={'framesChecked':211,'durationSeconds':7,'timeCodesPerSecond':s.GetTimeCodesPerSecond(),'metresPerUnit':UsdGeom.GetStageMetersPerUnit(s),'upAxis':str(UsdGeom.GetStageUpAxis(s)), 'minimumYMetres':float(bb[:,0,1].min()),'maximumGroundVariationMetres':float(np.ptp(bb[:,0,1])),'maximumAnimatedHeightMetres':float(bb[:,1,1].max()),'closedBoundsMetres':allbounds[0],'openBoundsMetres':allbounds[105], 'closedHoldMaxVertexDeltaMetres':closed_hold,'openHoldMaxVertexDeltaMetres':open_hold,'loopSeamMaxVertexDeltaMetres':loop}
print(json.dumps(report,indent=2));(BUILD/'usdz-animation-validation.json').write_text(json.dumps(report,indent=2))
assert report['minimumYMetres']>-1e-7
assert max(closed_hold,open_hold,loop)<1e-7
