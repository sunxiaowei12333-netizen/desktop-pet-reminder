from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,hashlib,os,shutil,zipfile
REPO=Path(__file__).resolve().parents[2]
ROOT=Path(os.environ.get('SEQUENCE_WORK',REPO/'release/sequence-work')).resolve()
ROOT.mkdir(parents=True,exist_ok=True)
OUT=Path(os.environ.get('SEQUENCE_EXPORT',REPO/'release/pet-gifs')).resolve();OUT.mkdir(parents=True,exist_ok=True)
LABELS={'wave':'01-举爪招呼','rest':'02-卧着眯眼','look':'03-转头看看','stretch':'04-伸展放松','companion':'05-歪头陪伴','blink':'06-坐着眨眼'}
report={}
for id,label in LABELS.items():
 frames=[Image.open(p).convert('RGBA') for p in sorted((ROOT/'candidate'/id/'frames').glob('*.png'))]
 sample=Image.new('RGB',(448,448+64*((len(frames)+6)//7)),'white')
 sample.paste(frames[0].convert('RGB'),(0,0))
 for i,f in enumerate(frames):sample.paste(f.convert('RGB').resize((64,64)),((i%7)*64,448+(i//7)*64))
 palette=sample.quantize(colors=255,method=Image.Quantize.MEDIANCUT);palette.putpalette(palette.getpalette()[:765]+[0,0,0])
 encoded=[];maxError=0
 for f in frames:
  q=f.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE);arr=np.array(q);rgba=np.array(f);m=rgba[:,:,3]>=128;arr[~m]=255
  pal=Image.fromarray(arr);pal.putpalette(palette.getpalette());pal.info['transparency']=255;encoded.append(pal)
  color=np.array(q.convert('RGB'));maxError=max(maxError,float(np.abs(color.astype(float)-rgba[:,:,:3].astype(float))[m].mean()))
 durations=[(round((i+1)*100/30)-round(i*100/30))*10 for i in range(len(frames))]
 dest=OUT/f'{label}.gif';encoded[0].save(dest,save_all=True,append_images=encoded[1:],duration=durations,loop=0,transparency=255,disposal=2,optimize=False)
 # Decode every export timestamp; prove previous paws leave no alpha residue.
 with Image.open(dest) as gif:
  decoded=[];timeline=[]
  for i in range(gif.n_frames):gif.seek(i);decoded.append(np.array(gif.convert('RGBA')));timeline.append(gif.info['duration'])
  t=0;j=0;end=timeline[0]
  for i,f in enumerate(frames):
   while t>=end and j<len(decoded)-1:j+=1;end+=timeline[j]
   assert np.array_equal(np.array(f)[:,:,3]>=128,decoded[j][:,:,3]>=128),(id,i,'alpha trail')
   t+=durations[i]
  assert sum(timeline)==sum(durations)
 assert maxError<3,(id,maxError)
 shutil.copy2(dest,REPO/'src/assets/nailao/sequences'/f'sequence-{id}.gif')
 shutil.copy2(ROOT/'encoded'/f'sequence-{id}.webp',OUT/f'{label}-App同源.webp')
 report[id]={'gif':dest.name,'gifSha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'durationMs':sum(durations),'frames':len(decoded),'paletteMeanErrorMax':maxError,'alphaMatchesEveryFrame':True}
 print(id,report[id],flush=True)
(OUT/'导出核对.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
(ROOT/'export-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
