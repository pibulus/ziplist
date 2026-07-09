<script>
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import {
    extractListDataFromUrl,
    decodeSharedList,
  } from "$lib/services/share";
  import { PageLayout } from "$lib/components/layout";
  import ImportConfirmationDialog from "$lib/components/list/ImportConfirmationDialog.svelte";

  // State
  let sharedList = null;
  let isLoading = true;
  let error = null;

  onMount(() => {
    if (browser) {
      try {
        // Extract the encoded list data from the URL
        const encodedData = extractListDataFromUrl(window.location.href);

        if (!encodedData) {
          error = "That share link is missing its list details.";
          isLoading = false;
          return;
        }

        // Decode the list data
        sharedList = decodeSharedList(encodedData);

        if (!sharedList) {
          error = "That share link needs a fresh copy.";
          isLoading = false;
          return;
        }

        isLoading = false;
      } catch (err) {
        console.error("Error processing shared list:", err);
        error = "That shared list needs one more try.";
        isLoading = false;
      }
    }
  });
</script>

<PageLayout
  title="A list for you | ZipList"
  description="Open a ZipList share link and add the shared list to your own lists."
  canonical="https://ziplist.app/import"
  robots="noindex, nofollow, noarchive"
  ogTitle="Someone zipped you a list"
  ogDescription="Open a shared ZipList and add it to your own list stack."
  ogImageAlt="ZipList shared list"
>
  <div class="import-container">
    {#if isLoading}
      <div class="loading-container" role="status" aria-live="polite">
        <div class="loading-spinner" aria-hidden="true"></div>
        <p class="loading-text">Opening shared list...</p>
      </div>
    {:else if error}
      <div class="error-container" role="alert">
        <h2>That link needs another try</h2>
        <p class="error-message">{error}</p>
        <button type="button" class="back-button" on:click={() => goto("/")}>
          Open ZipList
        </button>
      </div>
    {:else if sharedList}
      <ImportConfirmationDialog {sharedList} />
    {/if}
  </div>
</PageLayout>

<style>
  .import-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: 1rem 0 2rem;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .loading-spinner {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: 4px solid rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.2);
    border-top-color: var(--zl-primary-color, #ffb000);
    animation: spin 1s infinite ease;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .loading-text {
    font-family: "Space Mono", monospace;
    font-size: 1.2rem;
    color: var(--zl-text-color-primary, #444444);
  }

  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 480px;
    padding: 2rem;
    background: rgba(255, 251, 235, 0.86);
    border-radius: 24px;
    border: 2px solid rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.32);
  }

  .error-container h2 {
    font-family: "Space Mono", monospace;
    color: #2f3a45;
    margin-top: 0;
  }

  .error-message {
    font-family: "Space Mono", monospace;
    color: #4b5563;
    margin-bottom: 2rem;
  }

  .back-button {
    background: var(--zl-primary-color, #ffb000);
    border: none;
    color: #111111;
    font-family: "Space Mono", monospace;
    font-weight: 700;
    padding: 0.75rem 1.5rem;
    border-radius: 999px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 3px 8px rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.25);
  }

  .back-button:hover {
    transform: translateY(-2px);
    filter: saturate(1.08) brightness(1.04);
    box-shadow: 0 5px 15px rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.3);
  }
</style>
