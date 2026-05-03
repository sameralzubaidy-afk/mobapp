# Onboarding Illustrations

This directory contains placeholder illustrations for the onboarding carousel.

## Required Images

1. `welcome.png` - Welcome screen illustration
2. `swap-points-intro.png` - Swap Points definition illustration
3. `earning-sp.png` - Earning SP explanation illustration
4. `spending-sp.png` - Spending SP explanation illustration
5. `safety.png` - Safety guidelines illustration

## Specifications

- **Format:** PNG
- **Dimensions:** 600px × 600px (transparent background)
- **Style:** Friendly, kid-appropriate, colorful
- **Content:** Simple icon-based illustrations matching each screen's message

## TODO(DESIGN)

Replace these placeholders with final designed illustrations from the design team.

## Creating Placeholders

For now, you can use simple colored rectangles as placeholders:

```bash
# Install ImageMagick if needed
brew install imagemagick

# Generate placeholder images
convert -size 600x600 xc:#007AFF -pointsize 72 -fill white -gravity center -annotate +0+0 "Welcome" welcome.png
convert -size 600x600 xc:#34C759 -pointsize 72 -fill white -gravity center -annotate +0+0 "SP" swap-points-intro.png
convert -size 600x600 xc:#FF9500 -pointsize 72 -fill white -gravity center -annotate +0+0 "Earn" earning-sp.png
convert -size 600x600 xc:#5856D6 -pointsize 72 -fill white -gravity center -annotate +0+0 "Spend" spending-sp.png
convert -size 600x600 xc:#FF3B30 -pointsize 72 -fill white -gravity center -annotate +0+0 "Safety" safety.png
```
