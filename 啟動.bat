@echo off
setlocal EnableExtensions
cd /d "%~dp0."

set "PY="
if exist "%UserProfile%\miniconda3\envs\use\python.exe" set "PY=%UserProfile%\miniconda3\envs\use\python.exe"
if not defined PY if exist "%UserProfile%\miniconda3\python.exe" set "PY=%UserProfile%\miniconda3\python.exe"
if not defined PY if exist "%UserProfile%\anaconda3\python.exe" set "PY=%UserProfile%\anaconda3\python.exe"
if not defined PY (
  for /f "delims=" %%P in ('where python 2^>nul') do (
    echo %%P | find /i "\WindowsApps\" >nul
    if errorlevel 1 if not defined PY set "PY=%%P"
  )
)
if not defined PY if exist "%LocalAppData%\Programs\Python\Python313\python.exe" set "PY=%LocalAppData%\Programs\Python\Python313\python.exe"
if not defined PY if exist "%LocalAppData%\Programs\Python\Python312\python.exe" set "PY=%LocalAppData%\Programs\Python\Python312\python.exe"
if not defined PY if exist "%LocalAppData%\Programs\Python\Python311\python.exe" set "PY=%LocalAppData%\Programs\Python\Python311\python.exe"

if not defined PY (
  echo Python was not found.
  echo Install Python 3, or Miniconda, then try again.
  echo.
  pause
  exit /b 1
)

echo Starting Ark server with:
echo   %PY%
echo.
"%PY%" scripts\serve.py
if errorlevel 1 (
  echo.
  echo Failed to start. Tried:
  echo   "%PY%" scripts\serve.py
  echo.
  pause
  exit /b 1
)