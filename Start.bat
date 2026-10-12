@echo off
cd /d "%~dp0"
set "BUNDLED_PYTHON=C:\Users\dell\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%BUNDLED_PYTHON%" (
  "%BUNDLED_PYTHON%" server.py
) else (
  python server.py
)
pause
