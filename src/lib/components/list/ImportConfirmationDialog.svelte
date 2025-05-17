<script>
  import { fade, fly } from 'svelte/transition';
  import { listsService } from '$lib/services/lists/listsService';
  import { goto } from '$app/navigation';
  
  // Props
  export let sharedList;
  export let onClose = () => {};
  
  // Import the list and navigate to home
  async function importList() {
    if (sharedList) {
      // Add the list using the listsService
      await listsService.addList(sharedList);
      
      // Close dialog and navigate home
      onClose();
      goto('/');
    }
  }
</script>

<div class="import-dialog-backdrop" transition:fade={{ duration: 200 }}>
  <div class="import-dialog" in:fly={{ y: 20, duration: 250 }}>
    <div class="import-dialog-header">
      <h2>Import Shared List</h2>
      <button class="close-button" on:click={onClose} aria-label="Close dialog">×</button>
    </div>
    
    <div class="import-dialog-content">
      {#if sharedList}
        <div class="import-preview">
          <h3>"{sharedList.name}" ({sharedList.items.length} {sharedList.items.length === 1 ? 'item' : 'items'})</h3>
          
          <ul class="preview-items">
            {#each sharedList.items as item, i (i)}
              <li class="preview-item {item.checked ? 'checked' : ''}">
                <span class="preview-checkbox {item.checked ? 'checked' : ''}"></span>
                <span class="preview-text">{item.text}</span>
              </li>
            {/each}
          </ul>
        </div>
      {:else}
        <div class="error-message">
          <p>Unable to decode shared list. The link may be invalid or corrupted.</p>
        </div>
      {/if}
    </div>
    
    <div class="import-dialog-actions">
      <button class="cancel-button" on:click={onClose}>Cancel</button>
      <button 
        class="import-button" 
        on:click={importList} 
        disabled={!sharedList}
      >
        Import List
      </button>
    </div>
  </div>
</div>

<style>
  /* Dialog backdrop */
  .import-dialog-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(3px);
  }
  
  /* Dialog container */
  .import-dialog {
    background: white;
    border-radius: 24px;
    width: 90%;
    max-width: 480px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    border: 3px solid var(--zl-card-border-color, rgba(255, 212, 218, 0.8));
    background: linear-gradient(135deg,
      var(--zl-card-bg-gradient-color-start, #fff6e5),
      var(--zl-card-bg-gradient-color-second, #ffecf0)
    );
  }
  
  /* Dialog header */
  .import-dialog-header {
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px dashed var(--zl-item-border-color, rgba(255, 212, 218, 0.6));
  }
  
  .import-dialog-header h2 {
    margin: 0;
    font-family: 'Space Mono', monospace;
    font-size: 1.5rem;
    color: var(--zl-text-color-primary, #444444);
  }
  
  .close-button {
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(201, 120, 255, 0.4);
    color: var(--zl-primary-color, #c978ff);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  
  .close-button:hover {
    background: rgba(255, 235, 245, 0.9);
    transform: scale(1.1);
  }
  
  /* Dialog content */
  .import-dialog-content {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }
  
  .import-preview h3 {
    font-family: 'Space Mono', monospace;
    font-size: 1.2rem;
    color: var(--zl-text-color-primary, #444444);
    margin-top: 0;
    margin-bottom: 1rem;
  }
  
  .preview-items {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .preview-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 12px;
    border: 1px solid var(--zl-item-border-color, rgba(255, 212, 218, 0.6));
  }
  
  .preview-item.checked {
    opacity: 0.75;
  }
  
  .preview-checkbox {
    width: 24px;
    height: 24px;
    border-radius: 8px;
    border: 2px solid rgba(201, 120, 255, 0.5);
    background: rgba(255, 255, 255, 0.8);
    flex-shrink: 0;
  }
  
  .preview-checkbox.checked {
    background: linear-gradient(145deg, 
      var(--zl-checkbox-checked-gradient-start, #e9a8ff) 0%, 
      var(--zl-checkbox-checked-gradient-end, #c978ff) 100%);
    border-color: transparent;
  }
  
  .preview-text {
    font-family: 'Space Mono', monospace;
    font-size: 1rem;
    color: var(--zl-text-color-primary, #444444);
    word-break: break-word;
  }
  
  .preview-item.checked .preview-text {
    text-decoration: line-through;
    color: var(--zl-text-color-disabled, #9d9d9d);
  }
  
  .error-message {
    background: rgba(255, 240, 240, 0.7);
    border: 1px solid rgba(255, 100, 100, 0.3);
    padding: 1rem;
    border-radius: 12px;
    color: #7b2c2c;
    font-family: 'Space Mono', monospace;
    text-align: center;
  }
  
  /* Dialog actions */
  .import-dialog-actions {
    padding: 1.5rem;
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    border-top: 1px solid rgba(201, 120, 255, 0.1);
    background: rgba(255, 255, 255, 0.5);
  }
  
  .cancel-button, .import-button {
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    font-family: 'Space Mono', monospace;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .cancel-button {
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(201, 120, 255, 0.3);
    color: var(--zl-text-color-secondary, #666666);
  }
  
  .cancel-button:hover {
    background: rgba(255, 255, 255, 0.95);
    transform: translateY(-2px);
  }
  
  .import-button {
    background: linear-gradient(135deg, 
      var(--zl-checkbox-checked-gradient-start, #e9a8ff) 0%, 
      var(--zl-checkbox-checked-gradient-end, #c978ff) 100%);
    border: none;
    color: white;
    box-shadow: 0 3px 8px rgba(201, 120, 255, 0.2);
  }
  
  .import-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(201, 120, 255, 0.3);
  }
  
  .import-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Responsive styles */
  @media (max-width: 480px) {
    .import-dialog {
      width: 95%;
      max-height: 95vh;
    }
    
    .import-dialog-header {
      padding: 1rem;
    }
    
    .import-dialog-header h2 {
      font-size: 1.3rem;
    }
    
    .import-dialog-content,
    .import-dialog-actions {
      padding: 1rem;
    }
    
    .preview-item {
      padding: 0.5rem 0.75rem;
    }
    
    .cancel-button, .import-button {
      padding: 0.5rem 1rem;
      font-size: 0.9rem;
    }
  }
</style>