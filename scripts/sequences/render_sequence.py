"""Offline animation renderer. Source PNGs are immutable; candidates only, no deployment.
Neural flow estimates poses; exactly the same flow/mask carries premultiplied RGBA.
A static-region compositor protects nonmoving pixels before and after interpolation.
"""
from pathlib import Path
import sys,json,time,hashlib,os
import cv2,numpy as np
from PIL import Image,ImageDraw
import torch
REPO=Path(__file__).resolve().parents[2]
ROOT=Path(os.environ.get('SEQUENCE_WORK',REPO/'release/sequence-work')).resolve()
ROOT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'upstream'))
from train_log.IFNet_HDv3 import IFNet
SOURCE=REPO/'assets/sequence-keyframes'
DEVICE='mps' if torch.backends.mps.is_available() else 'cpu'
torch.set_num_threads(4)
model=IFNet().eval().to(DEVICE)
weights=torch.load(ROOT/'upstream/train_log/flownet.pkl',map_location='cpu',weights_only=True)
weights={k.removeprefix('module.'):v for k,v in weights.items()}
weights={k:v for k,v in weights.items() if not k.startswith(('teacher.','caltime.'))}
model.load_state_dict(weights,strict=True)

def rgba(path):return np.array(Image.open(path).convert('RGBA')).astype('float32')/255

def premul(a):return np.concatenate([a[:,:,:3]*a[:,:,3:4],a[:,:,3:4]],2)

def unpremul(a):
 alpha=np.clip(a[:,:,3:4],0,1)
 return np.concatenate([np.clip(a[:,:,:3]/np.maximum(alpha,1e-6),0,1),alpha],2)

def save(a,p):
 p.parent.mkdir(exist_ok=True,parents=True)
 Image.fromarray(np.rint(np.clip(unpremul(a),0,1)*255).astype('uint8')).save(p)

def mask_polygon(points):
 m=np.zeros((448,448),np.float32);cv2.fillPoly(m,[np.array(points,np.int32)],1)
 # Feather only in a narrow band. Protected regions remain mathematically exact.
 return cv2.GaussianBlur(m,(0,0),1.7)[:,:,None]

def register(frames,roi):
 x,y,w,h=roi;ref=frames[0];gray=lambda a:cv2.cvtColor(a[:,:,:3]*a[:,:,3:4]+.5*(1-a[:,:,3:4]),cv2.COLOR_RGB2GRAY)
 template=gray(ref)[y:y+h,x:x+w];out=[];report=[]
 for i,f in enumerate(frames):
  mat=np.eye(2,3,dtype=np.float32)
  if i:
   search=gray(f)[y-32:y+h+32,x-32:x+w+32]
   corr=cv2.matchTemplate(search,template,cv2.TM_CCOEFF_NORMED)
   _,score,_,loc=cv2.minMaxLoc(corr)
   mat[:,2]=[loc[0]-32,loc[1]-32]
   if score<.75:raise ValueError(f'low alignment confidence {i}: {score}')
  else:score=1
  if np.max(np.abs(mat[:,2]))>32:raise ValueError(f'alignment too large {i}: {mat}')
  out.append(cv2.warpAffine(premul(f),mat,(448,448),flags=cv2.INTER_LINEAR|cv2.WARP_INVERSE_MAP,borderMode=cv2.BORDER_CONSTANT))
  report.append({'frame':i,'translation':mat[:,2].tolist(),'score':float(score)})
 return out,report

def tensor(a):
 # First RGB guides flow; last four channels carry display data. Transparent RGB
 # is premultiplied, so no arbitrary invisible colors can contaminate fur edges.
 rgb=a[:,:,:3]+.5*(1-a[:,:,3:4]);packed=np.concatenate([rgb,a],2)
 t=torch.from_numpy(packed.transpose(2,0,1)).unsqueeze(0).to(DEVICE)
 return torch.nn.functional.pad(t,(0,64,0,64),mode='constant',value=0)

@torch.inference_mode()
def middle(a,b,t):
 _,_,outputs=model(torch.cat([tensor(a),tensor(b)],1),timestep=t,scale_list=[16,8,4,2,1])
 return outputs[-1][0,3:7,:448,:448].permute(1,2,0).cpu().numpy()

