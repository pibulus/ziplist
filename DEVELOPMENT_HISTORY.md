# ZipList Development History & Branch Reference

_Generated from git history analysis - Key insights and branch-specific features_

## 2025-01-13 - Initial Setup & Configuration

### Environment Setup
- **Node Version Management**: Locked Node.js version to 20.18.1 to resolve undici package compatibility issues
- **Created .nvmrc**: Added version file for consistent development environment across machines
- **Package Engine Constraints**: Added engine requirements to package.json to prevent version mismatches

### Development Server Configuration
- **Port**: Confirmed running on localhost:50002 (TalkType runs on 50001)
- **Ghost Asset Generation**: Auto-generates theme SVGs on server start
- **Vite**: Using Vite v6.3.5 with SvelteKit for fast HMR and builds

### Code Quality Improvements
- **Prettier**: Applied consistent formatting across all 90+ files
- **ESLint**: Analyzed codebase, found 24 non-breaking warnings (mostly unused vars)
- **Browserslist**: Updated to latest version (1.0.30001734) for better browser support

### Current Status
✅ Development server running successfully  
✅ Node version locked for team consistency  
✅ Code formatted and linted  
✅ Dependencies clean installed with npm  

### Known Issues (Non-Breaking)
- 24 ESLint warnings in ghost animation components (unused variables)
- Some unused CSS selectors in test components
- These don't affect functionality but marked for future cleanup

## Project Overview

**ZipList** is a voice-to-list application evolved from TalkType, focusing on creating and managing lists through voice transcription with AI-powered parsing.

### Core Architecture

- **Framework**: SvelteKit with Svelte 5.0
- **Styling**: Tailwind CSS with DaisyUI components
- **Build**: Vite with custom ghost asset generation plugin
- **AI Services**: Google Gemini API for transcription and list parsing

## Branch Features & Development Focus

### 🎯 **analytics** (16a8bce)

- **Purpose**: User behavior tracking and analytics
- **Key Feature**: PostHog integration for user behavior tracking
- **Status**: Ready for analytics implementation

### 🎙️ **offline-transcription-with-whisper** (7225463)

- **Purpose**: Client-side voice transcription without API calls
- **Key Features**:
  - Whisper model integration using @xenova/transformers
  - IndexedDB caching for models
  - Intent classification system for improved list parsing
  - Model registry and network manager
  - Transcription provider selector UI
  - ONNX Runtime integration with warning suppression
- **Architecture**: WebAssembly-based Whisper models with client-side processing
- **Status**: Feature-complete with model loading indicators

### 🔧 **vite-plugin-for-svg-creation** (1c1dcac)

- **Purpose**: SVG asset generation and management
- **Key Features**:
  - Refactored SVG structure with accessibility IDs
  - Ghost asset generation via Vite plugin
  - Improved path definitions for body, mouth, and tick elements
- **Status**: Production-ready SVG tooling

### 🌐 **web-share-api** (1666391)

- **Purpose**: List sharing and import functionality
- **Key Features**:
  - Import functionality for shared lists
  - Confirmation dialog for imports
  - Web Share API integration
- **Status**: Functional sharing system

### 🎨 **safe-theme-setup** (4a3aacc)

- **Purpose**: Robust theming system implementation
- **Key Features**:
  - SingleList component performance optimization
  - Safe theme switching architecture
  - CSS Custom Properties integration
- **Status**: Optimized and stable

### 🎨 **connect-theme-system** (fa285fc)

- **Purpose**: Advanced theme connectivity and gradients
- **Key Features**:
  - Vibrant multi-stop gradient effects for ghost components
  - Enhanced ghost gradient animations
  - Dynamic theme switching
- **Status**: Advanced theming complete

### 🧹 **cleanup-make-nice** (c7f8643)

- **Purpose**: Code cleanup and UI refinement
- **Key Features**:
  - Restored peachy pink theme with CSS Custom Properties
  - Clean component architecture
  - Improved code organization
- **Status**: Production-ready cleanup

### 🎭 **app-theme-manager** (44214e3)

- **Purpose**: Centralized theme management system
- **Key Features**:
  - Unified theme management architecture
  - Integration with main branch features
  - Theme state management
- **Status**: Merged with latest main features

## Core System Architecture

### Ghost Component System

- **Unified SVG Structure**: Single SVG with layered elements and accessibility IDs
- **Animation System**: Hardware-accelerated animations with proper state management
- **Theme Integration**: Dynamic gradients with multi-stop effects
- **Asset Generation**: Automated via Vite plugin for consistent output

### List Management System

```
/src/lib/services/lists/
├── listsService.js        # Core list operations
├── listsStore.js          # State management
└── index.js              # Service exports
```

### Transcription Architecture

- **Dual Provider System**: Online (Gemini API) + Offline (Whisper)
- **Intent Classification**: AI-powered parsing for better list extraction
- **Storage**: IndexedDB for offline model caching
- **UI**: Provider selection and model loading indicators

### Share System

- **Web Share API**: Native sharing capabilities
- **Import Flow**: Confirmation dialogs for shared list imports
- **Data Format**: JSON-based list sharing with validation

## Key Dependencies & Tools

### Production Dependencies

- **AI/ML**: `@google/generative-ai`, `@anthropic-ai/sdk`
- **UI Framework**: `svelte`, `@sveltejs/kit`, `daisyui`
- **Utilities**: `fuse.js` (search), `lru-cache` (caching)

### Development Tools

- **SVG Processing**: `@svgr/core`, `svgo`
- **Build**: `vite` with custom ghost asset generator plugin
- **Quality**: ESLint, Prettier, Lighthouse CI

## Branch-Specific Implementation Notes

### Offline Transcription Branch

- Uses `@xenova/transformers` for client-side Whisper models
- Implements progressive model downloading with status indicators
- ONNX Runtime warnings properly suppressed for production
- Intent classification enhances list parsing accuracy

### Theme System Branches

- **safe-theme-setup**: Focus on stability and performance
- **connect-theme-system**: Advanced gradient effects and animations
- **app-theme-manager**: Centralized management architecture

### Analytics Branch

- PostHog integration ready for deployment
- User behavior tracking setup complete
- Privacy-compliant analytics implementation

## Performance Optimizations

### Component Level

- **SingleList Component**: Optimized for performance and simplicity
- **Ghost Animations**: Hardware acceleration with proper cleanup
- **SVG Assets**: Automated generation for consistency

### Service Level

- **Model Caching**: IndexedDB for offline transcription models
- **State Management**: Efficient stores with proper reactivity
- **Error Handling**: Comprehensive error boundaries and logging

## Development Patterns

### Code Organization

- **Feature Branches**: Each branch focuses on specific functionality
- **Service Layer**: Clean separation of concerns
- **Component Structure**: Organized by functionality with proper exports

### Best Practices Established

- **SVG Accessibility**: Proper ID structure for screen readers
- **Theme Architecture**: CSS Custom Properties for dynamic theming
- **Error Handling**: Graceful degradation across all features
- **Performance**: Hardware acceleration and efficient state management

## Migration & Integration Notes

### From TalkType

- Core ghost component system retained and enhanced
- Audio transcription expanded with offline capabilities
- List-focused UI replaced general transcription interface

### Cross-Branch Features

- Ghost component improvements benefit all branches
- Theme system enhancements are compatible across versions
- SVG tooling supports all visual components

---

_This reference preserves the unique features and architectural decisions from each branch. Use this to understand branch-specific functionality and maintain feature consistency during development._
