from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,hashlib,os
REPO=Path(__file__).resolve().parents[2]
ROOT=Path(os.environ.get('SEQUENCE_WORK',REPO/'release/sequence-work')).resolve()
ROOT.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'encoded';OUT.mkdir(exist_ok=True)
ids=['wave','rest','look','stretch','companion','blink'];manifest={'version':1,'width':448,'height':448,'fps':30,'rendering':'lossless pre-rendered RGBA sequences; no runtime morphing','actions':{}}
for id in ids:
 frames=[Image.open(p).convert('RGBA') for p in sorted((ROOT/'candidate'/id/'frames').glob('*.png'))]
 cleaned=[]
 for f in frames:
  a=np.array(f);a[a[:,:,3]<=3]=0;cleaned.append(Image.fromarray(a))
 durations=[round((i+1)*1000/30)-round(i*1000/30) for i in range(len(frames))]
 dst=OUT/f'sequence-{id}.webp'
 cleaned[0].save(dst,save_all=True,append_images=cleaned[1:],duration=durations,loop=0,lossless=True,quality=100,method=4,exact=True,minimize_size=True)
 # Decode at every source timestamp; WebP may combine identical hold frames.
 decoded=[];times=[]
 with Image.open(dst) as im:
  for i in range(im.n_frames):
   im.seek(i);f=im.convert('RGBA');decoded.append(np.array(f));times.append(im.info.get('duration',0))
 t=0;errors=[];di=0;dt=times[0]
 for i,f in enumerate(cleaned):
  while t>=dt and di<len(decoded)-1:di+=1;dt+=times[di]
  a=np.array(f);b=decoded[di];mask=(a[:,:,3]>0)|(b[:,:,3]>0)
  errors.append(int(np.abs(a.astype(int)-b.astype(int))[mask].max(initial=0)))
  t+=durations[i]
 assert max(errors)==0,(id,max(errors))
 bbox=[];areas=[];green=0;pop=[];first=None;last=None
 for f in cleaned:
  a=np.array(f);m=a[:,:,3]>32;yy,xx=np.where(m);bbox.append([int(xx.min()),int(yy.min()),int(xx.max()),int(yy.max())]);areas.append(int((a[:,:,3]>128).sum()))
  c=a[:,:,:3].astype(int);green+=int(((c[:,:,1]>c[:,:,0]+15)&(c[:,:,1]>c[:,:,2]+10)&(a[:,:,3]>128)).sum())
  p=c*(a[:,:,3:4]/255.)+127*(1-a[:,:,3:4]/255.)
  if last is not None:pop.append(float(np.abs(p-last).mean()))
  last=p
 bounds=[min(b[0] for b in bbox),min(b[1] for b in bbox),max(b[2] for b in bbox),max(b[3] for b in bbox)]
 staticVariation=float((max(areas)/min(areas))**.5-1)
 spec={'file':dst.name,'sha256':hashlib.sha256(dst.read_bytes()).hexdigest(),'bytes':dst.stat().st_size,'sourceFrames':len(frames),'encodedFrames':len(decoded),'durationMs':sum(durations),'decodedMaxPixelError':max(errors),'bounds':bounds,'greenPixels':green,'maxFrameMeanDelta':max(pop),'areaEquivalentVariation':staticVariation,'uniqueFrames':len({hashlib.sha256(np.array(f).tobytes()).digest() for f in cleaned})}
 manifest['actions'][id]=spec
 print(id,spec,flush=True)
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
