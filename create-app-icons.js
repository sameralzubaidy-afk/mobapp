#!/usr/bin/env node

/**
 * Icon Generator for Kids P2P Marketplace
 * Creates meaningful app icons that represent the app's purpose:
 * - Kids/Youth connection (colorful, friendly design)
 * - P2P Marketplace (handshake/exchange concept)
 * - Community (interconnected elements)
 */

const fs = require('fs');
const path = require('path');

// Create SVG icon designs
const icons = {
  // Main app icon: Colorful marketplace with kids concept
  'icon.svg': `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <!-- Background circle -->
    <defs>
      <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#4CAF50;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#45a049;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#2196F3;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#FF9800;stop-opacity:1" />
      </linearGradient>
    </defs>
    
    <!-- Main background -->
    <circle cx="512" cy="512" r="512" fill="url(#bgGradient)"/>
    
    <!-- Decorative circles for kids vibe -->
    <circle cx="250" cy="300" r="80" fill="#FF6B9D" opacity="0.3"/>
    <circle cx="750" cy="250" r="100" fill="#FFD93D" opacity="0.3"/>
    <circle cx="800" cy="700" r="70" fill="#6BCB77" opacity="0.3"/>
    <circle cx="200" cy="700" r="90" fill="#4D96FF" opacity="0.3"/>
    
    <!-- Central shopping bag with heart -->
    <g transform="translate(512, 512)">
      <!-- Shopping bag outline -->
      <path d="M -80 -100 L -80 -40 Q -80 -20 -60 -20 L 60 -20 Q 80 -20 80 -40 L 80 -100" 
            fill="none" stroke="white" stroke-width="20" stroke-linecap="round"/>
      
      <!-- Bag body -->
      <rect x="-100" y="-20" width="200" height="160" rx="20" fill="white" opacity="0.95"/>
      
      <!-- Heart in center -->
      <path d="M 0,-50 C -25,-75 -60,-75 -60,-45 C -60,-10 0,40 0,40 C 0,40 60,-10 60,-45 C 60,-75 25,-75 0,-50 Z" 
            fill="url(#accentGradient)" stroke="white" stroke-width="3"/>
      
      <!-- Decorative stars for kids feel -->
      <text x="-50" y="80" font-size="40" fill="#FFD93D">⭐</text>
      <text x="30" y="80" font-size="40" fill="#FF6B9D">⭐</text>
      
      <!-- Handshake handles on sides (P2P concept) -->
      <circle cx="-110" cy="-60" r="25" fill="#4D96FF" opacity="0.8"/>
      <circle cx="110" cy="-60" r="25" fill="#FF6B9D" opacity="0.8"/>
    </g>
    
    <!-- Bottom text indicator (optional) -->
    <text x="512" y="950" text-anchor="middle" font-family="Arial, sans-serif" 
          font-size="80" font-weight="bold" fill="white" opacity="0.1">KidsMart</text>
  </svg>`,

  // Adaptive icon foreground (Android)
  'adaptive-icon-foreground.svg': `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#2196F3;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#FF9800;stop-opacity:1" />
      </linearGradient>
    </defs>
    
    <!-- Central shopping bag with heart (takes up safe zone) -->
    <g transform="translate(512, 512)">
      <!-- Shopping bag outline -->
      <path d="M -60 -80 L -60 -30 Q -60 -15 -45 -15 L 45 -15 Q 60 -15 60 -30 L 60 -80" 
            fill="none" stroke="#2196F3" stroke-width="18" stroke-linecap="round"/>
      
      <!-- Bag body -->
      <rect x="-80" y="-15" width="160" height="120" rx="15" fill="white"/>
      
      <!-- Heart in center -->
      <path d="M 0,-35 C -18,-55 -45,-55 -45,-32 C -45,-8 0,25 0,25 C 0,25 45,-8 45,-32 C 45,-55 18,-55 0,-35 Z" 
            fill="url(#accentGrad)"/>
      
      <!-- Decorative elements -->
      <circle cx="-35" cy="50" r="18" fill="#4CAF50"/>
      <circle cx="35" cy="50" r="18" fill="#FF6B9D"/>
      <circle cx="0" cy="75" r="15" fill="#FFD93D"/>
    </g>
  </svg>`,

  // Splash screen icon
  'splash-icon.svg': `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="splashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#4CAF50;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#45a049;stop-opacity:1" />
      </linearGradient>
    </defs>
    
    <rect width="1024" height="1024" fill="url(#splashGrad)"/>
    
    <!-- Decorative background elements -->
    <circle cx="100" cy="100" r="150" fill="#FF6B9D" opacity="0.2"/>
    <circle cx="900" cy="150" r="180" fill="#4D96FF" opacity="0.2"/>
    <circle cx="850" cy="850" r="200" fill="#6BCB77" opacity="0.2"/>
    <circle cx="150" cy="800" r="170" fill="#FFD93D" opacity="0.15"/>
    
    <!-- Central marketplace icon -->
    <g transform="translate(512, 450)">
      <!-- Shopping bags in circle (representing community) -->
      <g transform="rotate(0)">
        <g transform="translate(0, -150)">
          <rect x="-40" y="-60" width="80" height="80" rx="10" fill="#2196F3" opacity="0.9"/>
          <path d="M -40 -60 L -40 -35 Q -40 -20 -25 -20 L 25 -20 Q 40 -20 40 -35 L 40 -60" fill="#1976D2"/>
        </g>
      </g>
      
      <g transform="rotate(120)">
        <g transform="translate(0, -150)">
          <rect x="-40" y="-60" width="80" height="80" rx="10" fill="#FF9800" opacity="0.9"/>
          <path d="M -40 -60 L -40 -35 Q -40 -20 -25 -20 L 25 -20 Q 40 -20 40 -35 L 40 -60" fill="#F57C00"/>
        </g>
      </g>
      
      <g transform="rotate(240)">
        <g transform="translate(0, -150)">
          <rect x="-40" y="-60" width="80" height="80" rx="10" fill="#FF6B9D" opacity="0.9"/>
          <path d="M -40 -60 L -40 -35 Q -40 -20 -25 -20 L 25 -20 Q 40 -20 40 -35 L 40 -60" fill="#E91E63"/>
        </g>
      </g>
      
      <!-- Central heart -->
      <path d="M 0,-50 C -30,-80 -70,-80 -70,-45 C -70,0 0,60 0,60 C 0,60 70,0 70,-45 C 70,-80 30,-80 0,-50 Z" 
            fill="#FF1744" opacity="0.95"/>
      
      <!-- Sparkles around -->
      <text x="-100" y="0" font-size="50" opacity="0.8">✨</text>
      <text x="100" y="0" font-size="50" opacity="0.8">✨</text>
      <text x="0" y="130" font-size="45" opacity="0.8">⭐</text>
    </g>
    
    <!-- App name at bottom -->
    <text x="512" y="800" text-anchor="middle" font-family="Arial, sans-serif" 
          font-size="100" font-weight="bold" fill="white">Kids P2P</text>
    <text x="512" y="900" text-anchor="middle" font-family="Arial, sans-serif" 
          font-size="70" fill="white" opacity="0.9">Marketplace</text>
  </svg>`,

  // Favicon for web
  'favicon.svg': `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="faviconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#4CAF50;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#FF9800;stop-opacity:1" />
      </linearGradient>
    </defs>
    
    <rect width="256" height="256" rx="60" fill="url(#faviconGrad)"/>
    
    <!-- Shopping bag inside -->
    <g transform="translate(128, 128)">
      <rect x="-35" y="-45" width="70" height="75" rx="8" fill="white" opacity="0.95"/>
      <path d="M -35 -45 L -35 -28 Q -35 -20 -27 -20 L 27 -20 Q 35 -20 35 -28 L 35 -45" 
            fill="none" stroke="white" stroke-width="8" stroke-linecap="round"/>
      
      <!-- Heart -->
      <path d="M 0,-20 C -12,-32 -28,-32 -28,-18 C -28,-5 0,15 0,15 C 0,15 28,-5 28,-18 C 28,-32 12,-32 0,-20 Z" 
            fill="#FF1744"/>
    </g>
  </svg>`,
};

