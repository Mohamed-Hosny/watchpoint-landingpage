@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Watch Point - Local Admin Server

rem ============================================================
rem  Watch Point - local admin panel + public-site preview server
rem  Usage:
rem    start-admin.bat                 -> open the local admin panel
rem    start-admin.bat 8080            -> custom port
rem    start-admin.bat --no-browser    -> server only
rem  Stop: CTRL+C or close this window.
rem ============================================================

set "ROOT=%~dp0"
set "ADMIN=%ROOT%local-admin"
set "SITE=%ROOT%public-site"
set "PORT=8123"
set "OPEN=1"

if /i "%~1"=="--no-browser" set "OPEN=0"
if /i "%~1"=="-n" set "OPEN=0"
if not "%~1"=="" if /i not "%~1"=="--no-browser" if /i not "%~1"=="-n" set "PORT=%~1"
if /i "%~2"=="--no-browser" set "OPEN=0"
if /i "%~2"=="-n" set "OPEN=0"

if not exist "%ADMIN%\server.mjs" (
  echo [ERROR] local-admin\server.mjs not found in:
  echo         %ADMIN%
  echo.
  pause
  exit /b 1
)

if not exist "%SITE%\index.html" (
  echo [ERROR] public-site\index.html not found in:
  echo         %SITE%
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is required to run the admin panel.
  echo         Install it from https://nodejs.org/ then run this file again.
  echo.
  pause
  exit /b 1
)

rem ---- if the admin panel is already running on the default port, just open it ----
set "RUNNING_PORT="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "try { $r = Invoke-WebRequest 'http://127.0.0.1:%PORT%/admin/login' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -lt 500) { %PORT% } } catch { if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -in 200,301,302,400,401,403) { %PORT% } }"`) do set "RUNNING_PORT=%%P"
if defined RUNNING_PORT (
  echo ============================================================
  echo   Watch Point local admin is already running on port %RUNNING_PORT%
  echo   Opening: http://127.0.0.1:%RUNNING_PORT%/admin
  echo ============================================================
  echo.
  if "%OPEN%"=="1" start "" "http://127.0.0.1:%RUNNING_PORT%/admin"
  exit /b 0
)

rem ---- pick the first free port starting from %PORT% ----
:findport
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>nul
if errorlevel 1 goto :portok
set /a PORT+=1
if %PORT% GTR 8140 (
  echo [ERROR] No free port found between 8123 and 8140.
  echo         Close the other servers and try again.
  echo.
  pause
  exit /b 1
)
goto :findport
:portok

set "ADMIN_URL=http://127.0.0.1:%PORT%/admin"
set "SITE_URL=http://127.0.0.1:%PORT%/"

echo ============================================================
echo   Watch Point - Local Admin Panel (Static Site + Local Admin)
echo ------------------------------------------------------------
echo   Site   : %SITE_URL%  (public-site)
echo   Admin  : %ADMIN_URL%  (local-admin)
echo   Data   : local-admin\data\store.json
echo   Stop   : CTRL+C  (or close this window)
echo ============================================================
echo.
echo   Changes made in Admin automatically update public-site\.
echo   Run "git push" when ready to publish online via Cloudflare Pages.
echo.

if "%OPEN%"=="1" (
  start "" /min powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process '%ADMIN_URL%'"
  echo Opening browser at %ADMIN_URL% ...
  echo.
)

cd /d "%ADMIN%"
node server.mjs --port=%PORT%

echo.
echo Server stopped.
pause
