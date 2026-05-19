<script>
  import { createEventDispatcher } from 'svelte';
  import AnimatedTitle from './AnimatedTitle.svelte';

  // Event dispatcher to communicate with parent
  const dispatch = createEventDispatcher();

  // Debug helper

  // Function to handle title animation complete
  function handleTitleAnimationComplete() {
    dispatch('titleAnimationComplete');
  }

  // Function to handle subtitle animation complete
  function handleSubtitleAnimationComplete() {
    dispatch('subtitleAnimationComplete');
  }
</script>

<AnimatedTitle 
  on:titleAnimationComplete={handleTitleAnimationComplete}
  on:subtitleAnimationComplete={handleSubtitleAnimationComplete}
  on:toggleRecording
/>
