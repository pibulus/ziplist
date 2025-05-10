# Ghost Asset Generator for Ziplist

This system provides a unified approach to managing ghost graphics across both component-based SVGs and static assets, solving issues like ID collisions, CSS leakage, and theme inconsistencies.

## Overview

The Ghost Asset Generator is a Vite plugin that automatically generates all static ghost SVG and PNG assets during the build process. It ensures that all static assets are derived from the same source as the component-based ghost SVG, maintaining visual consistency throughout the application.

## Key Features

- **Single Source of Truth**: All ghost graphics derive from shared path definitions in `src/lib/components/ghost/exportable/paths.js`
- **Theme Consistency**: Ensures all themes (peach, mint, bubblegum, rainbow) are consistent across components and static assets
- **PWA Asset Generation**: Automatically creates all required PWA icon sizes (72×72 to 512×512)
- **Build Integration**: Runs automatically during build process via Vite plugin
- **SVGO Optimization**: Optimizes all SVG output for production

## Installation

The necessary dependencies are already installed:

```
svgo - SVG optimization
sharp - Image processing for PNG generation
@svgr/core - SVG manipulation utilities
```

## Usage

### Automatic Build Integration

The ghost assets are automatically generated during the build process. When you run:

```bash
npm run build
```

The Vite plugin will generate all ghost assets before the build completes.

### Manual Asset Generation

If you need to manually generate the assets (e.g., during development), use:

```bash
npm run generate-ghost-assets
```

This will run the asset generation script without running a full build.

## Architecture

### 1. Exportable Paths Module

The `src/lib/components/ghost/exportable/paths.js` file contains the definitive path data for:
- Ghost body outline
- Left eye
- Right eye
- Theme color definitions

### 2. SVG Generation Utilities

The `src/lib/components/ghost/exportable/index.js` file provides utility functions for generating SVGs:
- `generateGhostSvg()` - Create complete ghost SVG with options
- `generateStaticGhostSvg()` - Generate SVG optimized for static use
- `generateIconGhostSvg()` - Generate simplified SVG for icons
- `generateGhostBackgroundSvg()` - Generate background-only SVG

### 3. Vite Plugin

The `vite-plugins/ghost-asset-generator.js` plugin:
- Hooks into the Vite build process
- Generates all static SVGs and PNGs
- Optimizes assets with SVGO
- Creates PWA icons in all required sizes

## Generated Assets

The plugin generates:

1. **Theme-specific SVG files**:
   - `/static/assets/talktype-icon-bg-gradient.svg`
   - `/static/assets/talktype-icon-bg-gradient-mint.svg`
   - `/static/assets/talktype-icon-bg-gradient-bubblegum.svg`
   - `/static/assets/talktype-icon-bg-gradient-rainbow.svg`

2. **Component SVG files**:
   - `/static/assets/talktype-icon-base.svg`
   - `/static/assets/talktype-icon-eyes.svg`
   - `/static/assets/talktype-icon-outline.svg`
   - `/static/ghost-template.svg`
   - `/static/combined-icon.svg`

3. **Browser icons**:
   - `/static/favicon.png`
   - `/static/favicon-light.png`
   - `/static/favicon-dark.png`
   - `/static/apple-touch-icon.png`
   - `/static/og-image.png`

4. **PWA icons**:
   - `/static/icons/icon-72x72.png`
   - `/static/icons/icon-96x96.png`
   - `/static/icons/icon-128x128.png`
   - `/static/icons/icon-144x144.png`
   - `/static/icons/icon-152x152.png`
   - `/static/icons/icon-192x192.png`
   - `/static/icons/icon-384x384.png`
   - `/static/icons/icon-512x512.png`
   - `/static/icons/icon-maskable-512x512.png`
   - `/static/icons/icon-maskable-light-512x512.png`
   - `/static/icons/icon-maskable-dark-512x512.png`

## Benefits

This approach resolves several issues:

1. **ID Collisions**: Eliminated through careful ID management
2. **CSS Styling Leakage**: Static and component SVGs maintain separation
3. **JavaScript Animation Conflicts**: No risk of accidentally targeting static SVGs
4. **Theme Consistency**: All theme variants use the same color definitions
5. **Maintenance**: Update path definitions once to update everywhere

## Extending

To add a new theme:

1. Add color definitions to `THEME_COLORS` in `paths.js`
2. The build system will automatically generate all required assets

To modify the ghost shape:

1. Update path definitions in `paths.js`
2. Run `npm run generate-ghost-assets` to regenerate all assets

## Troubleshooting

If you encounter issues:

1. **SVG Optimization Errors**: Check SVGO configuration in the plugin
2. **PNG Generation Errors**: Ensure Sharp is correctly installed
3. **Missing Assets**: Check console output for specific error messages

## Integration with Ghost Component

The component-based ghost in `src/lib/components/ghost/Ghost.svelte` should reference paths from the exportable module to maintain consistency with static assets.