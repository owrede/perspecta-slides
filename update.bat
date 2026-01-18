@echo off
echo.
echo WARNING: Close Obsidian completely before updating!
echo.
pause

cd /d "%~dp0"

set SRC=%CD%
set DEST=C:\Vaults\Perspecta-Dev\.obsidian\plugins\perspecta-slides

echo Updating plugin files in %DEST%...
echo.

copy "main.js" "%DEST%" /Y && echo [OK] main.js || echo [FAIL] main.js
copy "preload.js" "%DEST%" /Y && echo [OK] preload.js || echo [FAIL] preload.js
copy "manifest.json" "%DEST%" /Y && echo [OK] manifest.json || echo [FAIL] manifest.json
copy "styles.css" "%DEST%" /Y && echo [OK] styles.css || echo [FAIL] styles.css

echo.
echo Done! You can now reopen Obsidian.
