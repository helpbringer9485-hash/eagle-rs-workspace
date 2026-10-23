@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title EAGLE RS Workspace - Screenshot Chat and Translation Setup

echo.
echo ==============================================
echo EAGLE RS v3.24 - Windows Build and Installer
 echo Screenshot chat replies and translation
 echo ==============================================
echo.
where node >nul 2>nul || (echo Node.js is missing. Install Node.js LTS first.& pause & exit /b 1)
where npm.cmd >nul 2>nul || (echo npm is missing. Repair your Node.js installation.& pause & exit /b 1)

set "BACKUP_BASE=%USERPROFILE%\Documents\EAGLE-RS-Backup-before-v3.24"
for /f "delims=" %%A in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "BACKUP_STAMP=%%A"
if not defined BACKUP_STAMP set "BACKUP_STAMP=%RANDOM%"
if exist "%APPDATA%\eagle-rs-workspace" (
 echo Backing up old app data. This may take time if WhatsApp profiles are large...
 robocopy "%APPDATA%\eagle-rs-workspace" "%BACKUP_BASE%-%BACKUP_STAMP%\eagle-rs-workspace" /E /XJ /R:1 /W:1 >nul
 if errorlevel 8 (echo Backup failed. Installation cancelled.& pause & exit /b 1)
)
if exist "%APPDATA%\EAGLE RS Workspace" (
 echo Backing up EAGLE RS Workspace profile...
 robocopy "%APPDATA%\EAGLE RS Workspace" "%BACKUP_BASE%-%BACKUP_STAMP%\EAGLE RS Workspace" /E /XJ /R:1 /W:1 >nul
 if errorlevel 8 (echo Backup failed. Installation cancelled.& pause & exit /b 1)
)

echo Installing build dependencies...
call npm.cmd install || (echo Dependency installation failed.& pause & exit /b 1)
echo Verifying source and recovery security checks...
call npm.cmd run check || (echo Checks failed. Nothing was installed.& pause & exit /b 1)
echo Building Windows setup file...
call npm.cmd run dist || (echo Build failed. No installer created.& pause & exit /b 1)
echo.
echo Build complete. Opening installer...
for %%F in ("%~dp0dist\*Setup*.exe") do (
 if exist "%%~fF" (
  start "" "%%~fF"
  exit /b 0
 )
)
echo No Setup.exe found. Opening dist folder to inspect the build.
explorer "%~dp0dist"
pause
exit /b 0
