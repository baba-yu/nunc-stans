@echo off
REM ===========================================================
REM  Daily update script - called from Claude Cowork or manual.
REM  Parses report\ and future-prediction\ markdown, recomputes
REM  analytics, writes docs\data\*.json for GitHub Pages.
REM ===========================================================

setlocal EnableExtensions EnableDelayedExpansion

set "APP_DIR=%~dp0"
set "APP_DIR=%APP_DIR:~0,-1%"
pushd "%APP_DIR%" >nul || (
  echo [update_pages] Could not cd into %APP_DIR%
  exit /b 1
)

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  set "PY=py -3"
) else (
  set "PY=python"
)

echo [update_pages] %DATE% %TIME%  processing 4 locales (en, ja, es, fil)
echo [update_pages] %DATE% %TIME%  running %PY% -m src.cli update
%PY% -m src.cli update
set "RC=%ERRORLEVEL%"

popd >nul

if %RC% NEQ 0 (
  echo [update_pages] FAILED with exit code %RC%
  exit /b %RC%
)

echo [update_pages] OK
exit /b 0
