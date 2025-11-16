#!/usr/bin/env node

/**
 * Generate iOS Splash Screens for ZipList PWA
 *
 * This script creates splash screens with the app icon centered on a
 * background matching the app's theme color.
 */

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const BACKGROUND_COLOR = '#FFF6E6'; // Peach theme color
const ICON_PATH = join(__dirname, '../static/icons/icon-512x512.png');
const OUTPUT_DIR = join(__dirname, '../static/splash');

// iOS device splash screen sizes (width x height, portrait)
const SPLASH_SIZES = [
  { width: 2048, height: 2732, name: 'apple-splash-2048-2732.png', device: '12.9" iPad Pro' },
  { width: 1668, height: 2388, name: 'apple-splash-1668-2388.png', device: '11" iPad Pro' },
  { width: 1536, height: 2048, name: 'apple-splash-1536-2048.png', device: '9.7" iPad' },
  { width: 1290, height: 2796, name: 'apple-splash-1290-2796.png', device: 'iPhone 14 Pro Max' },
  { width: 1179, height: 2556, name: 'apple-splash-1179-2556.png', device: 'iPhone 14 Pro' },
  { width: 1170, height: 2532, name: 'apple-splash-1170-2532.png', device: 'iPhone 13/14' },
  { width: 1125, height: 2436, name: 'apple-splash-1125-2436.png', device: 'iPhone X/XS/11 Pro' },
  { width: 1284, height: 2778, name: 'apple-splash-1284-2778.png', device: 'iPhone 12/13 Pro Max' },
  { width: 750, height: 1334, name: 'apple-splash-750-1334.png', device: 'iPhone 8/SE' },
];

async function generateSplashScreen(size) {
  const { width, height, name, device } = size;
  const outputPath = join(OUTPUT_DIR, name);

  // Calculate icon size (30% of the smaller dimension)
  const iconSize = Math.floor(Math.min(width, height) * 0.30);

  try {
    // Create background with theme color
    const background = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: BACKGROUND_COLOR
      }
    }).png();

    // Resize icon
    const icon = await sharp(ICON_PATH)
      .resize(iconSize, iconSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    // Composite icon onto background (centered)
    await background
      .composite([{
        input: icon,
        gravity: 'center'
      }])
      .toFile(outputPath);

    console.log(`✅ Generated: ${name} (${width}x${height}) - ${device}`);
  } catch (error) {
    console.error(`❌ Failed to generate ${name}:`, error.message);
  }
}

async function main() {
  console.log('🎨 Generating iOS splash screens for ZipList PWA...\n');
  console.log(`Background color: ${BACKGROUND_COLOR}`);
  console.log(`Icon source: ${ICON_PATH}`);
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  // Ensure output directory exists
  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist, that's okay
  }

  // Generate all splash screens
  for (const size of SPLASH_SIZES) {
    await generateSplashScreen(size);
  }

  console.log('\n✨ All splash screens generated successfully!');
  console.log('\n📱 Splash screens are now ready for iOS PWA installation.');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
