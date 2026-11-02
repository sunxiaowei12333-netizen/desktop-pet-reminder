import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const regions = { wave:[125,105,100,115], rest:[70,320,300,70], blink:[100,240,250,135],
  look:[140,300,170,90], companion:[130,275,170,110] };
const range = values => Math.max(...values)-Math.min(...values);
function pupils(data, off, w, h) {
  const mask=new Uint8Array(w*h), seen=new Uint8Array(w*h), parts=[];
  for(let i=0;i<w*h;i++){const p=off+i*4;
    mask[i]=data[p+3]>220&&data[p]<125&&data[p+1]<85&&data[p]+data[p+1]+data[p+2]<220?1:0;
  }
  for(let seed=0;seed<mask.length;seed++)if(mask[seed]&&!seen[seed]){
    let sumX=0,sumY=0,count=0;const stack=[seed];seen[seed]=1;
    while(stack.length){const p=stack.pop(),x=p%w,y=Math.floor(p/w);sumX+=x;sumY+=y;count++;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;
        const q=yy*w+xx;if(mask[q]&&!seen[q]){seen[q]=1;stack.push(q);}
      }
    }
    if(count>5)parts.push({count,x:sumX/count,y:sumY/count});
  }
  parts.sort((a,b)=>b.count-a.count);const pair=parts.slice(0,2).sort((a,b)=>a.x-b.x);
  if(pair.length!==2)throw Error('Could not find both pupil landmarks');
  const [a,b]=pair;return {distance:Math.hypot(b.x-a.x,b.y-a.y),y:(a.y+b.y)/2,roll:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};
}
export async function inspectSequenceAssets(root='src/assets/nailao/sequences') {
  const manifest=JSON.parse(readFileSync(`${root}/manifest.json`));const actions={},checks=[];
  const check=(name,pass)=>checks.push({name,pass:!!pass});
  for(const [id,spec] of Object.entries(manifest.actions)){
    const file=`${root}/${spec.file}`,bytes=readFileSync(file),sha256=createHash('sha256').update(bytes).digest('hex');
    const meta=await sharp(file,{animated:true}).metadata();
    const {data,info}=await sharp(file,{animated:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const w=info.width,h=info.height/meta.pages,stride=w*h*4;
    let green=0,boundary=0,staticError=0,maxStep=0,headLeft=[],eye=[],darkEyes=[],foot=[];
    const bounds=[w,h,0,0];let firstArea=0,areas=[],unique=new Set();
    for(let f=0;f<meta.pages;f++){
      const off=f*stride;let area=0,left=w,step=0,dark=0,footPixels=0;
      const visibleFrame=Buffer.from(data.subarray(off,off+stride));
      for(let p=0;p<visibleFrame.length;p+=4) if(visibleFrame[p+3]===0) visibleFrame.fill(0,p,p+3);
      unique.add(createHash('sha256').update(visibleFrame).digest('hex'));
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const p=off+(y*w+x)*4,a=data[p+3];
        if(a>32){bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}
        if(a>128){area++;if(x<24||y<24||x>=w-24||y>=h-24)boundary++;
          if(data[p+1]>data[p]+15&&data[p+1]>data[p+2]+10)green++;
          if(y<230)left=Math.min(left,x);
          if(x>=210&&x<260&&y>=367&&y<412)footPixels++;
        }
        if((id==='rest'&&x>=110&&x<236&&y>=211&&y<260)||(id==='blink'&&x>=120&&x<244&&y>=110&&y<160)){
          if(a>220&&data[p]+data[p+1]+data[p+2]<220)dark++;
        }
        if(f){const q=p-stride;for(let c=0;c<3;c++)step+=Math.abs(data[p+c]*a/255+127*(1-a/255)-data[q+c]*data[q+3]/255-127*(1-data[q+3]/255));}
      }
      if(f===0)firstArea=area;areas.push(area);headLeft.push(left);darkEyes.push(dark);foot.push(footPixels);
      maxStep=Math.max(maxStep,step/(w*h*3));
      if(regions[id]){const [x,y,rw,rh]=regions[id];for(let yy=y;yy<y+rh;yy++)for(let xx=x;xx<x+rw;xx++)for(let c=0;c<4;c++){
        const p=(yy*w+xx)*4+c;staticError=Math.max(staticError,Math.abs(data[off+p]-data[p]));
      }}
      if(id==='stretch'||id==='companion')eye.push(pupils(data,off,w,h));
    }
    let loopError=0;const lastOff=(meta.pages-1)*stride;
    for(let p=0;p<stride;p+=4){loopError=Math.max(loopError,Math.abs(data[p+3]-data[lastOff+p+3]));
      if(data[p+3]||data[lastOff+p+3])for(let c=0;c<3;c++)loopError=Math.max(loopError,Math.abs(data[p+c]-data[lastOff+p+c]));
    }
    const durationMs=meta.delay.reduce((a,b)=>a+b,0);
    const r={sha256,decodedFrames:meta.pages,uniqueFrames:unique.size,durationMs,bounds,greenPixels:green,boundaryPixels:boundary,staticPixelMaxError:staticError,maxFrameMeanDelta:maxStep,loopError};
    check(`${id}: hash and lossless frame timeline`,sha256===spec.sha256&&durationMs===spec.durationMs&&meta.pages===spec.encodedFrames);
    check(`${id}: full canvas and safe transparent margins`,w===448&&h===448&&boundary===0&&Math.min(...areas)>10000);
    check(`${id}: no green contamination`,green===0);
    check(`${id}: exact loop`,loopError===0);
    check(`${id}: no abrupt whole-frame step`,maxStep<4);
    if(regions[id])check(`${id}: stationary region remains identical`,staticError===0);
    if(id==='wave'){
      r.groundedPawPixels=foot[0];r.minimumGroundedPawPixels=Math.min(...foot);
      check('wave: paw starts on ground and fully lifts',foot[0]>1000&&Math.min(...foot)<foot[0]*.15&&unique.size>=35);
    }
    if(id==='look'){r.headLeftEdgeTravel=range(headLeft);check('look: full front-to-side turn',range(headLeft)>=30&&unique.size>=35);}
    if(id==='rest'||id==='blink'){
      r.openEyeDarkPixels=darkEyes[0];r.closedEyeDarkPixels=Math.min(...darkEyes);
      check(`${id}: complete eyelid closure`,darkEyes[0]>200&&Math.min(...darkEyes)<darkEyes[0]*.35);
      check(`${id}: body silhouette does not change size`,areas.every(n=>n===firstArea));
    }
    if(eye.length){
      r.eyeDistanceMin=Math.min(...eye.map(e=>e.distance));r.eyeDistanceMax=Math.max(...eye.map(e=>e.distance));
      r.headScaleVariation=r.eyeDistanceMax/r.eyeDistanceMin-1;r.headVerticalTravel=range(eye.map(e=>e.y));r.headRollRange=range(eye.map(e=>e.roll));
      check(`${id}: head landmark scale stays within 3%`,r.headScaleVariation<.03);
      if(id==='stretch')check('stretch: full standing-to-low-stretch motion',r.headVerticalTravel>=120&&unique.size>=35);
      else check('companion: clear head tilt matching original amplitude',r.headRollRange>=15&&r.headRollRange<=27&&unique.size>=30);
    }
    actions[id]=r;
  }
  return {version:JSON.parse(readFileSync('package.json')).version,method:'decode every lossless WebP frame; stationary pixels, alpha bounds, landmarks, full-action evidence and frame steps',actions,checks,pass:checks.every(c=>c.pass),note:'Automated checks are necessary, not a substitute for visual review of complete cycles and occlusion.'};
}
