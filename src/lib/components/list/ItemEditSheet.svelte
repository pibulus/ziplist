<script>
  // ===================================================================
  // ITEM EDIT SHEET — the second layer, for when one line isn't enough
  // ===================================================================
  // Inline editing stays the fast path (tap the words, retype, done). This
  // is where you go when the item needs more than a rename: tags, room to
  // think, a delete that isn't a swipe you might do by accident.
  //
  // The TEXT IS THE SOURCE OF TRUTH — same rule as listsStore.editItem.
  // Chips don't hold state; they read the hashtags out of what you typed and
  // write back into it. There is no second list of tags to disagree with the
  // first, which is the whole reason tag UIs usually rot.
  //
  // A native <dialog> on purpose: showModal() puts it in the top layer, so it
  // escapes .zl-card's overflow:clip that has eaten every popover we've tried
  // to float out of a list.

  import { createEventDispatcher, onMount, tick } from "svelte";
  import { extractTags, MAX_TAGS_PER_ITEM } from "$lib/services/lists/itemTags";

  export let item;
  /** Tags already used elsewhere in this list — reuse beats reinvention. */
  export let suggestedTags = [];

  const dispatch = createEventDispatcher();

  let dialog;
  let textarea;
  let draft = composeDraft(item);

  // Live read of whatever is in the box right now.
  $: parsed = extractTags(draft);
  $: tags = parsed.tags;
  $: canAddMore = tags.length < MAX_TAGS_PER_ITEM;
  $: suggestions = suggestedTags
    .filter((tag) => !tags.includes(tag))
    .slice(0, 6);
  $: canSave = parsed.text.trim().length > 0;

  /** The item's text with its tags put back as hashtags, ready to edit. */
  function composeDraft(source) {
    const text = source?.text ?? "";
    const existing = source?.tags ?? [];
    return existing.length
      ? `${text} ${existing.map((tag) => `#${tag}`).join(" ")}`
      : text;
  }

  function removeTag(tag) {
    // Same boundary rule as the parser: a # that starts a word.
    const pattern = new RegExp(
      `(^|\\s)#${tag.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}\\b`,
      "giu",
    );
    draft = draft.replace(pattern, "$1").replace(/\s+/g, " ").trim();
    textarea?.focus();
  }

  function addTag(tag) {
    if (!canAddMore) return;
    draft = `${draft.trim()} #${tag}`.trim();
    textarea?.focus();
  }

  function save() {
    if (!canSave) return;
    dispatch("save", { itemId: item.id, text: draft });
    close();
  }

  function close() {
    dispatch("close");
  }

  function handleKeydown(event) {
    // Enter saves, Shift+Enter is a genuine newline. Escape falls through to
    // the dialog's own cancel, which closes without saving.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      save();
    }
  }

  onMount(async () => {
    dialog?.showModal();
    await tick();
    textarea?.focus();
    // Caret at the end, not a select-all — you're usually appending, and
    // wiping the line on the first keystroke is a nasty surprise.
    const end = textarea?.value?.length ?? 0;
    textarea?.setSelectionRange(end, end);
  });
</script>

<dialog
  bind:this={dialog}
  class="zl-item-sheet"
  aria-label="Edit item"
  on:cancel|preventDefault={close}
  on:click|self={close}
