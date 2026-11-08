@echo off
setlocal
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (echo Node.js is required. & exit /b 1)
if not exist "public\models\yolo26n.onnx" (
  echo ERROR: Model missing from public\models\yolo26n.onnx.
  echo Copy from V8 using scripts\copy_model_from_v8.bat.
  exit /b 1
)
node --check public\app.js
if errorlevel 1 exit /b 1
node --check public\tracker.mjs
if errorlevel 1 exit /b 1
node --test
if errorlevel 1 exit /b 1
echo.
echo Code checks passed. Review git status and ensure secrets are not staged before pushing.
