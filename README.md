# ZipList 👻

A voice-to-list web application that lets you create and manage lists by speaking to your device.

## Overview

ZipList transforms voice input into organized lists through an intuitive and visually appealing interface. The centerpiece of the application is an animated Ghost mascot that guides users through the voice recording process and provides visual feedback for application states.

## Key Features

- **Voice-to-List Conversion**: Speak naturally to create and modify lists
- **Interactive Ghost Mascot**: Provides visual feedback and animation during recording
- **Animated List Interface**: Card-based list visualization with sorting and filtering
- **Theme System**: Multiple visual themes with gradient animations
- **Offline Capability**: Works without an internet connection (PWA support)

## Tech Stack

- **Framework**: SvelteKit
- **Styling**: Tailwind CSS with DaisyUI components
- **Animation**: Custom SVG and CSS animations
- **Voice Processing**: Web Speech API with AI-powered transcription
- **Storage**: Browser localStorage for data persistence

## Core Components

### Ghost Component

The Ghost is a central UI element with:

- SVG-based animated mascot
- Interactive eye tracking that follows cursor movement
- Multiple animation states (idle, recording, processing)
- Themed gradient backgrounds
- Visual feedback for application state

### List Components

Lists are presented as interactive cards with:

- Display of list items with completion status
- Drag-and-drop reordering
- Show/hide completed items
- Item filtering and management
- 3D carousel for navigating multiple lists

### Voice Transcription

The voice recording system features:

- Audio recording with visual feedback
- Text transcription of spoken content
- Command recognition for list manipulation
- List-specific parsing logic

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ziplist.git
cd ziplist

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Commands

- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm run preview` - Preview production build
- `npm run format` - Run Prettier formatter
- `npm run lint` - Check code formatting and run ESLint

## Project Structure

```
/src
├── app.css            # Global CSS
├── app.html           # HTML template
├── docs/              # Project documentation
├── lib/               # Application library
│   ├── components/    # UI components
│   │   ├── ghost/     # Ghost component system
│   │   ├── list/      # List components
│   │   └── mainPage/  # Main page components
│   ├── services/      # Business logic
│   │   ├── lists/     # List management
│   │   ├── transcription/ # Voice transcription
│   │   └── theme/     # Theme management
│   └── styles/        # CSS utilities
└── routes/            # SvelteKit routes
```

## Ghost Component

The Ghost component is the central UI element and mascot for the application. It features:

- SVG-based animation system
- Eye tracking that follows cursor movement
- Multiple animation states (idle, recording, processing)
- Theme support with gradient backgrounds
- Reactive animation system for application feedback

For detailed documentation, see [Ghost Component README](/src/lib/components/ghost/README.md).

## Theming System

ZipList features a flexible theming system with:

- Four base themes: Peach, Mint, Bubblegum, and Rainbow
- CSS Custom Properties for consistent color application
- Reactive store-based theme management
- Theme persistence across sessions
- Animated gradient backgrounds for visual appeal

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Future Development

- Multi-device synchronization
- Enhanced voice command capabilities
- Advanced list organization
- Sharing capabilities
- Additional themes and animations

## License

This project is licensed under the MIT License - see the LICENSE file for details.
