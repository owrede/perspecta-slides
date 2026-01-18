@echo off
REM Copy perspecta-slides plugin to Perspecta-Dev vault

cd /d "%~dp0"
set SOURCE_DIR=%CD%
set DEST_DIR=C:\Users\owred\Documents\Perspecta-Dev\.obsidian\plugins\perspecta-slides

REM Create destination folder if it doesn't exist
if not exist "%DEST_DIR%" (
    mkdir "%DEST_DIR%"
    echo Created directory: %DEST_DIR%
)

REM Copy plugin files
echo Copying plugin files...
copy /Y "main.js" "%DEST_DIR%\" >nul 2>&1
if %errorlevel% neq 0 echo Error copying main.js
copy /Y "preload.js" "%DEST_DIR%\" >nul 2>&1
if %errorlevel% neq 0 echo Error copying preload.js
copy /Y "manifest.json" "%DEST_DIR%\" >nul 2>&1
if %errorlevel% neq 0 echo Error copying manifest.json
copy /Y "styles.css" "%DEST_DIR%\" >nul 2>&1
if %errorlevel% neq 0 echo Error copying styles.css

echo.
echo ✓ Plugin copied to Perspecta-Dev vault!
echo Destination: %DEST_DIR%
pause
