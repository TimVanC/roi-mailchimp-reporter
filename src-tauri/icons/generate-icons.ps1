# PowerShell script to generate icons
# Requires ImageMagick to be installed

# Source icon
$source = "roi-icon.png"

# Find ImageMagick installation
$imageMagickPath = ""
$possiblePaths = @(
    "C:\Program Files\ImageMagick-7.*\magick.exe",
    "C:\Program Files (x86)\ImageMagick-7.*\magick.exe"
)

foreach ($path in $possiblePaths) {
    $found = Get-Item $path -ErrorAction SilentlyContinue
    if ($found) {
        $imageMagickPath = $found.FullName
        break
    }
}

if (-not $imageMagickPath) {
    Write-Error "ImageMagick not found. Please ensure it is installed in Program Files."
    exit 1
}

# Windows ICO
& $imageMagickPath $source -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico

# PNG sizes for different platforms
$sizes = @(
    @{ name = "32x32"; size = "32x32" },
    @{ name = "128x128"; size = "128x128" },
    @{ name = "128x128@2x"; size = "256x256" },
    @{ name = "Square30x30Logo"; size = "30x30" },
    @{ name = "Square44x44Logo"; size = "44x44" },
    @{ name = "Square71x71Logo"; size = "71x71" },
    @{ name = "Square89x89Logo"; size = "89x89" },
    @{ name = "Square107x107Logo"; size = "107x107" },
    @{ name = "Square142x142Logo"; size = "142x142" },
    @{ name = "Square150x150Logo"; size = "150x150" },
    @{ name = "Square284x284Logo"; size = "284x284" },
    @{ name = "Square310x310Logo"; size = "310x310" },
    @{ name = "StoreLogo"; size = "50x50" }
)

foreach ($size in $sizes) {
    & $imageMagickPath $source -resize $size.size "$($size.name).png"
}

# macOS ICNS
& $imageMagickPath $source -define icon:auto-resize=256,128,64,32,16 icon.icns 