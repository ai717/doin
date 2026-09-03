@echo off
setlocal
title DOIN - Push main

cd /d "%~dp0"
if errorlevel 1 (
  echo [ERROR] Cannot open project directory.
  pause
  exit /b 1
)

rem Use the local proxy when GitHub is unreachable directly.
set "HTTPS_PROXY=http://127.0.0.1:7897"
set "HTTP_PROXY=http://127.0.0.1:7897"
set "ALL_PROXY=http://127.0.0.1:7897"

echo [1/3] Selecting GitHub account: ai717
gh auth switch --user ai717
if errorlevel 1 goto :failed

echo [2/3] Pushing main to GitHub...
git push origin main
if errorlevel 1 (
  echo.
  echo [ERROR] Push failed. If GitHub reports a missing workflow scope, run:
  echo   gh auth refresh -h github.com -s workflow
  echo Then double-click publish.bat again.
  goto :failed
)

echo.
echo [3/3] Push completed. GitHub Actions will publish the site automatically.
pause
exit /b 0

:failed
echo.
echo Push did not complete. Review the error above.
pause
exit /b 1
