@echo off
setlocal
cd /d "%~dp0.."
if exist "public\models\yolo26n.onnx" (
  echo ONNX model already found in public\models.
  exit /b 0
)
set "SRC=..\VehicleAI-Cloudflare-V8\public\models\yolo26n.onnx"
if not exist "%SRC%" (
  echo ERROR: Existing V8 ONNX model not found at "%SRC%".
  echo Run: conda activate vehicle-ai
  echo Then: scripts\prepare_model.bat
  exit /b 1
)
copy "%SRC%" "public\models\yolo26n.onnx" >nul
if errorlevel 1 (echo ERROR: Model copy failed.& exit /b 1)
echo Copied existing YOLO26n ONNX model to V10.
