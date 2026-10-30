/** Authored deformation of ONE immutable texture per action. Coordinates: 448px. */
export const RIG_DURATION_MS = 4800;
export const RIGS = {
  wave: { eyes:[[172,167,17,13],[223,170,17,13]], head:[195,218,84,105], chest:[227,292,74,78] },
  rest: { eyes:[[132,250,20,18],[192,255,20,18]], head:[163,290,100,135], chest:[172,327,91,49] },
  look: { eyes:[], head:[173,226,90,130], chest:[241,286,74,85] },
  stretch: { eyes:[], head:[203,361,95,92], chest:[252,298,84,72] },
  companion: { eyes:[], head:[175,207,94,152], chest:[182,271,82,80] },
  blink: { eyes:[[151,125,20,16],[212,126,20,16]], head:[182,197,106,156], chest:[191,258,92,90] },
};
const smooth = t => { t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10); };
const envelope = (t,a,b,c,d) => smooth((t-a)/(b-a))*(1-smooth((t-c)/(d-c)));
const weight = (x,y,cx,cy,rx,ry) => Math.exp(-(((x-cx)/rx)**4+((y-cy)/ry)**4));

export function poseFor(id, phase) {
  const t=((phase%1)+1)%1, breathe=Math.sin(Math.PI*t)**2;
  const p={close:0,headAngle:0,headX:0,headY:0,pawAngle:0,pawX:0,pawY:0,chestY:-.65*breathe,tailX:0};
  if(id==='rest'){p.close=.94*envelope(t,.12,.27,.61,.85);p.headY=1.1*breathe;p.chestY=-.8*breathe;}
  if(id==='blink')p.close=.94*Math.min(1,envelope(t,.12,.2,.27,.39)+envelope(t,.63,.70,.75,.87));
  if(id==='wave') {const e=envelope(t,.08,.25,.72,.94);p.pawAngle=.14*Math.sin(t*Math.PI*4)*e;p.pawX=3*Math.sin(t*Math.PI*4)*e;p.pawY=-10*e;p.headAngle=.012*breathe;p.tailX=1.5*Math.sin(t*2*Math.PI);}
  if(id==='look') {const e=envelope(t,.08,.32,.59,.91);p.headAngle=-.055*e;p.headX=-5*e;p.headY=.5*e;p.tailX=2*Math.sin(t*2*Math.PI);}
  if(id==='companion'){p.headAngle=.055*Math.sin(t*2*Math.PI);p.headY=.7*breathe;}
  if(id==='stretch'){const e=envelope(t,.08,.34,.61,.94);p.headX=-5*e;p.headY=3*e;p.chestY=1.5*e;p.tailX=3*Math.sin(t*2*Math.PI);}
  return p;
}

export function createRigMesh(id, step=4) {
  const rig=RIGS[id];if(!rig)throw new Error(`Unknown pet rig: ${id}`);
  const side=Math.round(448/step)+1, count=side*side;
  const source=new Float32Array(count*2), positions=new Float32Array(count*2), uv=new Float32Array(count*2);
  const weights=new Float32Array(count*5);
  for(let j=0;j<side;j++)for(let i=0;i<side;i++) {
    const n=j*side+i,x=i*448/(side-1),y=j*448/(side-1);source[n*2]=x;source[n*2+1]=y;uv[n*2]=x/448;uv[n*2+1]=y/448;
    const [hx,hy,hrx,hry]=rig.head;
    weights[n*5]=weight(x,y,hx,hy-70,hrx,hry)* (1-smooth((y-(hy-12))/60));
    weights[n*5+1]=weight(x,y,...rig.chest)*(1-smooth((y-350)/36));
    weights[n*5+2]=id==='wave'?weight(x,y,152,272,35,57):0;
    weights[n*5+3]=weight(x,y,id==='stretch'?300:282,id==='stretch'?134:99,48,62);
    let eye=0;for(const [ex,ey,rx,ry] of rig.eyes)eye+=(y-ey)*weight(x,y,ex,ey,rx,ry);
    weights[n*5+4]=eye;
  }
  const indices=new Uint16Array((side-1)*(side-1)*6);let k=0;
  for(let j=0;j<side-1;j++)for(let i=0;i<side-1;i++){const a=j*side+i,b=a+1,c=a+side,d=c+1;indices.set([a,b,c,b,d,c],k);k+=6;}
  return {id,rig,side,source,positions,uv,weights,indices};
}

export function deformRig(mesh, phase) {
  const p=poseFor(mesh.id,phase),{source,positions,weights,rig}=mesh;
  const ca=Math.cos(p.headAngle),sa=Math.sin(p.headAngle),pc=Math.cos(p.pawAngle),ps=Math.sin(p.pawAngle),hx=rig.head[0],hy=rig.head[1];
  for(let n=0;n<source.length/2;n++) {
    const x=source[n*2],y=source[n*2+1],h=weights[n*5],ch=weights[n*5+1],paw=weights[n*5+2];
    const eyeDY=-p.close*weights[n*5+4],dx=x-hx,dy=y+eyeDY-hy;
    let nx=x+h*((ca-1)*dx-sa*dy+p.headX),ny=y+eyeDY+h*(sa*dx+(ca-1)*dy+p.headY)+ch*p.chestY;
    nx+=paw*((pc-1)*(x-158)-ps*(y-222)+p.pawX)+weights[n*5+3]*p.tailX;
    ny+=paw*(ps*(x-158)+(pc-1)*(y-222)+p.pawY);
    positions[n*2]=nx;positions[n*2+1]=ny;
  }
  return positions;
}
