@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Watch Point - Publish Public Site Online

rem ============================================================
rem  Watch Point - One-click publisher (public-site -> GitHub -> Cloudflare Pages)
rem  Usage:
rem    publish-online.bat                  -> auto timestamp commit & push
rem    publish-online.bat "My note"        -> custom commit message & push
rem    publish-online.bat --no-pause       -> exit without waiting for keypress
rem ============================================================

set "ROOT=%~dp0"
set "NO_PAUSE=0"
set "CUSTOM_MSG="

if /i "%~1"=="--no-pause" (
  set "NO_PAUSE=1"
) else if not "%~1"=="" (
  set "CUSTOM_MSG=%~1"
)
if /i "%~2"=="--no-pause" set "NO_PAUSE=1"

cd /d "%ROOT%"

echo ============================================================
echo   Watch Point - Publish Online (Cloudflare Pages)
echo ============================================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed or not in PATH.
  goto :fail
)

if not exist "%ROOT%.git" (
  echo [ERROR] Git repository not found in: %ROOT%
  goto :fail
)

if not exist "%ROOT%public-site\index.html" (
  echo [ERROR] public-site\index.html not found.
  goto :fail
)

rem ---- Check if there are changes inside public-site/ ----
set "HAS_CHANGES=0"
for /f "delims=" %%L in ('git status --porcelain -- public-site') do (
  set "HAS_CHANGES=1"
)

if "!HAS_CHANGES!"=="0" (
  rem Check if there are unpushed local commits
  set "AHEAD=0"
  for /f "delims=" %%C in ('git rev-list --count @{u}..HEAD 2^>nul') do set "AHEAD=%%C"
  if "!AHEAD!"=="0" (
    echo [INFO] No new changes detected inside public-site\.
    echo        Everything is already published and up to date.
    echo.
    goto :done
  )
  echo [INFO] Found !AHEAD! unpushed commit^(s^). Pushing to GitHub...
  echo.
  git push origin main
  if errorlevel 1 (
    echo.
    echo [ERROR] git push failed. Check your internet connection and try again.
    goto :fail
  )
  goto :success
)

rem ---- Stage ONLY public-site/ (never local-admin/) ----
echo [1/3] Staging changes in public-site\ ...
git add -A -- public-site
if errorlevel 1 (
  echo [ERROR] Failed to stage public-site changes.
  goto :fail
)

rem ---- Defense-in-depth safety check: ensure NO local-admin/sensitive file is staged ----
set "LEAK_FOUND=0"
for /f "delims=" %%F in ('git diff --cached --name-only') do (
  echo %%F | findstr /I /R "^local-admin/ auth\.json$ store\.json$ backups/" >nul
  if not errorlevel 1 (
    echo [SECURITY BLOCK] Sensitive file detected in staging: %%F
    set "LEAK_FOUND=1"
  )
)
if "!LEAK_FOUND!"=="1" (
  git reset >nul 2>nul
  echo [ERROR] Publish aborted for safety. Nothing was committed or pushed.
  goto :fail
)

rem ---- Count staged files ----
set "FILE_COUNT=0"
for /f "delims=" %%F in ('git diff --cached --name-only') do (
  set /a FILE_COUNT+=1
)

if "!FILE_COUNT!"=="0" (
  echo [INFO] No staged changes to commit.
  goto :done
)

rem ---- Build commit message ----
if defined CUSTOM_MSG (
  set "COMMIT_MSG=!CUSTOM_MSG!"
) else (
  for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"`) do set "STAMP=%%T"
  set "COMMIT_MSG=Update Watch Point site (!STAMP!)"
)

echo [2/3] Committing !FILE_COUNT! updated file^(s^): "!COMMIT_MSG!"
git commit -m "!COMMIT_MSG!"
if errorlevel 1 (
  echo [ERROR] git commit failed.
  goto :fail
)

echo [3/3] Pushing to GitHub (origin/main)...
git push origin main
if errorlevel 1 (
  echo.
  echo [ERROR] git push failed.
  echo         Your changes are safely committed locally.
  echo         Check your internet connection and run publish-online.bat again.
  goto :fail
)

:success
echo.
echo ============================================================
echo   SUCCESS: Updates pushed to GitHub.
echo   Cloudflare Pages will update your live site automatically
echo   within 30 to 60 seconds.
echo ============================================================
echo.

:done
if "!NO_PAUSE!"=="0" pause
exit /b 0

:fail
echo.
if "!NO_PAUSE!"=="0" pause
exit /b 1
