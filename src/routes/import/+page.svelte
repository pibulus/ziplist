<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { extractListDataFromUrl, decodeSharedList } from '$lib/services/share';
  import { PageLayout } from '$lib/components/layout';
  import ImportConfirmationDialog from '$lib/components/list/ImportConfirmationDialog.svelte';
  
  // State
  let sharedList = null;
  let isLoading = true;
  let error = null;
  let showDialog = false;
  
  onMount(() => {
    if (browser) {
      try {
        // Extract the encoded list data from the URL
        const encodedData = extractListDataFromUrl(window.location.href);
        
        if (!encodedData) {
          error = 'No list data found in the URL';
          isLoading = false;
          return;
        }
        
        // Decode the list data
        sharedList = decodeSharedList(encodedData);
        
        if (!sharedList) {
          error = 'Unable to decode the shared list';
          isLoading = false;
          return;
        }
        
        // Show the import confirmation dialog
        isLoading = false;
        showDialog = true;
      } catch (err) {
        console.error('Error processing shared list:', err);
        error = 'An error occurred while processing the shared list';
        isLoading = false;
      }
    }
  });
  
  // Close dialog and go back to home
  function handleClose() {
    showDialog = false;
    goto('/');
  }
</script>

<PageLayout>
  <div class="import-container">
    {#if isLoading}
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p class="loading-text">Processing shared list...</p>
      </div>
    {:else if error}
      <div class="error-container">
        <h2>Something went wrong</h2>
        <p class="error-message">{error}</p>
        <button class="back-button" on:click={() => goto('/')}>
          Go back home
        </button>
      </div>
    {/if}
    
    {#if showDialog && sharedList}
      <ImportConfirmationDialog 
        sharedList={sharedList} 
        onClose={handleClose} 
      />
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
    padding: 2rem;
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
    border: 4px solid rgba(201, 120, 255, 0.2);
    border-top-color: rgba(201, 120, 255, 0.8);
    animation: spin 1s infinite ease;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .loading-text {
    font-family: 'Space Mono', monospace;
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
    background: rgba(255, 240, 240, 0.8);
    border-radius: 24px;
    border: 2px solid rgba(255, 100, 100, 0.3);
  }
  
  .error-container h2 {
    font-family: 'Space Mono', monospace;
    color: #7b2c2c;
    margin-top: 0;
  }
  
  .error-message {
    font-family: 'Space Mono', monospace;
    color: #7b2c2c;
    margin-bottom: 2rem;
  }
  
  .back-button {
    background: white;
    border: 2px solid rgba(201, 120, 255, 0.4);
    color: var(--zl-primary-color, #c978ff);
    font-family: 'Space Mono', monospace;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .back-button:hover {
    background: rgba(255, 245, 250, 0.9);
    transform: translateY(-2px);
    box-shadow: 0 3px 8px rgba(201, 120, 255, 0.2);
  }
</style>