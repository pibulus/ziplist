<script>
  import { createEventDispatcher } from "svelte";

  export let count = 0;
  const dispatch = createEventDispatcher();

  function handleClear() {
    dispatch("clear");
  }

  function handleReset() {
    dispatch("reset");
  }
</script>

<li
  class="zl-completed-divider"
  role="listitem"
  aria-label="{count} completed items"
>
  <span class="zl-completed-line" aria-hidden="true"></span>
  <span class="zl-completed-label">Done</span>
  <span class="zl-completed-count">{count}</span>
  <button
    type="button"
    class="zl-clear-done-btn zl-reset-done-btn"
    title="Reset completed items back to checklist"
    aria-label="Reset completed items back to checklist"
    on:click={handleReset}
  >
    ↺ Reset
  </button>
  <button
    type="button"
    class="zl-clear-done-btn"
    title="Clear completed items"
    aria-label="Clear completed items"
    on:click={handleClear}
  >
    Clear
  </button>
  <span class="zl-completed-line" aria-hidden="true"></span>
</li>
