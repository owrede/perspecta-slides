$sourceDir = "C:\Users\owred\GitHub\perspecta-slides"
$destDir = "C:\Users\owred\Documents\Perspecta-Dev\.obsidian\plugins\perspecta-slides"

New-Item -ItemType Directory -Path $destDir -Force -ErrorAction SilentlyContinue | Out-Null

Copy-Item "$sourceDir\main.js" $destDir -Force
Copy-Item "$sourceDir\preload.js" $destDir -Force
Copy-Item "$sourceDir\manifest.json" $destDir -Force
Copy-Item "$sourceDir\styles.css" $destDir -Force

Write-Host "Done! Copied to $destDir"
