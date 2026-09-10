"""Write a proof scene for Apple's usdrecord without modifying the AR model."""
from pathlib import Path
import os
from pxr import Usd,UsdGeom,Gf
ROOT=Path(__file__).resolve().parents[1]
BUILD=Path(os.environ.get('DUO_AR_BUILD_DIR', str(ROOT.parents[2]/'ar-export')))
stage=Usd.Stage.CreateNew(str(BUILD/'native-proof.usda'))
stage.GetRootLayer().subLayerPaths=[str(ROOT/'assets/duo-fold.usdz')]
UsdGeom.SetStageUpAxis(stage,UsdGeom.Tokens.y);UsdGeom.SetStageMetersPerUnit(stage,1)
c=UsdGeom.Camera.Define(stage,'/ProofCamera');c.CreateFocalLengthAttr(45);c.CreateClippingRangeAttr(Gf.Vec2f(.001,100));c.CreateHorizontalApertureAttr(36);c.CreateVerticalApertureAttr(30)
transform=Gf.Matrix4d().SetLookAt(Gf.Vec3d(.18,.30,.24),Gf.Vec3d(-.04,.015,0),Gf.Vec3d(0,1,0)).GetInverse()
UsdGeom.Xformable(c).AddTransformOp().Set(transform);stage.GetRootLayer().Save()
print(BUILD/'native-proof.usda')
