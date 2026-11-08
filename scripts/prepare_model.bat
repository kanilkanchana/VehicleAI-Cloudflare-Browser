@echo off
cd /d "%~dp0.."
python -m pip install -U ultralytics onnx
if errorlevel 1 exit /b 1
python scripts\prepare_model.py
