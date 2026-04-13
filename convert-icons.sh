#!/bin/bash

# 🎨 Kids P2P Marketplace Icon Converter
# Converts SVG icon assets to PNG for iOS, Android, and Web

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
ASSETS_DIR="${PROJECT_ROOT}/p2p-kids-marketplace/assets"

echo "🎨 App Icon Conversion Tool"
echo "=============================="
echo ""

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ Error: ImageMagick is not installed"
    echo ""
    echo "Install it with:"
    echo "  brew install imagemagick"
    echo ""
    exit 1
fi

echo "✅ ImageMagick is installed"
echo ""

# Check if SVG files exist
if [ ! -f "${ASSETS_DIR}/icon.svg" ]; then
    echo "❌ Error: SVG files not found in ${ASSETS_DIR}"
    echo ""
    echo "Please make sure you have the SVG files created first"
    exit 1
fi

echo "📁 Assets directory: ${ASSETS_DIR}"
echo ""
echo "🔄 Converting SVG files to PNG..."
echo ""

# Convert main app icon (transparent background)
echo "Converting: icon.svg → icon.png"
convert -density 300 "${ASSETS_DIR}/icon.svg" \
    -background none \
    -alpha remove \
    -alpha off \
    "${ASSETS_DIR}/icon.png"
echo "   ✅ icon.png (1024×1024)"

# Convert adaptive icon foreground (transparent background)
if [ -f "${ASSETS_DIR}/adaptive-icon.svg" ]; then
    echo "Converting: adaptive-icon.svg → adaptive-icon.png"
    convert -density 300 "${ASSETS_DIR}/adaptive-icon.svg" \
        -background none \
        -alpha remove \
        -alpha off \
        "${ASSETS_DIR}/adaptive-icon.png"
    echo "   ✅ adaptive-icon.png (1024×1024)"
fi

# Convert splash screen icon (white background)
if [ -f "${ASSETS_DIR}/splash-icon.svg" ]; then
    echo "Converting: splash-icon.svg → splash-icon.png"
    convert -density 300 "${ASSETS_DIR}/splash-icon.svg" \
        -background white \
        -flatten \
        "${ASSETS_DIR}/splash-icon.png"
    echo "   ✅ splash-icon.png (1024×1024)"
fi

# Convert favicon (smaller size, transparent background)
if [ -f "${ASSETS_DIR}/favicon.svg" ]; then
    echo "Converting: favicon.svg → favicon.png"
    convert -density 300 "${ASSETS_DIR}/favicon.svg" \
        -resize 192x192 \
        -background none \
        -alpha remove \
        -alpha off \
        "${ASSETS_DIR}/favicon.png"
    echo "   ✅ favicon.png (192×192)"
fi

echo ""
echo "════════════════════════════════════════════"
echo "✨ Icon Conversion Complete!"
echo "════════════════════════════════════════════"
echo ""
echo "📁 Generated files:"
ls -lh "${ASSETS_DIR}"/*.png | awk '{print "   " $9 " (" $5 ")"}'
echo ""
echo "📱 Next steps:"
echo "   1. cd p2p-kids-marketplace"
echo "   2. npm start"
echo "   3. Preview on iOS or Android"
echo "   4. Test icon appearance"
echo ""
echo "🚀 To build for stores:"
echo "   eas build --platform all --profile production"
echo ""
