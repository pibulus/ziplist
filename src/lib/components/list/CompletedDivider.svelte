<script>
  export let count = 0;
</script>

<li
  class="zl-completed-divider"
  role="listitem"
  aria-label="{count} completed items"
>
  <span class="zl-completed-line"></span>
  <span class="zl-completed-label">Done</span>
  <span class="zl-completed-count">{count}</span>
  <span class="zl-completed-line"></span>
</li>
