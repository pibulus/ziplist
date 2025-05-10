# ZipList Application Structure Reference

This document provides a comprehensive overview of the ZipList application structure, components, and architecture. Use this as a reference for understanding how the various parts of the application work together.

## Table of Contents

1. [Overview](#overview)
2. [Main Layout Structure](#main-layout-structure)
3. [Core Components](#core-components)
   - [Ghost Component](#ghost-component)
   - [List Components](#list-components)
   - [Recording Components](#recording-components)
4. [State Management](#state-management)
5. [Services](#services)
6. [Animation System](#animation-system)
7. [Component Hierarchy](#component-hierarchy)
8. [Key Files Reference](#key-files-reference)

## Overview

ZipList is a voice-to-list web application that allows users to create, manage, and organize lists by speaking. The app consists of several key components:

- A Ghost mascot that acts as the primary interaction point
- A carousel of list cards for displaying and managing lists
- A recording button for voice input
- Supporting UI elements like animated title, footer, and modals

The application uses Svelte/SvelteKit as its framework with a component-based architecture. State management is handled through Svelte stores, and various services manage business logic like list operations, voice transcription, and theme management.

## Main Layout Structure

The application layout follows a vertical stack pattern:

```
┌────────────────────────────────────┐
│            PageLayout              │
├────────────────────────────────────┤
│             Ghost Icon             │
├────────────────────────────────────┤
│           Animated Title           │
├────────────────────────────────────┤
│            ListCarousel            │
├────────────────────────────────────┤
│         Record Button Area         │
├────────────────────────────────────┤
│               Footer               │
└────────────────────────────────────┘
```

The `PageLayout` component (`/src/lib/components/layout/PageLayout.svelte`) provides the base container with:
- A gradient background (`bg-gradient-mesh`)
- Responsive padding and spacing
- Fixed footer with attribution and navigation buttons
- Centralized content with max-width constraints

## Core Components

### Ghost Component

**Files:**
- `/src/lib/components/ghost/Ghost.svelte`: Main ghost SVG component
- `/src/lib/components/mainPage/GhostContainer.svelte`: Container for the ghost
- `/src/lib/components/ghost/README.md`: Detailed documentation for the Ghost

**Key Features:**
- SVG-based interactive mascot with animation states
- Serves as the primary recording trigger when clicked
- Visual feedback for recording and processing states
- Theme support (peach, mint, bubblegum, rainbow gradients)
- Eye tracking and blinking animations
- Multiple animation states (idle, recording, processing, asleep, etc.)

The Ghost is a central UI element that responds to user interaction and provides visual feedback for the application state.

### List Components

**Key Files:**
- `/src/lib/components/list/ListCard.svelte`: Individual list display
- `/src/lib/components/list/ListCarousel.svelte`: Container for multiple lists
- `/src/lib/components/list/ListComponent.svelte`: Simple list display component
- `/src/lib/services/lists/listsService.js`: Service for list operations
- `/src/lib/services/lists/listsStore.js`: State management for lists

**ListCard Features:**
- Display list name and items
- Toggle item completion status
- Drag-and-drop reordering with visual feedback
- Show/hide completed items
- Edit, add, and delete items
- Rename and delete lists
- Item filtering

**ListCarousel Features:**
- Displays lists in a 3D carousel layout
- Touch swipe gesture support
- Navigation buttons for list traversal
- Visual effects for active, previous, and next list cards
- Integration with list services for CRUD operations

### Recording Components

**Key Files:**
- `/src/lib/components/mainPage/audio-transcript/RecordButtonWithTimer.svelte`: Recording button with timer
- `/src/lib/services/transcription/transcriptionService.js`: Handles voice transcription

**Features:**
- Visual recording button with gradient styling
- Recording timer with progress indication
- Warning states based on remaining recording time
- Recording status feedback through animations and color changes
- Interface for starting/stopping voice recording

## State Management

The application uses Svelte stores for state management:

**Core Stores:**
- `listsStore`: Manages lists data, active list selection, and persistence
- `ghostStateStore`: Manages ghost animation states and interactions
- `themeStore`: Manages application theme
- Various audio and transcription state stores

**Data Flow:**
1. User interactions (clicks, voice input) trigger UI components
2. Components dispatch events or call services
3. Services update stores with new state
4. UI reactively updates based on store changes

## Services

The application uses service modules to encapsulate business logic:

**Key Services:**
- `listsService`: Provides methods for creating, updating, and managing lists
- `transcriptionService`: Handles audio recording and transcription
- `listParser`: Parses transcription results into structured list items
- `themeService`: Manages application theming
- `animationService`, `blinkService`: Manage ghost animations
- `storageUtils`: Handles local storage operations

Services follow a singleton pattern where a single instance is exported for use across the application.

## Animation System

The application uses several animation techniques:

**Text Animations:**
- Staggered letter animations for the title
- Slide-in animations for subtitles
- CSS transitions for interactive elements

**Ghost Animations:**
- SVG-based animations for the ghost character
- Eye tracking and blinking
- State-based animations (recording, processing, idle)
- Theme-based gradient animations

**List Animations:**
- 3D perspective transforms for the carousel
- Transition effects between lists
- Drag-and-drop interaction animations

## Component Hierarchy

```
Routes
└── +page.svelte
    └── MainContainer.svelte
        ├── GhostContainer.svelte
        │   └── Ghost.svelte
        ├── ContentContainer.svelte
        │   └── AnimatedTitle.svelte
        ├── ListCarousel.svelte
        │   └── ListCard.svelte (multiple)
        ├── RecordButtonWithTimer.svelte
        └── FooterComponent.svelte
```

## Key Files Reference

### Main Page Components

- `/src/routes/+page.svelte`: Main entry point
- `/src/lib/components/mainPage/MainContainer.svelte`: Main container component
- `/src/lib/components/mainPage/GhostContainer.svelte`: Container for ghost
- `/src/lib/components/mainPage/ContentContainer.svelte`: Content area container
- `/src/lib/components/mainPage/AnimatedTitle.svelte`: Animated title component
- `/src/lib/components/mainPage/FooterComponent.svelte`: Footer navigation

### List Components

- `/src/lib/components/list/ListCarousel.svelte`: List carousel component
- `/src/lib/components/list/ListCard.svelte`: Individual list card component
- `/src/lib/components/list/ListComponent.svelte`: Simple list component

### Recording Components

- `/src/lib/components/mainPage/audio-transcript/RecordButtonWithTimer.svelte`: Recording button

### Services

- `/src/lib/services/lists/listsService.js`: List operations service
- `/src/lib/services/lists/listsStore.js`: List state management
- `/src/lib/services/listParser.js`: Parses voice transcriptions into list items
- `/src/lib/services/transcription/transcriptionService.js`: Audio transcription
- `/src/lib/services/theme/themeService.js`: Theme management
- `/src/lib/services/infrastructure/storageUtils.js`: Storage utilities

### Configuration

- `/src/lib/constants.js`: Application constants including themes, storage keys
- `/src/lib/components/ghost/animationConfig.js`: Ghost animation configuration

## Visual Structure

The front page layout has these key elements in vertical order:

1. **Ghost Icon**: Centered at the top, responsive sizing (36px-64px)
2. **Animated Title**: "Ziplist" with staggered letter animations
3. **Subtitle**: App description with slide-in animation
4. **ListCarousel**: 3D carousel of list cards with navigation
5. **Record Button**: Large button with recording status and timer
6. **Footer**: Fixed at bottom with About, Settings, and Chrome Extension buttons

The visual hierarchy emphasizes the Ghost icon as the primary visual element, with the ListCarousel as the main content area and the Record Button as a secondary interaction point.

---

This document provides a high-level overview of the ZipList application structure. For more detailed information on specific components, refer to their respective source files and README documents.