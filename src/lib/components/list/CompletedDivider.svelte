<script>
  import { createEventDispatcher } from "svelte";

  export let count = 0;
  const dispatch = createEventDispatcher();

  function handleClear() {
    dispatch("clear");
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
    class="zl-clear-done-btn"
    title="Clear completed items"
    aria-label="Clear completed items"
    on:click={handleClear}
  >
    Clear done
  </button>
  <span class="zl-completed-line" aria-hidden="true"></span>
</li>
