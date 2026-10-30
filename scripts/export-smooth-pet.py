"""Export the motion-aligned material used by the App at GIF-friendly 25 fps."""
from pathlib import Path
import argparse,json
import cv2
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'src/assets/nailao'
parser=argparse.ArgumentParser();parser.add_argument('output',nargs='?',default=str(ROOT/'release/pet-smooth'));parser.add_argument('--video',action='store_true');args=parser.parse_args()
output=Path(args.output);(output/'透明GIF').mkdir(parents=True,exist_ok=True)
if args.video:(output/'白底MP4').mkdir(exist_ok=True)
metadata=json.loads((ASSETS/'motion-manifest.json').read_text());report=[]
labels=['01-挥手提醒','02-趴下休息','03-侧身看看','04-伸懒腰','05-安静陪伴','06-眨眼提示']
for (id,spec),label in zip(metadata.items(),labels):
    source=Image.open(ASSETS/f'nailao-action-{id}-image2.gif');poses=[];delays=[]
    palette=source.getpalette()[:];palette[765:768]=palette[:3]
    palette_image=Image.new('P',(1,1));palette_image.putpalette(palette)
    for i in range(source.n_frames):
        source.seek(i);rgba=np.array(source.convert('RGBA')).astype('float32');rgba[:,:,:3]*=rgba[:,:,3:4]/255.;poses.append(rgba);delays.append(source.info['duration'])
    width,height=source.size;atlas=np.array(Image.open(ASSETS/f'motion-{id}.png'));fields=[];masks=[];grid=spec['gridSize']
    for i in range(spec['pairs']*2):
        x=i%spec['columns']*grid;y=i//spec['columns']*grid
        flow=(atlas[y:y+grid,x:x+grid,:2].astype('float32')-128)/127*spec['range']
        fields.append(cv2.resize(flow,(width,height),interpolation=cv2.INTER_LINEAR)*width/grid)
        masks.append(cv2.resize(atlas[y:y+grid,x:x+grid,2].astype('float32')/255,(width,height),interpolation=cv2.INTER_LINEAR))
    yy,xx=np.mgrid[:height,:width].astype('float32');sequence=[];encoded=[];total=sum(delays)
    for tick in range(total//40):
        time=tick*40;index=0
        while time>=delays[index]:time-=delays[index];index+=1
        mix=time/delays[index]
        def warp(pose,field,mask,amount):
            sx=xx.copy();sy=yy.copy()
            for _ in range(4):
                velocity=cv2.remap(field,sx,sy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE);sx=xx-amount*velocity[:,:,0];sy=yy-amount*velocity[:,:,1]
            return cv2.remap(poses[pose],sx,sy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT),cv2.remap(mask,sx,sy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
        a,confidence_a=warp(index,fields[index*2],masks[index*2],mix);b,confidence_b=warp((index+1)%len(poses),fields[index*2+1],masks[index*2+1],1-mix)
        rgba=(a if mix<.5 else b).copy()
        overlap=np.clip((np.minimum(a[:,:,3:4],b[:,:,3:4])/255.-.94)/(.995-.94),0,1);overlap=overlap*overlap*(3-2*overlap)
        overlap*=np.minimum(confidence_a,confidence_b)[:,:,None]
        ca=a[:,:,:3]/np.maximum(a[:,:,3:4]/255.,.0001);cb=b[:,:,:3]/np.maximum(b[:,:,3:4]/255.,.0001)
        blend=mix*mix*(3-2*mix);material=ca*(1-blend)+cb*blend
        rgba[:,:,:3]=rgba[:,:,:3]*(1-overlap)+material*(rgba[:,:,3:4]/255.)*overlap
        alpha=rgba[:,:,3:4]/255.;rgba[:,:,:3]=np.divide(rgba[:,:,:3],alpha,out=np.zeros_like(rgba[:,:,:3]),where=alpha>1e-4)
        rgba=np.rint(rgba).clip(0,255).astype('uint8');assert not np.any(rgba[:2,:,3]>16) and not np.any(rgba[-2:,:,3]>16) and not np.any(rgba[:,:2,3]>16) and not np.any(rgba[:,-2:,3]>16),(id,tick,'clipped boundary')
        frame=Image.fromarray(rgba);sequence.append(frame)
        q=frame.convert('RGB').quantize(palette=palette_image,dither=Image.Dither.NONE);pixels=np.array(q);pixels[(pixels==255)&(rgba[:,:,3]>=128)]=0;pixels[rgba[:,:,3]<128]=255;q=Image.fromarray(pixels);q.putpalette(palette);q.info['transparency']=255;encoded.append(q)
    dest=output/'透明GIF'/f'{label}.gif';encoded[0].save(dest,save_all=True,append_images=encoded[1:],duration=40,loop=0,disposal=2,background=255,transparency=255,optimize=False)
    check=Image.open(dest);ms=0
    for i in range(check.n_frames):check.seek(i);ms+=check.info['duration']
    assert ms==total and check.n_frames>60
    if args.video:
        dest_video=output/'白底MP4'/f'{label}.mp4';writer=cv2.VideoWriter(str(dest_video),cv2.CAP_AVFOUNDATION,cv2.VideoWriter_fourcc(*'avc1'),25,(1080,1080));assert writer.isOpened()
        for _ in range(3):
            for frame in sequence:
                bg=Image.new('RGBA',frame.size,'white');bg.alpha_composite(frame);rgb=np.array(bg.convert('RGB').resize((1080,1080),Image.Resampling.LANCZOS));writer.write(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR))
        writer.release();cap=cv2.VideoCapture(str(dest_video));assert cap.isOpened() and int(cap.get(cv2.CAP_PROP_FRAME_COUNT))==len(sequence)*3;cap.release()
    report.append({'action':id,'file':dest.name,'frames':check.n_frames,'durationMs':ms,'exportFps':25,'appDisplayRate':'follows display refresh; tested near 60 fps'})
    print(id,check.n_frames,'frames',ms,'ms',flush=True)
(output/'素材信息.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(output/'使用说明.txt').write_text('休息时刻0.1.12遮挡修复版，2026-10-30。\nApp以屏幕刷新率连续补间，测试约60fps。此处GIF与视频使用相同的轮廓、内部遮挡保护与纹理过渡规则按25fps导出，GIF每轮3.2秒，视频循环三遍9.6秒。\n这是重新导出的流畅版，替代之前16帧GIF；不是原始16姿态文件的直接复制。GIF透明边缘受其格式限制，视频为白底1080方形画布（源素材非原生1080p）。\n')
