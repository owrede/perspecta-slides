@echo off
cd /d "%~dp0"

set SRC=%CD%
set DEST=C:\Users\owred\Documents\Perspecta-Dev\.obsidian\plugins\perspecta-slides

echo Creating directory: %DEST%
mkdir "%DEST%" 2>nul

echo Copying files...
copy "main.js" "%DEST%" /Y
copy "preload.js" "%DEST%" /Y
copy "manifest.json" "%DEST%" /Y
copy "styles.css" "%DEST%" /Y

echo.
echo Done!
dir "%DEST%"
