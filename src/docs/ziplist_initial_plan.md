# Ziplist Initial Plan

## Project Overview

Ziplist is a voice-based list creation app that allows users to create lists through audio input. These lists are then visualized as stacked cards in the UI. The app features a ghost component as a central UI element and feedback mechanism during audio recording.

## Key Components

### 1. Ghost Integration

- Retain the ghost component as a core UI element
- Use ghost animations for feedback during audio recording
- Update ghost themes to align with new Ziplist branding
- Ghost SVG paths will be updated at a later date

### 2. List Card Visualization

- Develop card-based UI components to display list items
- Create a stacking mechanism for multiple list items
- Ensure cards work visually alongside the ghost component
- Design intuitive interactions for card management

### 3. Audio Transcription for Lists

- Adapt existing audio transcription service for list creation
- Modify parsing logic to identify and format list items
- Implement command recognition for list manipulation
- Create feedback system for successful list item additions

### 4. List Storage and Retrieval

- Implement persistent storage for user-created lists
- Design data structure for lists and list items
- Create service for managing list CRUD operations
- Add ability to categorize and organize multiple lists

### 5. Branding and Theming

- Update visual identity while maintaining ghost component
- Create new color schemes and typography for Ziplist
- Redesign UI components to match list-focused workflow
- Update app icons and splash screens

### 6. Card Stacking Animations

- Design smooth animations for card creation and stacking
- Implement transitions between list states
- Create visual feedback for list item management
- Ensure animations complement ghost animations

### 7. Documentation

- Update component documentation
- Create guidelines for list data structure
- Document audio command patterns
- Provide implementation details for new components

## Implementation Strategy

1. ~~Update front page and initial branding from TalkType to Ziplist~~ ✅ _Completed May 8, 2025_
2. Adapt the audio transcription service for list creation ⏳ _In Progress_
   - ~~Review existing `TranscriptionService` and `geminiService` to understand current capabilities and identify integration points for list-specific logic.~~ ✅ _Completed May 8, 2025_
   - ~~Define strategies for identifying list items from transcribed text (e.g., "add item...", "put ... on my list", bullet-point-like phrasing, pauses between items).~~ ✅ _Completed May 8, 2025_
   - Implement new parsing logic within or alongside `TranscriptionService` to extract structured list items from the raw transcribed text. This might involve a new `ListParser` utility. ✅ _ListParser created and integrated into TranscriptionService & stores. May 8, 2025_
   - Define a set of voice commands for list manipulation (e.g., "create new list", "add item", "remove last item", "clear list") and integrate command recognition. ✅ _Basic command keywords identified in ListParser. May 8, 2025_
   - Update `ghostStore` or related UI stores (`uiActions`, `transcriptionActions`) to reflect list creation events (e.g., item added, list cleared) for visual feedback. ⏳ _In Progress - Ghost reacts to "add item" and "clear list" commands._
   - Connect transcription results to the ghost component for feedback during list item capture (e.g., ghost nods or blinks when an item is understood).
   - Develop and execute test cases with diverse audio inputs, including various accents, speaking speeds, and background noise levels, to ensure robustness.
   - Consider how transcription errors will be handled and if users can correct them via voice or UI.
3. Implement basic list storage functionality
4. Create card UI components and stacking mechanism ⏳ _In Progress_
   - Created initial `ListComponent.svelte` to display parsed list items. _May 8, 2025_
   - Updated `ListComponent.svelte` to display items with interactive checkboxes. _May 8, 2025_
5. Complete remaining branding and visual elements
6. Integrate ghost with new list-focused workflow
7. Add animations and polish interactions
8. Update documentation

## Future Considerations

- Multi-device synchronization
- Sharing capabilities
- Advanced list organization features
- Enhanced voice command capabilities
