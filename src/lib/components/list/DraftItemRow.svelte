<script>
  import { fade, fly } from "svelte/transition";
  import { autoFocus } from "./autoFocus.js";
  import { extractTags, tagColour } from "$lib/services/lists/itemTags";

  export let listId;
  export let draftItemText = "";
  export let inputNode = null;
  export let staggerDelay = 0;
  export let onSaveDraft = () => {};
  export let onDraftKeyDown = () => {};
  export let onTyping = () => {};
  export let onCancelDraft = () => {};
  /** Tags this list already uses — offered while you type, not after. */
  export let suggestedTags = [];
  /** Other lists in the deck — offered as 1-tap portal targets when drafting a portal. */
  export let moveTargets = [];

  $: isDraftSection = /^##\s*/.test(draftItemText);
  $: isDraftPortal = /^(\u2192|->)\s*/.test(draftItemText);

  // Only offer what isn't already in the box, and if user is actively typing a #hashtag, filter by prefix!
  $: typedTags = extractTags(draftItemText).tags;
  $: hashMatch = draftItemText.match(/(?:^|\s)#([\p{L}\p{N}_-]*)$/u);
  $: partialQuery = hashMatch ? hashMatch[1].toLowerCase() : null;

  $: offers = (() => {
    const unselected = suggestedTags.filter((tag) => !typedTags.includes(tag));
    if (partialQuery !== null && partialQuery.length > 0) {
      const matched = unselected.filter((tag) =>
        tag.toLowerCase().startsWith(partialQuery),
      );
      return matched.slice(0, 6);
    }
    return unselected.slice(0, 5);
  })();

  function toggleSectionPrefix() {
    if (isDraftSection) {
      draftItemText = draftItemText.replace(/^##\s*/, "");
    } else {
      const clean = draftItemText.replace(/^(\u2192|->)\s*/, "");
      draftItemText = `## ${clean}`;
    }
    inputNode?.focus();
  }

  function togglePortalPrefix() {
    if (isDraftPortal) {
      draftItemText = draftItemText.replace(/^(\u2192|->)\s*/, "");
    } else {
      const clean = draftItemText.replace(/^##\s*/, "");
      draftItemText = `→ ${clean}`;
    }
    inputNode?.focus();
  }

  function selectPortalTarget(targetName) {
    draftItemText = `→ ${targetName}`;
    inputNode?.focus();
  }

  function appendTag(tag) {
    if (partialQuery !== null) {
      draftItemText = draftItemText.replace(
        /(?:^|\s)#([\p{L}\p{N}_-]*)$/u,
        (match) => {
          const lead = match.startsWith(" ") ? " " : "";
          return `${lead}#${tag} `;
        },
      );
    } else {
      draftItemText = `${draftItemText.trim()} #${tag} `.trimStart();
    }
    inputNode?.focus();
  }
</script>

<li
  class="zl-item editing zl-draft-item"
  in:fly={{ y: 20, duration: 220, delay: staggerDelay }}
  out:fly={{ y: -12, duration: 180 }}
  role="listitem"
>
  <div class="zl-checkbox-wrapper zl-draft-checkbox" aria-hidden="true">
    <span class="zl-checkbox-custom"></span>
  </div>

  <div class="edit-wrapper">
    <input
      id="draft-item-{listId}"
      class="zl-edit-input zl-draft-input"
      placeholder="New item..."
      aria-label="New item text"
      bind:value={draftItemText}
      bind:this={inputNode}
      on:blur={onSaveDraft}
      on:keydown={onDraftKeyDown}
      on:input={(event) => onTyping(event.currentTarget.value)}
      transition:fade={{ duration: 150 }}
      use:autoFocus
    />
  </div>

  <button
    type="button"
    class="zl-item-delete-button zl-draft-cancel"
    data-swipe-ignore="true"
    on:pointerdown|preventDefault
    on:click|stopPropagation={onCancelDraft}
    aria-label="Cancel new item"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  </button>
  <!-- pointerdown|preventDefault is load-bearing: the input saves on blur,
       so without it tapping a chip would commit the half-typed item. -->
  <div class="zl-draft-tags">
    <button
      type="button"
      class="zl-draft-tag zl-draft-syntax-chip"
      class:is-active={isDraftSection}
      data-swipe-ignore="true"
      title="Make this line a section header"
      on:pointerdown|preventDefault
      on:click|stopPropagation={toggleSectionPrefix}
    >
      § Section
    </button>
    {#if moveTargets.length > 0}
      <button
        type="button"
        class="zl-draft-tag zl-draft-syntax-chip"
        class:is-active={isDraftPortal}
        data-swipe-ignore="true"
        title="Link to another list"
        on:pointerdown|preventDefault
        on:click|stopPropagation={togglePortalPrefix}
      >
        → Portal
      </button>
    {/if}
    {#if isDraftPortal && moveTargets.length > 0}
      {#each moveTargets.slice(0, 5) as target (target.id)}
        <button
          type="button"
          class="zl-draft-tag zl-draft-portal-offer"
          style={target.primary ? `--tag-colour: ${target.primary}` : ""}
          data-swipe-ignore="true"
          on:pointerdown|preventDefault
          on:click|stopPropagation={() => selectPortalTarget(target.name)}
        >
          → {target.name}
        </button>
      {/each}
    {:else}
      {#each offers as tag (tag)}
        <button
          type="button"
          class="zl-draft-tag"
          style={`--tag-colour: ${tagColour(tag)}`}
          data-swipe-ignore="true"
          on:pointerdown|preventDefault
          on:click|stopPropagation={() => appendTag(tag)}
        >
          #{tag}
        </button>
      {/each}
    {/if}
  </div>
</li>
