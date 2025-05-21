@echo off

set ICON=roi-icon.png
set MAGICK="C:\Program Files\ImageMagick-7.1.1-Q16-HDRI\magick.exe"

echo Generating icon.ico...
%MAGICK% %ICON% -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico

echo Generating macOS icon.icns...
%MAGICK% %ICON% -define icon:auto-resize=256,128,64,32,16 icon.icns

echo Generating standard PNGs...
%MAGICK% %ICON% -resize 32x32 32x32.png
%MAGICK% %ICON% -resize 128x128 128x128.png
%MAGICK% %ICON% -resize 256x256 128x128@2x.png

echo Generating Windows Store logos...
%MAGICK% %ICON% -resize 30x30 Square30x30Logo.png
%MAGICK% %ICON% -resize 44x44 Square44x44Logo.png
%MAGICK% %ICON% -resize 71x71 Square71x71Logo.png
%MAGICK% %ICON% -resize 89x89 Square89x89Logo.png
%MAGICK% %ICON% -resize 107x107 Square107x107Logo.png
%MAGICK% %ICON% -resize 142x142 Square142x142Logo.png
%MAGICK% %ICON% -resize 150x150 Square150x150Logo.png
%MAGICK% %ICON% -resize 284x284 Square284x284Logo.png
%MAGICK% %ICON% -resize 310x310 Square310x310Logo.png
%MAGICK% %ICON% -resize 50x50 StoreLogo.png

echo Done!
pause
