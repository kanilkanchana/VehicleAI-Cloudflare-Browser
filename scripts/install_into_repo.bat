@echo off
setlocal
set "SOURCE=%~dp0.."
set "REPO=%USERPROFILE%\OneDrive\Documents\projects\Vehical AI\vehicle-ai-traffic-monitor"
if not exist "%REPO%\.git" (
  echo Git project folder not found: "%REPO%"
  echo Edit REPO in this .bat file if your project is in another location.
  exit /b 1
)
if not exist "%REPO%\cloudflare-v8" mkdir "%REPO%\cloudflare-v8"
robocopy "%SOURCE%" "%REPO%\cloudflare-v8" /E /XD .wrangler node_modules .git /XF .dev.vars >nul
if errorlevel 8 (
  echo Copy failed. Please check the paths.
  exit /b 1
)
echo Browser V8 files copied safely to: "%REPO%\cloudflare-v8"
echo Original V7 FastAPI source was not modified.
echo NEXT: cd /d "%REPO%\cloudflare-v8" and run scripts\prepare_model.bat
endlocal
