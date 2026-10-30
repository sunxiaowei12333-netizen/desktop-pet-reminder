"""Precompute dense bidirectional motion; runtime only uploads small flow maps.
Smooth displacement fields keep fine fur from rippling independently. Cyclic last-to-first motion is included.
"""
from pathlib import Path
import hashlib,json
import cv2
import numpy as np
from PIL import Image
from pet_motion_confidence import material_confidence
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'src/assets/nailao'
GRID=224
result={}
for action in ['wave','rest','look','stretch','companion','blink']:
    source=DEST/f'nailao-action-{action}-image2.gif'
    image=Image.open(source);frames=[];colors=[];alphas=[]
    for i in range(image.n_frames):
        image.seek(i);a=np.array(image.convert('RGBA').resize((GRID,GRID),Image.Resampling.LANCZOS))
        alpha=a[:,:,3:4]/255.
        rgb=(a[:,:,:3]*alpha+127*(1-alpha)).clip(0,255).astype('uint8')
        frames.append(cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY));colors.append(rgb.astype('float32'));alphas.append(a[:,:,3])
    fields=[];confidences=[]
    for i,a in enumerate(frames):
        b=frames[(i+1)%len(frames)]
        for first,second in [(a,b),(b,a)]:
            dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
            dis.setFinestScale(0)
            field=dis.calc(first,second,None)
            fields.append(cv2.GaussianBlur(field,(0,0),2.0))
    for k,field in enumerate(fields):
        i=k//2;j=(i+1)%len(frames)
        if k%2:i,j=j,i
        confidences.append(material_confidence(colors[i],colors[j],alphas[i],alphas[j],frames[i],field))
    extent=max(float(np.abs(f).max()) for f in fields)
    motion_range=max(8,int(np.ceil((extent+1)/8))*8)
    atlas=np.zeros((GRID*8,GRID*4,3),dtype='uint8');atlas[:,:,2]=255
    for i,field in enumerate(fields):
        encoded=np.clip(np.rint(field*127/motion_range+128),0,255).astype('uint8')
        y=(i//4)*GRID;x=(i%4)*GRID
        atlas[y:y+GRID,x:x+GRID,:2]=encoded
        atlas[y:y+GRID,x:x+GRID,2]=confidences[i]
    output=DEST/f'motion-{action}.png';Image.fromarray(atlas).save(output,optimize=True)
    result[action]={'range':motion_range,'gridSize':GRID,'columns':4,'pairs':len(frames),'flowSmoothingSigma':2.0,'occlusionConfidence':True,
                    'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
                    'atlasSha256':hashlib.sha256(output.read_bytes()).hexdigest()}
    print(action,'maximum flow',round(extent,2),'range',motion_range,'bytes',output.stat().st_size)
(DEST/'motion-manifest.json').write_text(json.dumps(result,indent=2)+'\n')