>
  <div class="zl-item-sheet-card">
    <button
      type="button"
      class="zl-item-sheet-close"
      on:click={close}
      aria-label="Close">×</button
    >

    <label class="sr-only" for="zl-item-sheet-input">Item text</label>
    <textarea
      id="zl-item-sheet-input"
      bind:this={textarea}
      bind:value={draft}
      on:keydown={handleKeydown}
      class="zl-item-sheet-input"
      rows="2"
      placeholder="What is it?"
    ></textarea>

    {#if tags.length}
      <div class="zl-item-sheet-tags">
        {#each tags as tag (tag)}
          <button
            type="button"
            class="zl-item-sheet-chip is-on"
            on:click={() => removeTag(tag)}
            aria-label={`Remove tag ${tag}`}
          >
            #{tag}<span aria-hidden="true" class="zl-item-sheet-chip-x">×</span>
          </button>
        {/each}
      </div>
    {/if}

    {#if suggestions.length && canAddMore}
      <div class="zl-item-sheet-tags is-suggested">
        {#each suggestions as tag (tag)}
          <button
            type="button"
            class="zl-item-sheet-chip"
            on:click={() => addTag(tag)}
            aria-label={`Add tag ${tag}`}
          >
            #{tag}
          </button>
        {/each}
      </div>
    {/if}

    <div class="zl-item-sheet-actions">
      <button
        type="button"
        class="zl-item-sheet-delete"
        on:click={() => {
          dispatch("delete", { itemId: item.id });
          close();
        }}>Delete</button
      >
      <button
        type="button"
        class="zl-item-sheet-save"
        disabled={!canSave}
        on:click={save}>Done</button
      >
    </div>
  </div>
</dialog>

<style>
  :global(dialog.zl-item-sheet) {
    display: none;
    position: fixed;
    inset: 0;
    width: auto;
    height: auto;
    max-width: none;
    max-height: none;
    margin: 0;
    border: none;
    background: transparent;
    box-sizing: border-box;
    padding: max(14px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right))
      max(18px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  :global(dialog.zl-item-sheet[open]) {
    display: flex;
  }

  :global(dialog.zl-item-sheet)::backdrop {
    /* Warm shade, never a grey wash. */
    background: rgba(30, 23, 20, 0.42);
    backdrop-filter: blur(2px);
  }

  .zl-item-sheet-card {
    /* Space Mono, same as the list — the sheet is the same object up close,
       not a different app wearing a dialog. */
    font-family: "Space Mono", monospace;
    position: relative;
    width: min(28rem, 100%);
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    padding: 1.15rem 1.15rem 1rem;
    border-radius: 22px;
    background: var(--zl-card-bg, #fbf1e4);
    border: 2px solid rgba(30, 23, 20, 0.14);
    box-shadow: 0 18px 40px -14px rgba(30, 23, 20, 0.4);
    animation: sheet-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes sheet-pop {
    from {
      transform: translateY(10px) scale(0.97);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }

  /* Tucked, squishy — the family X. */
  .zl-item-sheet-close {
    position: absolute;
    top: -9px;
    right: -9px;
    width: 44px;
    height: 44px;
    /* Thumb-sized hit area; the visible disc stays the small tucked family X
       via an inset background rather than a smaller box. */
    background-clip: content-box;
    padding: 7px;
    border-radius: 999px;
    border: 2px solid rgba(30, 23, 20, 0.16);
    background: var(--zl-item-bg, #fffef7);
    color: #6b5f57;
    font-size: 1.05rem;
    line-height: 1;
    cursor: pointer;
    transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .zl-item-sheet-close:hover {
    transform: scale(1.1);
  }
  .zl-item-sheet-close:active {
    transform: scale(0.92);
  }

  .zl-item-sheet-input {
    font-family: inherit;
    font-size: 1.02rem;
    font-weight: 700;
    line-height: 1.35;
    color: var(--zl-text-color-primary, #1e1714);
    background: var(--zl-item-bg, #fffef7);
    /* Darker than the card's own 0.14 border, or the box doesn't read as a
       box until you focus it. */
    border: 2px solid rgba(30, 23, 20, 0.26);
    border-radius: 14px;
    padding: 0.7rem 0.8rem;
    resize: none;
    width: 100%;
    box-sizing: border-box;
  }
  .zl-item-sheet-input:focus {
    outline: none;
    border-color: color-mix(
      in srgb,
      var(--zl-primary-color, #a970ea) 55%,
      transparent
    );
  }

  .zl-item-sheet-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .zl-item-sheet-tags.is-suggested {
    opacity: 0.72;
  }

  .zl-item-sheet-chip {
    font-family: inherit;
    font-size: 0.72rem;
    font-weight: 800;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    gap: 0.22rem;
    min-height: 40px;
    padding: 0 0.7rem;
    border-radius: 999px;
    cursor: pointer;
    color: color-mix(
      in srgb,
      var(--zl-primary-color, #a970ea) 68%,
      #1e1714
    );
    background: var(--zl-item-bg, #fffef7);
    border: 1px dashed
      color-mix(in srgb, var(--zl-primary-color, #a970ea) 40%, transparent);
    transition: transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .zl-item-sheet-chip.is-on {
    border-style: solid;
    background: color-mix(
      in srgb,
      var(--zl-primary-color, #a970ea) 16%,
      var(--zl-item-bg, #fffef7)
    );
  }
  .zl-item-sheet-chip:hover {
    transform: scale(1.06);
  }
  .zl-item-sheet-chip:active {
    transform: scale(0.94);
  }
  .zl-item-sheet-chip-x {
    opacity: 0.55;
    font-size: 0.85rem;
  }

  .zl-item-sheet-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    margin-top: 0.15rem;
  }

  .zl-item-sheet-delete {
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0.5rem 0.4rem;
    border: none;
    background: none;
    /* Warm clay, not an alarm red — deleting a shopping line is not a crisis.
       Left as its own hue on purpose (not flattened to warm ink like the row
       tray's Remove): this is a plain text link standing alone next to one
       filled "Done" pill, so a quiet colour break is what tells you it's the
       different one. The tray's Remove sits inside a GRID of equal pill
       buttons instead, where the same treatment would either look like every
       other pill (illegible as "different") or scream (if made loud enough
       to stand out) — ink was the right call there, clay is the right call
       here. Same "calm, not alarming" philosophy, different context. */
    color: #b4614f;
    cursor: pointer;
    border-radius: 8px;
  }
  .zl-item-sheet-delete:hover {
    text-decoration: underline;
  }

  .zl-item-sheet-save {
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 800;
    min-height: 42px;
    padding: 0.55rem 1.5rem;
    border-radius: 999px;
    border: 2px solid rgba(30, 23, 20, 0.16);
    background: var(--zl-primary-color, #a970ea);
    color: #fffef7;
    cursor: pointer;
    transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .zl-item-sheet-save:hover:not(:disabled) {
    transform: scale(1.04);
  }
  .zl-item-sheet-save:active:not(:disabled) {
    transform: scale(0.96);
  }
  .zl-item-sheet-save:disabled {
    opacity: 0.45;
    cursor: default;
  }

  @media (prefers-reduced-motion: reduce) {
    .zl-item-sheet-card {
      animation: none;
    }
    .zl-item-sheet-chip,
    .zl-item-sheet-save,
    .zl-item-sheet-close {
      transition: none;
    }
  }
</style>
