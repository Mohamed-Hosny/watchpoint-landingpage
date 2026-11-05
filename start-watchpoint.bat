@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Watch Point - Local Server

rem ============================================================
rem  Watch Point landing page - local static server launcher
rem  Usage:
rem    start-watchpoint.bat                -> port 8123 + browser
rem    start-watchpoint.bat 8080           -> custom port + browser
rem    start-watchpoint.bat --no-browser   -> port 8123, no browser
rem  Close this window or press CTRL+C to stop the server.
rem ============================================================

set "ROOT=%~dp0"
set "SITE=%ROOT%watch-point-landing"
set "PORT=8123"
set "OPEN=1"

if /i "%~1"=="--no-browser" set "OPEN=0"
if /i "%~1"=="-n" set "OPEN=0"
if not "%~1"=="" if /i not "%~1"=="--no-browser" if /i not "%~1"=="-n" set "PORT=%~1"
if /i "%~2"=="--no-browser" set "OPEN=0"
if /i "%~2"=="-n" set "OPEN=0"

if not exist "%SITE%\index.html" (
  echo [ERROR] index.html not found in:
  echo         %SITE%
  echo.
  pause
  exit /b 1
)

rem ---- pick the first free port starting from %PORT% ----
:findport
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>nul
if errorlevel 1 goto :portok
set /a PORT+=1
if %PORT% GTR 8150 (
  echo [ERROR] No free port found between 8123 and 8150.
  echo         Close the other servers and try again.
  echo.
  pause
  exit /b 1
)
goto :findport
:portok

set "URL=http://127.0.0.1:%PORT%/"

echo ============================================================
echo   Watch Point - Landing Page
echo ------------------------------------------------------------
echo   Folder : %SITE%
echo   URL    : %URL%
echo   Stop   : CTRL+C  (or close this window)
echo ============================================================
echo.

if "%OPEN%"=="1" (
  start "" /min powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process '%URL%'"
  echo Opening browser at %URL% ...
  echo.
)

rem ---- run the server (Python first, Node.js as fallback) ----
cd /d "%SITE%"

where py >nul 2>nul
if not errorlevel 1 (
  py -m http.server %PORT% --bind 127.0.0.1
  goto :done
)

where python >nul 2>nul
if not errorlevel 1 (
  python -m http.server %PORT% --bind 127.0.0.1
  goto :done
)

where npx >nul 2>nul
if not errorlevel 1 (
  echo Python not found - using Node.js ^(npx serve^) instead.
  echo.
  npx --yes serve "%SITE%" -l %PORT%
  goto :done
)

echo [ERROR] Neither Python nor Node.js was found on this machine.
echo         Install Python from https://www.python.org/downloads/
echo         or Node.js from https://nodejs.org/ and run this file again.
echo.
pause
exit /b 1

:done
echo.
echo Server stopped.
pause
