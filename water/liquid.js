// Inner bottle profile, shared by geometry, clipping, and volume integration.
export const PROFILE = Object.freeze([
  [-1.60,.50],[-1.58,.57],[-1.53,.63],[-1.45,.657],[-1.32,.66],
  [.62,.66],[.76,.647],[.90,.60],[1.04,.525],[1.18,.417],[1.31,.292],
  [1.40,.233],[1.48,.23],[1.66,.23],
]);
export const RADIUS = .66;
export function radiusAtHeight(y) {
  if (y < PROFILE[0][0] || y > PROFILE.at(-1)[0]) return 0;
  for (let i=1;i<PROFILE.length;i++) if (y<=PROFILE[i][0]) {
    const [a,ra]=PROFILE[i-1], [b,rb]=PROFILE[i];
    return ra+(rb-ra)*(y-a)/(b-a);
  }
  return .23;
}
export function analyticCapacity() {
  let volume=0;
  for(let i=1;i<PROFILE.length;i++){
    const [a,ra]=PROFILE[i-1],[b,rb]=PROFILE[i];
    volume+=Math.PI*(b-a)*(ra*ra+ra*rb+rb*rb)/3;
  }
  return volume;
}
function columnBounds(r) {
  let bottom=PROFILE[0][0],top=PROFILE.at(-1)[0];
  if(r>PROFILE[0][1]) for(let i=1;i<PROFILE.length;i++){
    const [a,ra]=PROFILE[i-1],[b,rb]=PROFILE[i];
    if(ra<r&&rb>=r){bottom=a+(b-a)*(r-ra)/(rb-ra);break;}
  }
  if(r>PROFILE.at(-1)[1]) for(let i=PROFILE.length-1;i>0;i--){
    const [a,ra]=PROFILE[i-1],[b,rb]=PROFILE[i];
    if(ra>=r&&rb<r){top=a+(b-a)*(r-ra)/(rb-ra);break;}
  }
  return [bottom,top];
}
export class BottleVolume {
  constructor(resolution=64) {
    this.columns=[];this.capacity=0;
    const step=RADIUS*2/resolution;
    this.area=step*step;
    for(let z=0;z<resolution;z++)for(let x=0;x<resolution;x++){
      const px=-RADIUS+(x+.5)*step,pz=-RADIUS+(z+.5)*step;
      const r=Math.hypot(px,pz);if(r>=RADIUS)continue;
      const [bottom,top]=columnBounds(r);
      this.columns.push({x:px,z:pz,bottom,top,relative:0});
      this.capacity+=(top-bottom)*this.area;
    }
  }
  prepare(nx,nz,waves) {
    for(const c of this.columns)c.relative=-nx*c.x-nz*c.z+(waves?waves.sample(c.x,c.z):0);
  }
  volumeAt(offset) {
    let sum=0;
    for(const c of this.columns)sum+=Math.max(0,Math.min(c.top,offset+c.relative)-c.bottom);
    return sum*this.area;
  }
  solve(fraction,nx=0,nz=0,waves=null) {
    this.prepare(nx,nz,waves);
    const target=Math.max(0,Math.min(1,fraction))*this.capacity;
    const extent=(Math.abs(nx)+Math.abs(nz))*RADIUS+.22;
    let low=PROFILE[0][0]-extent,high=PROFILE.at(-1)[0]+extent;
    for(let i=0;i<19;i++){
      const mid=(low+high)/2;
      if(this.volumeAt(mid)<target)low=mid;else high=mid;
    }
    this.offset=(low+high)/2;
    this.fraction=this.volumeAt(this.offset)/this.capacity;
    return this.offset;
  }
}
// Damped 2D wave equation on a circular domain, integrated with fixed substeps.
// Reflective (zero normal gradient) boundary; zero mean displacement conserves mass.
export class SurfaceWaves {
  constructor(size=48) {
    this.size=size;this.h=new Float32Array(size*size);this.v=new Float32Array(size*size);
    this.next=new Float32Array(size*size);this.mask=new Uint8Array(size*size);
    this.step=RADIUS*2/(size-1);this.accumulator=0;this.time=0;
    for(let z=0;z<size;z++)for(let x=0;x<size;x++)this.mask[z*size+x]=Math.hypot(x*this.step-RADIUS,z*this.step-RADIUS)<RADIUS?1:0;
  }
  impulse(px=0,pz=0,strength=.7) {
    for(let z=0;z<this.size;z++)for(let x=0;x<this.size;x++){
      const i=z*this.size+x;if(!this.mask[i])continue;
      const dx=x*this.step-RADIUS-px,dz=z*this.step-RADIUS-pz;
      this.v[i]+=strength*Math.exp(-(dx*dx+dz*dz)/.026);
    }
  }
  stepForward(dt,idle=true) {
    this.accumulator+=Math.min(dt,.5);
    const substep=1/120,n=this.size,c2=.55*.55,dx2=this.step*this.step;
    while(this.accumulator>=substep){
      this.accumulator-=substep;this.time+=substep;
      let mean=0,meanVelocity=0,count=0;
      for(let z=0;z<n;z++)for(let x=0;x<n;x++){
        const i=z*n+x;if(!this.mask[i])continue;
        const center=this.h[i];let lap=0;
        for(const j of [x>0?i-1:i,x<n-1?i+1:i,z>0?i-n:i,z<n-1?i+n:i])lap+=(this.mask[j]?this.h[j]:center)-center;
        const forcing=idle?.12*Math.sin(this.time*2.7+(x-n/2)*.18+(z-n/2)*.21):0;
        this.v[i]+=(c2*lap/dx2-1.4*this.v[i]+forcing)*substep;
        this.next[i]=center+this.v[i]*substep;
        mean+=this.next[i];meanVelocity+=this.v[i];count++;
      }
      mean/=count;meanVelocity/=count;
      let maxHeight=0;
      for(let i=0;i<this.h.length;i++)if(this.mask[i]){
        this.h[i]=this.next[i]-mean;this.v[i]-=meanVelocity;
        maxHeight=Math.max(maxHeight,Math.abs(this.h[i]));
      }
      const scale=Math.min(1,.13/Math.max(maxHeight,.000001));
      if(scale<1)for(let i=0;i<this.h.length;i++)if(this.mask[i]){this.h[i]*=scale;this.v[i]*=scale;}
    }
  }
  sample(x,z) {
    const n=this.size;
    const fx=Math.max(0,Math.min(n-1,(x+RADIUS)/(RADIUS*2)*(n-1)));
    const fz=Math.max(0,Math.min(n-1,(z+RADIUS)/(RADIUS*2)*(n-1)));
    const x0=Math.floor(fx),z0=Math.floor(fz),x1=Math.min(n-1,x0+1),z1=Math.min(n-1,z0+1),tx=fx-x0,tz=fz-z0;
    return (this.h[z0*n+x0]*(1-tx)+this.h[z0*n+x1]*tx)*(1-tz)+(this.h[z1*n+x0]*(1-tx)+this.h[z1*n+x1]*tx)*tz;
  }
  clear(){this.h.fill(0);this.v.fill(0);this.next.fill(0);this.accumulator=0;}
}
export function springStep(value,velocity,target,dt,frequency=7,damping=.22){
  const a=damping*frequency,b=frequency*Math.sqrt(1-damping*damping),e=Math.exp(-a*dt),c=Math.cos(b*dt),s=Math.sin(b*dt),y=value-target;
  return [target+e*(y*(c+a*s/b)+velocity*s/b),e*(velocity*(c-a*s/b)-y*frequency*frequency*s/b)];
}