def run_wave():
 name='wave';raw=[rgba(SOURCE/'wave-v2'/f'{i:03}.png') for i in range(8)]
 aligned,registration=register(raw,(105,55,220,175))
 mask=mask_polygon([(200,430),(200,345),(228,310),(230,240),(265,200),(265,150),(340,150),(346,275),(285,330),(266,430)])
 base=aligned[0]
 keys=[base*(1-mask)+f*mask for f in aligned]
 out=ROOT/'candidate'/name;out.mkdir(exist_ok=True,parents=True)
 for i,f in enumerate(keys):save(f,out/'keys'/f'{i:03}.png')
 ascending=[];start=time.monotonic()
 for i in range(7):
  ascending.append(keys[i])
  for j in range(1,6):
   f=middle(keys[i],keys[i+1],j/6)
   f=base*(1-mask)+f*mask
   ascending.append(f)
  print(name,'segment',i+1,'/7',round(time.monotonic()-start,1),'s',flush=True)
 ascending.append(keys[-1])
 # Genuine position progression at 30fps; no image crossfade or whole-cat scale.
 frames=[keys[0]]*24+ascending+[keys[-1]]*12+list(reversed(ascending))+[keys[0]]*2
 for i,f in enumerate(frames):save(f,out/'frames'/f'{i:03}.png')
 # Lossless preview; GIF is not used to judge color/texture fidelity.
 images=[Image.fromarray(np.rint(np.clip(unpremul(f),0,1)*255).astype('uint8')) for f in frames]
 images[0].save(out/'preview.png',save_all=True,append_images=images[1:],duration=[33,33,34]*(len(images)//3)+[33]*(len(images)%3),loop=0,disposal=0,blend=0)
 sheet=Image.new('RGB',(6*224,4*250),'#667586');d=ImageDraw.Draw(sheet)
 indices=np.linspace(0,len(frames)-1,24).round().astype(int)
 for k,i in enumerate(indices):
  bg=Image.new('RGBA',(224,224),'#667586');bg.alpha_composite(images[i].resize((224,224),Image.Resampling.LANCZOS));sheet.paste(bg.convert('RGB'),(k%6*224,k//6*250));d.text((k%6*224+8,k//6*250+229),f'{i/30:.2f}s',fill='white')
 sheet.save(out/'full-cycle.jpg')
 static=mask[:,:,0]<1e-8
 report={'action':name,'method':'aligned source poses, static-region compositor, RIFE 4.25 shared RGBA warp','device':DEVICE,'frameCount':len(frames),'fps':30,'durationMs':len(frames)/30*1000,'registration':registration,'staticPixelMaxError':float(max(np.abs(f[static]-base[static]).max() for f in frames)),'loopMaxError':float(np.abs(frames[0]-frames[-1]).max()),'status':'candidate: visual QA pending'}
 (out/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2),flush=True)

if __name__=='__main__' and ('wave' in sys.argv or len(sys.argv)==1):run_wave()

# Action-specific stationary regions. Full head/limb motion stays in source poses.
def other_setup(name):
 folder={'rest':'rest-v1','blink':'blink-v1','look':'look-v1','companion':'companion-v1','stretch':'stretch-v1'}[name]
 count=8 if name!='companion' else 5
 raw=[rgba(SOURCE/folder/f'{i:03}.png') for i in range(count)]
 if name=='stretch':
  aligned=[];registration=[]
  for i,f in enumerate(raw):
   yy,xx=np.indices((448,448));m=f[:,:,3]>.6
   xmax=xx[m & (yy>250)].max()
   side=m & (xx>xmax-38);bottom=yy[side].max()
   paw=side & (yy>bottom-15);cx=float(xx[paw].mean())
   scale=.9;dx=350-scale*cx;dy=360-scale*bottom
   mat=np.array([[scale,0,dx],[0,scale,dy]],np.float32)
   aligned.append(cv2.warpAffine(premul(f),mat,(448,448),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT))
   registration.append({'frame':i,'hindPawX':cx,'hindPawBottom':int(bottom),'globalScale':scale,'translation':[float(dx),float(dy)]})
  return aligned,np.ones((448,448,1),np.float32),registration
 roi={'rest':(130,248,90,40),'blink':(135,149,95,40),'look':(145,375,95,40),'companion':(135,275,135,120)}[name]
 aligned,registration=register(raw,roi)
 if name in ['rest','blink']:
  centers={'rest':[(140,232),(205,237)],'blink':[(151,133),(214,133)]}[name]
  m=np.zeros((448,448),np.float32)
  for c in centers:cv2.ellipse(m,c,(29,21),0,0,360,1,-1)
  mask=cv2.GaussianBlur(m,(0,0),2)[:,:,None]
 elif name=='look':mask=mask_polygon([(60,20),(355,20),(355,240),(290,272),(125,268),(60,220)])
 else:mask=mask_polygon([(75,25),(290,25),(305,135),(278,220),(234,250),(132,250),(75,200)])
 if name=='look':
  # The rotating head may extend outside the neutral head, but the torso's
  # silhouette must remain fixed. Protect the torso edge, not the head edge.
  distance=cv2.distanceTransform((aligned[0][:,:,3]>.98).astype('uint8'),cv2.DIST_L2,5)
  guard=np.clip((distance-5)/10,0,1)
  torso=np.clip((np.indices((448,448))[0]-205)/25,0,1)
  mask*=((1-torso)+torso*guard)[:,:,None]
 return aligned,mask,registration

def eye_pair(a):
 rgb=unpremul(a);c=rgb[:,:,:3]*255
 m=((c.sum(2)<220)&(rgb[:,:,3]>.86)&(c[:,:,0]<125)&(c[:,:,1]<85)).astype('uint8')
 n,l,stats,centers=cv2.connectedComponentsWithStats(m,8)
 parts=sorted([(int(stats[k,4]),centers[k]) for k in range(1,n) if stats[k,4]>5],key=lambda p:p[0],reverse=True)[:2]
 if len(parts)!=2:raise ValueError('cannot locate the two pupil landmarks')
 a,b=sorted([p[1] for p in parts],key=lambda p:p[0]);return a,b

def normalize_head_scale(frames):
 a,b=eye_pair(frames[0]);reference=np.linalg.norm(a-b);out=[];audit=[]
 yy,xx=np.mgrid[:448,:448].astype('float32')
 for i,f in enumerate(frames):
  a,b=eye_pair(f);distance=np.linalg.norm(a-b);factor=reference/distance;center=(a+b)/2
  if not .85<factor<1.2:raise ValueError(f'implausible head scale correction {factor}')
  radius=np.sqrt(((xx-center[0])/90)**2+((yy-center[1])/100)**2)
  w=np.clip((1.35-radius)/.6,0,1);w=w*w*(3-2*w)
  mx=xx+(center[0]-xx)*(1-1/factor)*w;my=yy+(center[1]-yy)*(1-1/factor)*w
  fixed=cv2.remap(f,mx.astype(np.float32),my.astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
  aa,bb=eye_pair(fixed);out.append(fixed)
  audit.append({'frame':i,'inputDistance':float(distance),'headScaleOnly':float(factor),'outputDistance':float(np.linalg.norm(aa-bb)),'eyeMidpoint':center.tolist()})
 return out,audit

def run_other(name):
 aligned,mask,registration=other_setup(name)
 headAudit=[]
 if name in ['stretch','companion']:aligned,headAudit=normalize_head_scale(aligned)
 base=aligned[0];keys=[base*(1-mask)+f*mask for f in aligned]
 out=ROOT/'candidate'/name;out.mkdir(exist_ok=True,parents=True)
 for i,f in enumerate(keys):save(f,out/'keys'/f'{i:03}.png')
 steps=(9 if name=='companion' else 6) if name not in ['rest','blink'] else (3 if name=='rest' else 2)
 asc=[];start=time.monotonic()
 for i in range(len(keys)-1):
  asc.append(keys[i])
  for j in range(1,steps):
   f=middle(keys[i],keys[i+1],j/steps);f=base*(1-mask)+f*mask;asc.append(f)
 asc.append(keys[-1])
 hold={'rest':30,'blink':3,'look':18,'stretch':18,'companion':20}[name]
 frames=[keys[0]]*24+asc+[keys[-1]]*hold+list(reversed(asc))+[keys[0]]*24
 images=[]
 for stale in (out/'frames').glob('*.png'):
  if int(stale.stem)>=len(frames):stale.unlink()
 for i,f in enumerate(frames):
  save(f,out/'frames'/f'{i:03}.png');images.append(Image.fromarray(np.rint(np.clip(unpremul(f),0,1)*255).astype('uint8')))
 images[0].save(out/'preview.png',save_all=True,append_images=images[1:],duration=[33,33,34]*(len(images)//3)+[33]*(len(images)%3),loop=0,disposal=0,blend=0)
 sheet=Image.new('RGB',(6*224,4*250),'#667586');d=ImageDraw.Draw(sheet)
 for k,i in enumerate(np.linspace(0,len(frames)-1,24).round().astype(int)):
  bg=Image.new('RGBA',(224,224),'#667586');bg.alpha_composite(images[i].resize((224,224),Image.Resampling.LANCZOS));sheet.paste(bg.convert('RGB'),(k%6*224,k//6*250));d.text((k%6*224+8,k//6*250+229),f'{i/30:.2f}s',fill='white')
 sheet.save(out/'full-cycle.jpg')
 static=mask[:,:,0]<1e-8
 report={'action':name,'method':'aligned source poses, static-region compositor, RIFE 4.25 shared RGBA warp','device':DEVICE,'frameCount':len(frames),'fps':30,'durationMs':len(frames)/30*1000,'registration':registration,'headScaleAudit':headAudit,'staticPixelMaxError':float(max(np.abs(f[static]-base[static]).max() for f in frames)) if static.any() else None,'loopMaxError':float(np.abs(frames[0]-frames[-1]).max()),'status':'candidate: visual QA pending'}
 (out/'report.json').write_text(json.dumps(report,indent=2));print(name,len(frames),'frames',round(time.monotonic()-start,1),'s',flush=True)

if __name__=='__main__':
 for name in ['rest','blink','look','companion','stretch']:
  if len(sys.argv)==1 or name in sys.argv:
   print('start',name,flush=True);run_other(name)
