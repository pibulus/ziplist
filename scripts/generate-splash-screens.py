#!/usr/bin/env python3

"""
Generate iOS Splash Screens for ZipList PWA

This script creates splash screens with the app icon centered on a
background matching the app's theme color.
"""

import os
from pathlib import Path
from PIL import Image, ImageDraw

# Configuration
BACKGROUND_COLOR = '#FFF6E6'  # Peach theme color
SCRIPT_DIR = Path(__file__).parent
ICON_PATH = SCRIPT_DIR / '../static/icons/icon-512x512.png'
OUTPUT_DIR = SCRIPT_DIR / '../static/splash'

# iOS device splash screen sizes (width x height, portrait)
SPLASH_SIZES = [
    {'width': 2048, 'height': 2732, 'name': 'apple-splash-2048-2732.png', 'device': '12.9" iPad Pro'},
    {'width': 1668, 'height': 2388, 'name': 'apple-splash-1668-2388.png', 'device': '11" iPad Pro'},
    {'width': 1536, 'height': 2048, 'name': 'apple-splash-1536-2048.png', 'device': '9.7" iPad'},
    {'width': 1290, 'height': 2796, 'name': 'apple-splash-1290-2796.png', 'device': 'iPhone 14 Pro Max'},
    {'width': 1179, 'height': 2556, 'name': 'apple-splash-1179-2556.png', 'device': 'iPhone 14 Pro'},
    {'width': 1170, 'height': 2532, 'name': 'apple-splash-1170-2532.png', 'device': 'iPhone 13/14'},
    {'width': 1125, 'height': 2436, 'name': 'apple-splash-1125-2436.png', 'device': 'iPhone X/XS/11 Pro'},
    {'width': 1284, 'height': 2778, 'name': 'apple-splash-1284-2778.png', 'device': 'iPhone 12/13 Pro Max'},
    {'width': 750, 'height': 1334, 'name': 'apple-splash-750-1334.png', 'device': 'iPhone 8/SE'},
]


def generate_splash_screen(size_info):
    """Generate a single splash screen."""
    width = size_info['width']
    height = size_info['height']
    name = size_info['name']
    device = size_info['device']
    output_path = OUTPUT_DIR / name

    # Calculate icon size (30% of the smaller dimension)
    icon_size = int(min(width, height) * 0.30)

    try:
        # Create background with theme color
        background = Image.new('RGB', (width, height), BACKGROUND_COLOR)

        # Load and resize icon
        icon = Image.open(ICON_PATH)
        icon = icon.convert('RGBA')
        icon.thumbnail((icon_size, icon_size), Image.Resampling.LANCZOS)

        # Calculate position to center the icon
        icon_x = (width - icon.width) // 2
        icon_y = (height - icon.height) // 2

        # Paste icon onto background (with alpha channel for transparency)
        background.paste(icon, (icon_x, icon_y), icon)

        # Save the splash screen
        background.save(output_path, 'PNG', optimize=True)

        print(f'✅ Generated: {name} ({width}x{height}) - {device}')

    except Exception as error:
        print(f'❌ Failed to generate {name}: {error}')


def main():
    print('🎨 Generating iOS splash screens for ZipList PWA...\n')
    print(f'Background color: {BACKGROUND_COLOR}')
    print(f'Icon source: {ICON_PATH}')
    print(f'Output directory: {OUTPUT_DIR}\n')

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Generate all splash screens
    for size in SPLASH_SIZES:
        generate_splash_screen(size)

    print('\n✨ All splash screens generated successfully!')
    print('\n📱 Splash screens are now ready for iOS PWA installation.')


if __name__ == '__main__':
    main()
