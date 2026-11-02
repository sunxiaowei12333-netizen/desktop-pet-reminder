"""Fetch the author's pinned RIFE 4.25 archive for offline asset building only."""
from pathlib import Path
import os,hashlib,urllib.request,zipfile
root=Path(os.environ.get('SEQUENCE_WORK',Path(__file__).resolve().parents[2]/'release/sequence-work')).resolve()
root.mkdir(parents=True,exist_ok=True)
archive=root/'rife-v4.25.zip'
expected='e63d481b7ae5d4a4e6ad7ac5b410ff78f3bf7be3b51b2e38ca8152747abde5b4'
if not archive.exists():
 urllib.request.urlretrieve('https://drive.usercontent.google.com/download?id=1ZKjcbmt1hypiFprJPIKW0Tt0lr_2i7bg&export=download&confirm=t',archive)
if hashlib.sha256(archive.read_bytes()).hexdigest()!=expected:
 raise SystemExit('Model archive checksum mismatch; do not run it.')
with zipfile.ZipFile(archive) as z:
 for name in ['train_log/IFNet_HDv3.py','train_log/flownet.pkl']:
  dst=root/'upstream'/name;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(z.read(name))
print('Verified RIFE 4.25 ready:',root/'upstream')
