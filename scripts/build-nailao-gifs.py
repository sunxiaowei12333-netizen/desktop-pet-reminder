from pathlib import Path
from collections import deque
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'output/nailao/image2-sequences'
DST = ROOT / 'src/assets/nailao'
SHEETS = {
    'wave': 'wave-image2-uniform12-1789291645098-1.png',
    # Replaced with a fresh Image 2 sheet: the old rest source never actually
    # reached a lying pose. Keep the filename explicit so this fix cannot be
    # lost when another atlas is added later.
    'rest': 'openai-gpt-image-2-1789298416864-1.png',
    'look': 'look-image2-complete12-1789298706176-1.png',
    'stretch': 'stretch-image2-complete12-1789298711593-1.png',
    'companion': 'companion-image2-complete12-1789298715796-1.png',
    'blink': 'blink-image2-complete12-1789298707735-1.png',
}

# Image 2 may return either a single row of twelve panels or a two-row grid of
# six panels. Split according to the actual layout of each returned sheet,
# then key only the green chroma from each frame. No checkerboard is written.
def remove_green(frame):
    rgba = frame.convert('RGBA')
    px = rgba.load(); w, h = rgba.size
    q = deque(); seen = set()
    for x in range(w): q.extend(((x, 0), (x, h - 1)))
    for y in range(h): q.extend(((0, y), (w - 1, y)))
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h): continue
        seen.add((x, y))
        r, g, b, a = px[x, y]
        # Background is saturated green; edge pixels are included by the
        # relaxed threshold and become transparent through the fringe pass.
        if g - max(r, b) < 35 or g < 100: continue
        px[x, y] = (r, g, b, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    # Decontaminate the green fringe left around whiskers and fur.  Do not
    # simply turn every green-looking pixel transparent: that can punch holes
    # into a pose.  Instead, progressively lower alpha and replace the green
    # channel with a neutral edge colour.  Fully saturated green is removed;
    # only the soft spill around the subject reaches this pass.
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not a: continue
            dominance = g - max(r, b)
            if dominance <= 8: continue
            if dominance >= 62:
                px[x, y] = (r, g, b, 0)
                continue
            keep = max(0.0, min(1.0, 1.0 - (dominance - 8) / 54.0))
            neutral_green = min(g, max(r, b) + 4)
            px[x, y] = (r, neutral_green, b, round(a * keep))
    return rgba

def clean_panel(frame):
    """Remove only panel-edge artifacts; keep the cat's feet and tail intact."""
    rgba = frame.copy()
    w, h = rgba.size
    px = rgba.load()
    # A small inset removes the white grid strokes at panel boundaries. Never
    # crop a percentage of the bottom: some poses reach the lower edge.
    for y in range(h):
        for x in range(w):
            if x < 4 or x >= w - 4 or y < 4 or y >= h - 4:
                px[x, y] = (0, 0, 0, 0)
    return rgba

def keep_subject(frame):
    """Keep the one cat in a panel and discard neighbouring-panel bleed."""
    rgba = frame.copy()
    w, h = rgba.size
    alpha = rgba.getchannel('A')
    mask = alpha.point(lambda a: 1 if a > 24 else 0)
    pix = mask.load()
    seen = set()
    components = []
    for y in range(h):
        for x in range(w):
            if not pix[x, y] or (x, y) in seen:
                continue
            stack = [(x, y)]; seen.add((x, y)); points=[]
            while stack:
                xx, yy = stack.pop(); points.append((xx, yy))
                for nx, ny in ((xx+1,yy),(xx-1,yy),(xx,yy+1),(xx,yy-1)):
                    if 0 <= nx < w and 0 <= ny < h and pix[nx, ny] and (nx, ny) not in seen:
                        seen.add((nx, ny)); stack.append((nx, ny))
            if len(points) >= 20:
                xs=[point[0] for point in points]; ys=[point[1] for point in points]
                components.append((len(points), (min(xs), min(ys), max(xs)+1, max(ys)+1), points))
    if not components:
        return rgba
    # The cat is the largest connected subject component. The generated atlas
    # sometimes lets a neighbouring panel's ear/tail bleed across a seam. A
    # previous version kept those nearby pieces and produced visible slivers
    # beside the cat (especially in stretch/look). The subject itself is
    # connected after chroma removal, so keeping only the largest component is
    # the safer contract and preserves the full tail/feet of this batch.
    components.sort(key=lambda item: item[0], reverse=True)
    _, _, main_points = components[0]
    keep = Image.new('L', (w, h), 0); keep_px = keep.load()
    for xx, yy in main_points:
        keep_px[xx, yy] = 255
    rgba.putalpha(Image.composite(alpha, Image.new('L', (w, h), 0), keep))
    return rgba

for key, filename in SHEETS.items():
    sheet = Image.open(SRC / filename).convert('RGB')
    # This batch was explicitly generated as one row of twelve equal panels.
    # Keep the layout contract explicit so an older two-row sheet can never
    # silently make the cats half-size again.
    cols, rows = 12, 1
    keyed = []
    for row in range(rows):
        for col in range(cols):
            left = round(col * sheet.width / cols)
            right = round((col + 1) * sheet.width / cols)
            top = round(row * sheet.height / rows)
            bottom = round((row + 1) * sheet.height / rows)
            keyed.append(keep_subject(clean_panel(remove_green(sheet.crop((left, top, right, bottom))))))
    boxes = [f.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox() for f in keyed]
    assert all(boxes), 'Empty pose'
    # Match all frames while reserving a real horizontal safety margin. Wide
    # poses (especially lying/stretching) must never be clipped at the sides.
    max_height = 380
    max_width = 400
    scale = min(
        max_height / max(b[3] - b[1] for b in boxes),
        max_width / max(b[2] - b[0] for b in boxes),
    )
    frames=[]
    for f,b in zip(keyed,boxes):
        crop=f.crop(b)
        crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
        canvas=Image.new('RGBA',(448,448),(0,0,0,0))
        x = (448 - crop.width) // 2
        y = 420 - crop.height
        assert x >= 0 and x + crop.width <= 448, f'Horizontal crop: {key} {crop.size}'
        assert y >= 0 and y + crop.height <= 448, f'Vertical crop: {key} {crop.size}'
        canvas.alpha_composite(crop,(x,y))
        frames.append(canvas)
    # Play forward and back so every action returns smoothly to its start;
    # there are no hard jumps or repeated still frames.
    sequence = frames + frames[-2:0:-1]
    # Twelve source poses played forward and back make a 22-frame loop. At
    # 140ms the complete loop is just over three seconds: quick enough for a
    # reminder, but slow enough to read as one continuous action.
    duration = 140
    # Reserve palette index 255 explicitly; do not accidentally make dark fur transparent.
    palette_source=Image.new('RGB',(448*len(sequence),448),'white')
    for i,f in enumerate(sequence): palette_source.paste(f.convert('RGB'),(448*i,0))
    palette=palette_source.quantize(colors=255)
    encoded=[]
    for f in sequence:
        q=f.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE)
        q.paste(255,mask=f.getchannel('A').point(lambda a: 255 if a < 128 else 0))
        q.info['transparency']=255
        encoded.append(q)
    out = DST / f'nailao-action-{key}-image2.gif'
    encoded[0].save(out,save_all=True,append_images=encoded[1:],duration=duration,
                   loop=0,disposal=2,transparency=255,optimize=False)
    print(key, 'poses=',len(frames),'playback frames=',len(encoded))
