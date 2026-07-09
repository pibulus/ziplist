<script>
  import { fly } from "svelte/transition";
  import BrandMark from "$lib/components/ui/BrandMark.svelte";
  import { listsService } from "$lib/services/lists/listsService";

  import { goto } from "$app/navigation";

  // Props
  export let sharedList;

  // Save the list and open it at home
  async function saveList() {
    if (sharedList) {
      await listsService.addList(sharedList);
      goto("/");
    }
  }
</script>

<div class="share-landing" in:fly={{ y: 16, duration: 250 }}>
  <!-- Letterhead: the brand lives on the page, not inside the list -->
  <div class="share-brand-row">
    <BrandMark />
  </div>

  <div class="share-card">
    <header class="share-card-header">
      <span class="share-dot" aria-hidden="true"></span>
      <h1 class="share-card-title">{sharedList.name}</h1>
    </header>

    <ul class="preview-items">
      {#each sharedList.items as item, i (i)}
        <li class="preview-item {item.checked ? 'checked' : ''}">
          <span class="preview-checkbox {item.checked ? 'checked' : ''}"
          ></span>
          <span class="preview-text">{item.text}</span>
        </li>
      {/each}
    </ul>

    <footer class="share-card-footer">
      <button type="button" class="save-button" on:click={saveList}>
        Save to ZipList
      </button>
    </footer>
  </div>

  <!-- The hook: a way onward for people who landed here from a friend -->
  <a class="share-hook" href="/">
    or start a list of your own
    <span aria-hidden="true">→</span>
  </a>
</div>

<style>
  .share-landing {
    width: min(92vw, 30rem);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
  }

  /* Brand letterhead above the card */
  .share-brand-row {
    align-self: flex-start;
    margin: 0 0.35rem 0.6rem;
  }

  /* The card wears the app's card frame */
  .share-card {
    display: flex;
    flex-direction: column;
    border-radius: var(--zl-card-border-radius, 28px);
    border: var(--zl-card-border-width, 3px) solid
      var(--zl-card-border-color, rgba(255, 212, 218, 0.8));
    box-shadow: var(--zl-card-box-shadow, 0 10px 30px rgba(0, 0, 0, 0.12));
    background: linear-gradient(
      135deg,
      var(--zl-card-bg-gradient-color-start, #fff6e5),
      var(--zl-card-bg-gradient-color-second, #ffecf0)
    );
    overflow: hidden;
  }

  /* Header band: a primary-tinted strip so the anatomy reads at a glance */
  .share-card-header {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.95rem 1.35rem;
    background: rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.12);
    border-bottom: 2px dashed
      var(--zl-item-border-color, rgba(255, 212, 218, 0.6));
  }

  .share-dot {
    flex-shrink: 0;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--zl-cta-color, #ffb000);
    box-shadow:
      0 0 0 2px rgba(255, 255, 255, 0.68),
      0 2px 6px rgba(0, 0, 0, 0.12);
  }

  .share-card-title {
    margin: 0;
    font-family: "Space Mono", monospace;
    font-size: 1.15rem;
    font-weight: 800;
    line-height: 1.25;
    color: var(--zl-text-color-primary, #444444);
    overflow-wrap: break-word;
    min-width: 0;
  }

  .preview-items {
    list-style: none;
    padding: 1.1rem 1.35rem;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  /* Rows wear the real ZipList item look */
  .preview-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 0.9rem;
    background: var(--zl-item-bg, rgba(255, 255, 255, 0.85));
    border-radius: 16px;
    border: 2px solid var(--zl-item-border-color, rgba(255, 212, 218, 0.6));
    border-left: 4px solid rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.3);
  }

  .preview-item.checked {
    opacity: var(--zl-item-checked-opacity, 0.75);
    background: var(--zl-item-checked-bg, rgba(245, 240, 250, 0.4));
    border-left-color: var(
      --zl-item-checked-border-color,
      rgba(255, 176, 0, 0.2)
    );
  }

  .preview-checkbox {
    position: relative;
    width: 28px;
    height: 28px;
    border-radius: var(--zl-checkbox-border-radius, 12px);
    border: var(--zl-checkbox-border, 2px solid rgba(255, 176, 0, 0.5));
    background: var(--zl-checkbox-bg, rgba(255, 255, 255, 0.8));
    flex-shrink: 0;
  }

  .preview-checkbox.checked {
    background: linear-gradient(
      145deg,
      var(--zl-checkbox-checked-gradient-start, #ffd680) 0%,
      var(--zl-checkbox-checked-gradient-end, #ffb000) 100%
    );
    border-color: transparent;
  }

  .preview-checkbox.checked::before {
    content: "";
    position: absolute;
    top: 44%;
    left: 50%;
    width: 38%;
    height: 20%;
    border-left: 2.5px solid white;
    border-bottom: 2.5px solid white;
    border-radius: 1px;
    transform: translate(-50%, -50%) rotate(-45deg);
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.28));
  }

  /* Item text matches the app's list items exactly */
  .preview-text {
    font-family: "Space Mono", monospace;
    font-size: 1.02rem;
    font-weight: 800;
    line-height: 1.35;
    color: var(--zl-text-color-primary, #444444);
    word-break: break-word;
  }

  .preview-item.checked .preview-text {
    text-decoration: line-through
      var(--zl-primary-color, rgba(255, 176, 0, 0.5)) 1.5px;
    color: var(--zl-text-color-disabled, #9d9d9d);
    font-weight: 700;
  }

  /* Footer band mirrors the header — one clear action, full width */
  .share-card-footer {
    padding: 0.95rem 1.35rem;
    background: rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.12);
    border-top: 2px dashed
      var(--zl-item-border-color, rgba(255, 212, 218, 0.6));
  }

  .save-button {
    width: 100%;
    min-height: 52px;
    border: none;
    border-radius: 999px;
    background: var(--zl-cta-color, #ffb000);
    color: #111111;
    font-family: "Space Mono", monospace;
    font-size: 1rem;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 3px 8px rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.25);
  }

  .save-button:hover,
  .save-button:focus-visible {
    transform: translateY(-2px);
    filter: saturate(1.08) brightness(1.04);
    box-shadow: 0 5px 15px rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.3);
    outline: none;
  }

  .save-button:active {
    transform: translateY(0) scale(0.99);
  }

  /* The onward path, quiet under the card */
  .share-hook {
    align-self: center;
    margin-top: 1rem;
    font-family: "Space Mono", monospace;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--zl-text-color-secondary, #666);
    text-decoration: none;
    padding: 0.5rem 0.85rem;
    border-radius: 999px;
    transition: all 0.2s ease;
  }

  .share-hook:hover,
  .share-hook:focus-visible {
    color: var(--zl-text-color-primary, #444);
    background: rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.12);
    outline: none;
  }

  @media (max-width: 480px) {
    .share-card-header,
    .share-card-footer {
      padding: 0.8rem 1rem;
    }

    .preview-items {
      padding: 0.9rem 1rem;
    }

    .preview-item {
      padding: 0.6rem 0.75rem;
    }

    .preview-text {
      font-size: 0.98rem;
    }
  }
</style>
