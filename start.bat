@echo off
chcp 65001 >nul
title DOIN local site

rem Prefer 46810; fall back to the next free port if taken by another project
for /f %%p in ('powershell -NoProfile -Command "$busy=@(Get-NetTCPConnection -State Listen -EA SilentlyContinue).LocalPort; for($p=46810;$p -lt 46910;$p++){if(-not $busy.Contains($p)){$p;break}}"') do set PORT=%%p

rem Delay-open the browser so the server is ready
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:%PORT%"

echo ============================================
echo   DOIN local site
echo   http://localhost:%PORT%
echo   Games (local source paths): /games/nuts/ /games/sudoku/
echo   Close this window to stop the server.
echo ============================================
npx --yes serve . -l %PORT%
