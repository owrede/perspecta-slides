@echo off
setlocal enabledelayedexpansion

set SRC=C:\Users\owred\GitHub\perspecta-slides
set DEST=C:\Users\owred\Documents\Perspecta-Dev\.obsidian\plugins\perspecta-slides

if not exist "!DEST!" (
    mkdir "!DEST!"
)

copy "!SRC!\main.js" "!DEST!\" /Y
copy "!SRC!\preload.js" "!DEST!\" /Y
copy "!SRC!\manifest.json" "!DEST!\" /Y
copy "!SRC!\styles.css" "!DEST!\" /Y

echo Done!
dir "!DEST!"
