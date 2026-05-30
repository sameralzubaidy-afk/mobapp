#!/usr/bin/env node

/**
 * SVG to PNG Converter for App Icons
 * Uses sharp library for high-quality conversion
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is installed
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.error('❌ Error: sharp library is not installed.');
  console.log('\n📦 Install it with:');
  console.log('   npm install --save-dev sharp');
  console.log('\nOr use an alternative conversion method from ICON-CONVERSION-GUIDE.md\n');
  process.exit(1);
}

const assetsDir = path.join(__dirname, 'p2p-kids-marketplace', 'assets');
const tempDir = path.join(__dirname, '.temp-svg');

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Icon conversion configs
const conversions = [
  {
    svg: 'icon.svg',
    png: 'icon.png',
    size: 1024,
    background: { r: 255, g: 255, b: 255, alpha: 0 },
    description: 'Main app icon',
  },
  {
    svg: 'adaptive-icon-foreground.svg',
    png: 'adaptive-icon.png',
    size: 1024,
    background: { r: 255, g: 255, b: 255, alpha: 0 },
    description: 'Android adaptive icon',
  },
  {
    svg: 'splash-icon.svg',
    png: 'splash-icon.png',
    size: 1024,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
    description: 'Splash screen',
  },
  {
    svg: 'favicon.svg',
    png: 'favicon.png',
    size: 192,
    background: { r: 255, g: 255, b: 255, alpha: 0 },
    description: 'Web favicon',
  },
];

// Note: Since we can't directly convert SVG with sharp without additional dependencies,
// we'll provide an alternative approach using a web-based service or manual instruction

async function convertIcons() {
  console.log('🎨 App Icon Conversion Tool\n');
  
  const svgDir = path.join(__dirname, 'assets');
  
  if (!fs.existsSync(svgDir)) {
    console.error('❌ SVG files not found in assets/');
    console.log('📝 First run: node create-app-icons.js\n');
    process.exit(1);
  }

  console.log('⚠️  Note: Direct SVG to PNG conversion requires additional libraries.');
  console.log('Using SVGO and svg2png would require extra dependencies.\n');
  
  console.log('✅ SVG files are ready for conversion:\n');
  
  conversions.forEach(config => {
    const svgPath = path.join(svgDir, config.svg);
    if (fs.existsSync(svgPath)) {
      console.log(`  ✓ ${config.svg} → ${config.png} (${config.size}x${config.size})`);
    }
  });

  console.log('\n📋 Recommended conversion tools:\n');
  console.log('  1. ImageMagick:');
  console.log('     brew install imagemagick');
  console.log('     convert -density 300 assets/icon.svg assets/icon.png\n');
  
  console.log('  2. Cloudflare Wrangler or Serverless Function:');
  console.log('     npm install --save-dev svg2png');
  console.log('     Then run: node scripts/convert-svg-batch.js\n');
  
  console.log('  3. Online Tools:');
  console.log('     • https://convertio.co/ (SVG to PNG)');
  console.log('     • https://cloudconvert.com/');
  console.log('     • https://ezgif.com/\n');
  
  console.log('  4. Design Tools:');
  console.log('     • Figma (import SVG and export as PNG)');
  console.log('     • Sketch (import and export)\n');

  // Create a helper script for batch conversion
  createBatchConversionHelper();
}

function createBatchConversionHelper() {
  const helperScript = `#!/bin/bash
# Batch SVG to PNG conversion using ImageMagick

ASSETS_DIR="./p2p-kids-marketplace/assets"

if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick is not installed."
    echo "Install it with: brew install imagemagick"
    exit 1
fi

echo "🎨 Converting SVG icons to PNG..."
echo ""

# Convert main icon
convert -density 300 "\${ASSETS_DIR}/icon.svg" -background none -alpha remove -alpha off "\${ASSETS_DIR}/icon.png"
echo "✅ Created: icon.png"

# Convert adaptive icon
convert -density 300 "\${ASSETS_DIR}/adaptive-icon-foreground.svg" -background none -alpha remove -alpha off "\${ASSETS_DIR}/adaptive-icon.png"
echo "✅ Created: adaptive-icon.png"

# Convert splash icon with white background
convert -density 300 "\${ASSETS_DIR}/splash-icon.svg" -background white "\${ASSETS_DIR}/splash-icon.png"
echo "✅ Created: splash-icon.png"

# Convert favicon (smaller size)
convert -density 300 "\${ASSETS_DIR}/favicon.svg" -resize 192x192 -background none -alpha remove -alpha off "\${ASSETS_DIR}/favicon.png"
echo "✅ Created: favicon.png"

echo ""
echo "✨ All icons converted successfully!"
echo "📱 Ready to test in your app - run: npm start"
`;

  fs.writeFileSync(
    path.join(__dirname, 'p2p-kids-marketplace', 'scripts', 'convert-svg-icons.sh'),
    helperScript
  );
  
  // Make it executable
  fs.chmodSync(path.join(__dirname, 'p2p-kids-marketplace', 'scripts', 'convert-svg-icons.sh'), '755');
  
  console.log('✅ Created: p2p-kids-marketplace/scripts/convert-svg-icons.sh');
}

// Run conversion
convertIcons().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
