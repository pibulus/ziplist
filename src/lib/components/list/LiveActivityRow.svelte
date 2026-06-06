<script>
  import { fly } from "svelte/transition";

  export let activity;
  export let type = "draft";
  export let staggerDelay = 0;

  $: color = activity?.color || "#00d4ff";
  $: text = activity?.text || "";
  $: isVoice = type === "voice";
  $: rowLabel = isVoice
    ? "A collaborator is speaking into this live list"
    : text
      ? "A collaborator is drafting a list item"
      : "A collaborator is adding a list item";
</script>

<li
  class="zl-item zl-live-activity-row"
  class:zl-live-voice-row={isVoice}
  style="--remote-color: {color}; --remote-glow: {color}33;"
  role="listitem"
  aria-label={rowLabel}
  in:fly={{ y: 12, duration: 180, delay: staggerDelay }}
  out:fly={{ y: -8, duration: 140 }}
>
  <div class="zl-live-activity-orb" aria-hidden="true">
    {#if isVoice}
      <span></span>
      <span></span>
      <span></span>
    {:else}
      <span></span>
    {/if}
  </div>

  <div class="zl-live-activity-body">
    {#if isVoice}
      <div class="zl-live-voice-wave" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
    {:else if text}
      <span class="zl-live-draft-text">{text}</span>
      <span class="zl-live-caret" aria-hidden="true"></span>
    {:else}
      <span class="zl-live-draft-empty" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </span>
    {/if}
  </div>
</li>
