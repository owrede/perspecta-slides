$src = "C:\Users\owred\GitHub\perspecta-slides"
$dest = "C:\Users\owred\Documents\Perspecta-Dev\.obsidian\plugins\perspecta-slides"

Write-Host "Source: $src"
Write-Host "Dest: $dest"
Write-Host ""

# Verify files exist
@("main.js", "preload.js", "manifest.json", "styles.css") | ForEach-Object {
    $path = Join-Path $src $_
    if (Test-Path $path) {
        Write-Host "✓ Found: $_"
    } else {
        Write-Host "✗ Missing: $_"
    }
}

Write-Host ""
Write-Host "Creating directory..."
if (Test-Path $dest) {
    Write-Host "Directory already exists"
} else {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Write-Host "Created: $dest"
}

Write-Host "Copying files..."
Copy-Item -Path "$src\main.js" -Destination "$dest\" -Force
Copy-Item -Path "$src\preload.js" -Destination "$dest\" -Force
Copy-Item -Path "$src\manifest.json" -Destination "$dest\" -Force
Copy-Item -Path "$src\styles.css" -Destination "$dest\" -Force

Write-Host "✓ Done!"
Get-ChildItem $dest
