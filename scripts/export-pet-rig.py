#!/usr/bin/env python3
"""Encode frames rendered by verify-pet-rig.cjs --export; never interpolate images.
Usage: python3 scripts/export-pet-rig.py FRAME_DIR OUTPUT_DIR [--update-assets]
Requires Pillow, numpy and opencv-python (macOS AVFoundation H264).
"""
import sys,json,hashlib,shutil,zipfile,os
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
import cv2
root=Path(__file__).resolve().parents[1]
frames_root=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
ids=['wave','rest','look','stretch','companion','blink']
names=['01-举爪招呼','02-卧着眯眼','03-侧头看看','04-伸展放松','05-歪头陪伴','06-坐着眨眼']
manifest_path=root/'src/assets/nailao/rig/manifest.json';manifest=json.loads(manifest_path.read_text());all_frames={};report={}
def writer(dest,size):
    temp=dest.with_name(dest.stem+'.tmp.mp4');temp.unlink(missing_ok=True)
    w=cv2.VideoWriter(str(temp),cv2.CAP_AVFOUNDATION,cv2.VideoWriter_fourcc(*'avc1'),25,size)
    if not w.isOpened():raise RuntimeError('H264 writer unavailable')
    return w,temp
for id,name in zip(ids,names):
    files=sorted((frames_root/id).glob('*.png'));assert len(files)==120,(id,len(files))
    frames=[Image.open(p).convert('RGBA') for p in files];all_frames[id]=frames
    samples=Image.new('RGB',(448,448+64*20),(255,255,255));samples.paste(frames[0].convert('RGB'),(0,0))
    for i,f in enumerate(frames):samples.paste(f.convert('RGB').resize((64,64)),((i%7)*64,448+(i//7)*64))
    palette=samples.quantize(colors=255,method=Image.Quantize.MEDIANCUT);pal=palette.getpalette()[:765]+[0,0,0]
    palette.putpalette(pal);encoded=[]
    for f in frames:
        q=f.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE)
        pixels=np.array(q);pixels[np.array(f.getchannel('A'))<128]=255
        q=Image.fromarray(pixels);q.putpalette(pal);q.info['transparency']=255;encoded.append(q)
    dest=out/f'{name}.gif';encoded[0].save(dest,save_all=True,append_images=encoded[1:],duration=40,loop=0,transparency=255,disposal=2,optimize=False)
    with Image.open(dest) as gif:
        duration=0
        for i in range(gif.n_frames):gif.seek(i);duration+=gif.info['duration']
        assert duration==4800 and gif.n_frames>=100,(id,duration,gif.n_frames)
        report[id]={'frames':gif.n_frames,'durationMs':duration,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
    # Decode the GIF at all 120 source timestamps, including coalesced holds.
    # Exact alpha agreement catches disposal/trailing-paw ghosts in the export.
    decoded=[]
    with Image.open(dest) as gif:
        for i in range(gif.n_frames):
            gif.seek(i);decoded.extend([np.array(gif.convert('RGBA'))] * (gif.info['duration']//40))
    assert len(decoded)==120
    errors=[]
    for source,result in zip(frames,decoded):
        rgba=np.array(source);mask=rgba[:,:,3]>=128
        assert np.array_equal(mask,result[:,:,3]>128), f'{id}: GIF alpha trail'
        errors.append(float(np.abs(rgba[:,:,:3].astype(float)-result[:,:,:3])[mask].mean()))
    report[id]['maxPaletteMeanError']=max(errors)
    assert max(errors)<3, f'{id}: excessive GIF palette error'
    if '--update-assets' in sys.argv:
        shutil.copy2(dest,root/f'src/assets/nailao/nailao-action-{id}-image2.gif');manifest['actions'][id]['gifSha256']=report[id]['sha256']
    video=out/f'{name}-白底1080.mp4';w,temp=writer(video,(1080,1080))
    for _ in range(3):
        for f in frames:
            bg=Image.new('RGBA',(448,448),'white');bg.alpha_composite(f);rgb=np.array(bg.convert('RGB').resize((1080,1080),Image.Resampling.LANCZOS));w.write(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR))
    w.release();os.replace(temp,video)
    cap=cv2.VideoCapture(str(video));assert int(cap.get(cv2.CAP_PROP_FRAME_COUNT))==360;cap.release()
    print(id,report[id],flush=True)
if '--update-assets' in sys.argv:manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
# Three complete loops of all six actions; this is a renderer export, not a desktop screen recording.
video=out/'六动作完整对照-三轮.mp4';w,temp=writer(video,(1008,720))
for _ in range(3):
    for i in range(120):
        sheet=Image.new('RGBA',(1008,720),'#667586');draw=ImageDraw.Draw(sheet)
        for k,id in enumerate(ids):
            x=(k%3)*336;y=(k//3)*360;sheet.alpha_composite(all_frames[id][i].resize((336,336),Image.Resampling.LANCZOS),(x,y));draw.text((x+12,y+338),f'{id}  {i/25:.2f}s',fill='white')
        w.write(cv2.cvtColor(np.array(sheet.convert('RGB')),cv2.COLOR_RGB2BGR))
w.release();os.replace(temp,video)
(out/'export-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
html='''<!doctype html><meta charset="utf-8"><title>休息时刻 六动作检查</title><style>body{font:16px system-ui;margin:32px;background:#edf1f5;color:#243447}video{max-width:100%;width:1008px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.card{background:#667586;color:white;padding:16px;border-radius:16px}.card img{width:100%}a{color:inherit}</style><h1>六动作固定贴图版</h1><p>与 App 共用固定贴图与网格动作。App 随刷新率播放；GIF/视频为 25fps、每轮 4.8 秒，视频重复三轮。GIF 只有 256 色且透明边缘较硬，白底视频更适合发布。</p><video src="六动作完整对照-三轮.mp4" controls loop autoplay muted></video><div class="grid">'''
for id,name in zip(ids,names):html+=f'<div class="card"><h2>{name}</h2><img src="{name}.gif"><a href="{name}.gif" download>保存 GIF</a> · <a href="{name}-白底1080.mp4" download>保存视频</a></div>'
(out/'检查预览.html').write_text(html+'</div>')
with zipfile.ZipFile(out/'六个猫咪动图和视频.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in out.iterdir():
        if p.suffix in ['.gif','.mp4','.html','.json']:z.write(p,p.name)
