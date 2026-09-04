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

echo [1/4] Selecting GitHub account: ai717
gh auth switch --user ai717
if errorlevel 1 goto :failed

echo [2/4] Preparing a commit from pending changes...
git add -A
if errorlevel 1 goto :failed

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "chore: publish pending changes"
  if errorlevel 1 goto :failed
) else (
  echo No uncommitted changes; reusing the current commit.
)

echo [3/4] Pushing main to GitHub...
git push origin main
if errorlevel 1 (
  echo.
  echo [INFO] Push failed. Refreshing ai717 workflow permission, then retrying once...
  gh auth refresh -h github.com -s workflow
  if errorlevel 1 goto :failed
  git push origin main
  if errorlevel 1 goto :failed
)

echo.
echo [4/4] Push completed. GitHub Actions will publish the site automatically.
pause
exit /b 0

:failed
echo.
echo Push did not complete. Review the error above.
pause
exit /b 1
