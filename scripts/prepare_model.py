from pathlib import Path
from shutil import copy2
from ultralytics import YOLO
root=Path(__file__).resolve().parents[1]
model=YOLO('yolo26n.pt')
source=Path(model.export(format='onnx',imgsz=640))
target=root/'public/models/yolo26n.onnx';target.parent.mkdir(parents=True,exist_ok=True)
copy2(source,target)
size=target.stat().st_size/(1024**2)
print(f'Exported model {target} ({size:.2f} MiB)')
if size>25: raise SystemExit('Model exceeds Cloudflare Pages 25 MiB asset limit; use a quantized export or alternative model hosting.')