// Helper function to convert SVG to PNG using a simple approach
// For now, we'll save SVG files and provide instructions
const assetsDir = path.join(__dirname, 'assets');

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Save SVG files
console.log('📦 Creating app icon designs...\n');

Object.entries(icons).forEach(([filename, content]) => {
  const filepath = path.join(assetsDir, filename);
  fs.writeFileSync(filepath, content);
  console.log(`✅ Created: assets/${filename}`);
});

// Create conversion instructions
const instructions = `# App Icon Generation Guide

## What was created:
- **icon.svg** - Main app icon (cute marketplace with heart, kids-friendly colors)
- **adaptive-icon-foreground.svg** - Android adaptive icon foreground
- **splash-icon.svg** - Splash screen with full marketplace theme
- **favicon.svg** - Web favicon

## How to convert SVG to PNG:

### Option 1: Using ImageMagick (if installed)
\`\`\`bash
# Install (macOS)
brew install imagemagick

# Convert with high quality
convert -density 300 assets/icon.svg -background none assets/icon.png
convert -density 300 assets/adaptive-icon-foreground.svg -background none assets/adaptive-icon.png
convert -density 300 assets/splash-icon.svg -background white assets/splash-icon.png
convert -density 300 assets/favicon.svg -background none assets/favicon.png
\`\`\`

### Option 2: Using Node.js (Recommended)
Install required packages:
\`\`\`bash
npm install --save-dev sharp
\`\`\`

Run the PNG conversion script:
\`\`\`bash
node convert-icons.js
\`\`\`

### Option 3: Using Online Tools
1. Go to https://cloudconvert.com/ or https://convertio.co/
2. Upload each SVG file
3. Convert to PNG
4. Download and replace the PNG files in assets/

### Option 4: Sketch, Figma, or Illustrator
Export SVGs as PNG with settings:
- Resolution: 300 DPI
- Size: 1024x1024 pixels
- Background: Transparent (for icon.png, adaptive-icon.png, favicon.png) or White (splash-icon.png)

## After conversion:
1. Replace the PNG files in the \`assets/\` directory
2. Run: \`npm start\` to preview changes
3. Test on both iOS and Android devices

## Color Scheme:
- Primary Green: #4CAF50 (marketplace trust, growth)
- Accent Blue: #2196F3 (friendly, tech)
- Orange: #FF9800 (energy, youth)
- Pink: #FF6B9D (playful, kids-friendly)
- Yellow: #FFD93D (happiness, spotlight)

## Icon Concept:
✨ A colorful shopping bag with a heart inside, surrounded by decorative stars and circles
- **Shopping bag**: Represents the marketplace
- **Heart**: Represents community and trust between kids
- **Colorful elements**: Appeal to kids while maintaining professionalism
- **Clean design**: Works well at any size on mobile screens
`;

fs.writeFileSync(
  path.join(__dirname, 'ICON-CONVERSION-GUIDE.md'),
  instructions
);
console.log(`\n✅ Created: ICON-CONVERSION-GUIDE.md`);

console.log(`
╔════════════════════════════════════════════════════════════════╗
║                   ICON GENERATION COMPLETE!                    ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  📱 SVG icon files have been created in assets/               ║
║                                                                ║
║  Next steps:                                                   ║
║  1. Convert SVGs to PNG (choose an option above)              ║
║  2. Replace existing PNG files in assets/                     ║
║  3. Run: npm start                                            ║
║  4. Build and test on mobile                                  ║
║                                                                ║
║  See ICON-CONVERSION-GUIDE.md for detailed instructions       ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`);
