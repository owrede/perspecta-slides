$src = "C:\Users\owred\GitHub\perspecta-slides"
$parent = "C:\Users\owred\Documents\Perspecta-Dev\.obsidian\plugins"
$pluginName = "perspecta-slides"
$dest = Join-Path $parent $pluginName

# Try creating parent first
if (-not (Test-Path $parent)) {
    Write-Host "Parent doesn't exist!"
    exit 1
}

Write-Host "Parent exists: $parent"

# Create destination folder
try {
    $null = [System.IO.Directory]::CreateDirectory($dest)
    Write-Host "Created: $dest"
} catch {
    Write-Host "Error creating directory: $_"
    exit 1
}

# Copy files
@("main.js", "preload.js", "manifest.json", "styles.css") | ForEach-Object {
    $src_file = Join-Path $src $_
    $dst_file = Join-Path $dest $_
    Copy-Item $src_file $dst_file -Force
    Write-Host "Copied: $_"
}

Write-Host "Done!"
Get-ChildItem $dest
