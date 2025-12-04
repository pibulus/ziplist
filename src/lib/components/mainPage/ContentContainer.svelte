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

<!-- The AudioToText component has been removed. -->
<!-- The container div below is now empty and can also be removed if not needed for other content. -->
<div class="w-full max-w-xl sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
  <!-- Content that was previously AudioToText is now gone. -->
</div>
