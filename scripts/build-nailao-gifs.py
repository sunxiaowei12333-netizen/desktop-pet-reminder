"""Build all runtime/export GIFs from alpha sprite atlases (no chroma key).

Requires: python3 -m pip install -r scripts/requirements-assets.txt
The whole subject is extracted by connected alpha, not fixed grid crops:
generated sprites can extend past an approximate grid boundary.
"""
from pathlib import Path
import hashlib
import json
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/pet-motion-v2'
DEST = ROOT / 'src/assets/nailao'
IDS = ['wave', 'rest', 'look', 'stretch', 'companion', 'blink']
SIZE, BASELINE, MAX_WIDTH, MAX_HEIGHT = 448, 414, 368, 368
REPORT = {}


def extract_subjects(sheet):
    rgba = np.array(sheet.convert('RGBA'))
    count, labels, stats, centers = cv2.connectedComponentsWithStats((rgba[:, :, 3] > 32).astype('uint8'))
    subjects = [i for i in range(1, count) if stats[i, cv2.CC_STAT_AREA] > 1000]
    if len(subjects) != 16:
        raise ValueError(f'Expected 16 separate complete cats; got {len(subjects)}')
    subjects.sort(key=lambda i: centers[i][1])
    ordered = []
    for row in range(4):
        ordered.extend(sorted(subjects[row * 4:(row + 1) * 4], key=lambda i: centers[i][0]))
    frames = []
    for i in ordered:
        x, y, w, h, area = map(int, stats[i])
        if x <= 1 or y <= 1 or x + w >= sheet.width - 1 or y + h >= sheet.height - 1:
            raise ValueError(f'Cat touches the atlas edge: {(x, y, w, h)}; regenerate, never hide the cut with padding')
        # Preserve soft fur and thin whiskers around the detected opaque body.
        # RGB values at alpha 1 can be saturated encoding noise: erase these,
        # without changing any visible body color or punching chroma holes.
        neighborhood = cv2.dilate((labels == i).astype('uint8'), np.ones((9, 9), 'uint8'))
        frame = rgba.copy()
        frame[:, :, 3] = np.where((neighborhood > 0) & (frame[:, :, 3] > 8), frame[:, :, 3], 0)
        frame[frame[:, :, 3] == 0] = 0
        frame = Image.fromarray(frame)
        frames.append(frame.crop(frame.getbbox()))
    return frames


def build(action):
    source = SOURCE / f'{action}.png'
    frames = extract_subjects(Image.open(source))
    scale = min(MAX_WIDTH / max(f.width for f in frames), MAX_HEIGHT / max(f.height for f in frames))
    aligned = []
    for frame in frames:
        frame = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (SIZE, SIZE))
        canvas.alpha_composite(frame, ((SIZE - frame.width) // 2, BASELINE - frame.height))
        aligned.append(canvas)
    # A shared palette keeps color quantization stable across the whole cycle.
    palette_image = Image.new('RGB', (SIZE * 16, SIZE), 'white')
    for i, frame in enumerate(aligned):
        background = Image.new('RGBA', frame.size, 'white')
        background.alpha_composite(frame)
        palette_image.paste(background.convert('RGB'), (i * SIZE, 0))
    palette = palette_image.quantize(colors=255, dither=Image.Dither.NONE)
    encoded = []
    for frame in aligned:
        q = frame.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE)
        q.paste(255, mask=frame.getchannel('A').point(lambda a: 255 if a < 128 else 0))
        q.info['transparency'] = 255
        encoded.append(q)
    durations = [180] * 16
    # Readable neutral holds at the start/end and the peak; no reversed locomotion.
    for i in [0, 7, 8, 15]:
        durations[i] = 260
    out = DEST / f'nailao-action-{action}-image2.gif'
    encoded[0].save(out, save_all=True, append_images=encoded[1:], duration=durations,
                    loop=0, disposal=2, background=255, transparency=255, optimize=False)
    decoded = Image.open(out)
    assert decoded.n_frames == 16
    bounds, green, interior_holes = [], 0, 0
    for i in range(decoded.n_frames):
        decoded.seek(i)
        f = decoded.convert('RGBA'); pixels = np.array(f)
        a = pixels[:, :, 3]
        box = f.getbbox(); bounds.append(box)
        assert box and min(box[0], box[1], SIZE - box[2], SIZE - box[3]) >= 24, (action, i, box)
        green += int((((pixels[:, :, 1].astype(int) - np.maximum(pixels[:, :, 0], pixels[:, :, 2])) > 8) & (a > 128)).sum())
        n, lab, st, _ = cv2.connectedComponentsWithStats((a == 0).astype('uint8'))
        for x, y, w, h, area in st[1:]:
            if x > 0 and y > 0 and x + w < SIZE and y + h < SIZE:
                interior_holes += int(area)
    assert green == 0, (action, 'green pixels', green)
    # Enclosed gaps between overlapping legs can be anatomically correct.
    # Record them for review rather than filling real negative space in fur.
    REPORT[action] = {'frames': 16, 'durationMs': sum(durations), 'size': [SIZE, SIZE],
                      'greenPixels': green, 'enclosedTransparentPixels': interior_holes,
                      'bounds': bounds, 'sha256': hashlib.sha256(out.read_bytes()).hexdigest()}
    print(action, '16 frames', sum(durations), 'ms; full safety margins; green pixels:', green)


if __name__ == '__main__':
    for action in IDS:
        build(action)
    (SOURCE / 'validation.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=2) + '\n')
