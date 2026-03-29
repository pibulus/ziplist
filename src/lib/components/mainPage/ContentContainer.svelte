<script>
  import { createEventDispatcher } from 'svelte';
  import AnimatedTitle from './AnimatedTitle.svelte';

  // Event dispatcher to communicate with parent
  const dispatch = createEventDispatcher();

  // Animation state variables
  let titleAnimationComplete = false;
  let subtitleAnimationComplete = false;

  // Debug helper

  // Function to handle title animation complete
  function handleTitleAnimationComplete() {
    titleAnimationComplete = true;
    dispatch('titleAnimationComplete');
  }

  // Function to handle subtitle animation complete
  function handleSubtitleAnimationComplete() {
    subtitleAnimationComplete = true;
    dispatch('subtitleAnimationComplete');
  }
</script>

<AnimatedTitle 
  on:titleAnimationComplete={handleTitleAnimationComplete}
  on:subtitleAnimationComplete={handleSubtitleAnimationComplete}
  on:toggleRecording
/>

