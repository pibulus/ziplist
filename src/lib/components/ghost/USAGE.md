# Ghost Component Usage Guide

This document provides quick examples for using the Ghost component in your application.

## Basic Usage

```svelte
<script>
  import Ghost from '$lib/components/ghost';
</script>

<Ghost />
```

## With Theme and State Control

```svelte
<script>
  import Ghost from '$lib/components/ghost';
  import { setTheme } from '$lib/components/ghost';

  let recording = false;

  function toggleRecording() {
    recording = !recording;
  }

  // Change theme programmatically
  function changeTheme(themeName) {
    setTheme(themeName);
  }
</script>

<div class="controls">
  <button on:click={() => changeTheme('mint')}>Mint Theme</button>
  <button on:click={() => changeTheme('peach')}>Peach Theme</button>
  <button on:click={() => changeTheme('bubblegum')}>Bubblegum Theme</button>
  <button on:click={() => changeTheme('rainbow')}>Rainbow Theme</button>

  <button on:click={toggleRecording}>
    {recording ? 'Stop Recording' : 'Start Recording'}
  </button>
</div>

<Ghost {recording} />
```

## Advanced Usage with Animation Control

```svelte
<script>
  import Ghost from '$lib/components/ghost';
  import { GhostSystem, ANIMATION_STATES } from '$lib/components/ghost';
  import { onMount } from 'svelte';

  let ghostRef;

  // Direct control of state through the state store
  function triggerSpecialAnimation() {
    GhostSystem.stateStore.setAnimationState(ANIMATION_STATES.EASTER_EGG);
  }

  function startThinking() {
    GhostSystem.stateStore.setProcessing(true);
  }

  function stopThinking() {
    GhostSystem.stateStore.setProcessing(false);
  }

  function applyPulseEffect() {
    // Using state store method
    GhostSystem.stateStore.triggerReaction();
  }
</script>

<div class="controls">
  <button on:click={triggerSpecialAnimation}>Trigger Easter Egg</button>
  <button on:click={startThinking}>Start Thinking</button>
  <button on:click={stopThinking}>Stop Thinking</button>
  <button on:click={applyPulseEffect}>Pulse Effect</button>
</div>

<Ghost bind:this={ghostRef} />
```

## Using DisplayGhost for Static Display

The `DisplayGhost` component is a simplified version without interactions, suitable for static displays:

```svelte
<script>
  import { DisplayGhost } from '$lib/components/ghost';
</script>

<DisplayGhost theme="mint" />
```

## Creating a Theme Switcher Component

```svelte
<script>
  import { theme, setTheme } from '$lib/components/ghost';

  const themes = ['peach', 'mint', 'bubblegum', 'rainbow'];
</script>

<div class="theme-switcher">
  <h3>Choose Theme</h3>
  {#each themes as themeName}
    <button
      class:active={$theme === themeName}
      on:click={() => setTheme(themeName)}
    >
      {themeName}
    </button>
  {/each}
</div>

<style>
  .theme-switcher {
    display: flex;
    gap: 0.5rem;
  }
  .active {
    background: #ddd;
    font-weight: bold;
  }
</style>
```

## Working with the Ghost System API

For advanced control, you can work directly with the GhostSystem:

```javascript
import { GhostSystem } from "$lib/components/ghost";

// Theme management
GhostSystem.themeStore.setTheme("mint");
const currentTheme = GhostSystem.themeStore.get();

// Animation state management
GhostSystem.stateStore.setAnimationState("recording");
GhostSystem.stateStore.setRecording(true);
GhostSystem.stateStore.setProcessing(true);

// Eye tracking
GhostSystem.stateStore.setEyePosition(0.5, 0.5); // x, y coordinates (normalized -1 to 1)
GhostSystem.stateStore.setEyesClosed(true); // Close eyes
GhostSystem.stateStore.resetInactivityTimer(); // Reset inactivity timer
GhostSystem.stateStore.wakeUp(); // Wake up from sleep state
```

## Working with Reactive Stores

You can subscribe to Ghost state changes:

```svelte
<script>
  import { GhostSystem } from '$lib/components/ghost';

  // Subscribe to state changes
  let currentState = 'initial';
  let isRecording = false;

  // Using deconstructed stores directly
  import { currentState as ghostCurrentState, isRecording as ghostIsRecording } from '$lib/components/ghost';

  $: console.log('Current state:', $ghostCurrentState);
  $: console.log('Recording state:', $ghostIsRecording);
</script>

<div>
  <p>Ghost State: {$ghostCurrentState}</p>
  <p>Recording: {$ghostIsRecording ? 'Yes' : 'No'}</p>
</div>
```

## Customization Tips

1. **Favor composition over modification**:  
   Instead of modifying the Ghost component directly, wrap it in your own component that manages state and interactions.

2. **Use the available animation constants**:  
   The ANIMATION_STATES and ANIMATION_BEHAVIORS exports provide a way to work with the animation system consistently.

3. **Subscribe to state changes**:  
   Use Svelte's reactive statements to respond to ghost state changes.

4. **Static vs. Interactive**:  
   Choose DisplayGhost for static displays, and Ghost for interactive elements.
