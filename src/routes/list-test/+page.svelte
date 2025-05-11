<script>
  import { fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { onMount } from 'svelte';
  
  // Demo data - in real app this would come from a store
  let list = {
    id: 'demo-list',
    name: 'Test List',
    items: [
      { id: 'item1', text: 'Buy groceries', checked: false },
      { id: 'item2', text: 'Call mom', checked: false },
      { id: 'item3', text: 'Finish presentation', checked: false },
      { id: 'item4', text: 'Take out trash', checked: true },
      { id: 'item5', text: 'Schedule dentist appointment', checked: true }
    ]
  };
  
  // State variables
  let newItemText = '';
  let isAddingItem = false;
  let showCompletionMessage = false;
  let completionMessageTimeout;
  let editingItem = null;
  let editingText = '';
  
  // Reactive statements for filtered items
  $: activeItems = list.items.filter(item => !item.checked);
  $: completedItems = list.items.filter(item => item.checked);
  $: sortedItems = [...activeItems, ...completedItems];
  $: allCompleted = list.items.length > 0 && activeItems.length === 0;
  
  // Helper for staggered animations
  function getStaggerDelay(index) {
    return index * 50; // 50ms between each item
  }
  
  // Toggle item check state
  function toggleItem(itemId) {
    const itemIndex = list.items.findIndex(item => item.id === itemId);
    if (itemIndex !== -1) {
      const wasChecked = list.items[itemIndex].checked;
      
      // Update the item's checked state
      list.items = list.items.map((item, i) => 
        i === itemIndex ? {...item, checked: !item.checked} : item
      );
      
      // If the item was just checked (not unchecked)
      if (!wasChecked) {
        // Add sparkle animation 
        setTimeout(() => {
          const checkbox = document.getElementById(`item-${itemId}`);
          if (checkbox) {
            // Force reflow to restart animation
            void checkbox.offsetWidth;
            
            // Check if all items are now completed
            if (list.items.every(item => item.checked)) {
              // Show completion message
              if (completionMessageTimeout) {
                clearTimeout(completionMessageTimeout);
              }
              
              showCompletionMessage = true;
              
              // Hide message after 4 seconds
              completionMessageTimeout = setTimeout(() => {
                showCompletionMessage = false;
              }, 4000);
            }
          }
        }, 50);
      }
    }
  }
  
  // Add a new item
  function addItem() {
    if (newItemText.trim()) {
      // Create new item with unique ID
      const newItem = {
        id: 'item' + Date.now(),
        text: newItemText.trim(),
        checked: false
      };
      
      // Add to list
      list = {
        ...list,
        items: [...list.items, newItem]
      };
      
      // Reset form
      newItemText = '';
      isAddingItem = false;
    }
  }
  
  // Handle "Enter" key in add item form
  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      addItem();
    } else if (event.key === 'Escape') {
      isAddingItem = false;
      newItemText = '';
    }
  }
  
  // Start editing an item
  function startEditing(item) {
    // Don't edit checked items
    if (item.checked) return;
    
    editingItem = item.id;
    editingText = item.text;
    
    // Focus the input after a brief delay to allow rendering
    setTimeout(() => {
      const input = document.getElementById(`edit-${item.id}`);
      if (input) input.focus();
    }, 50);
  }
  
  // Save edited item
  function saveEdit() {
    if (editingItem && editingText.trim()) {
      list.items = list.items.map(item => 
        item.id === editingItem 
          ? {...item, text: editingText.trim()} 
          : item
      );
    }
    
    // Reset editing state
    editingItem = null;
    editingText = '';
  }
  
  // Handle keydown in edit input
  function handleEditKeyDown(event) {
    if (event.key === 'Enter') {
      saveEdit();
    } else if (event.key === 'Escape') {
      editingItem = null;
      editingText = '';
    }
  }
</script>

<svelte:head>
  <title>ZipList - Test Page</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600&display=swap');
  </style>
</svelte:head>

<div class="page-container">
  <h1>Good Vibes Ziplist</h1>
  
  <div class="zl-card">
    <!-- Completion Message -->
    {#if showCompletionMessage}
      <div
        class="zl-completion-message"
        in:fly={{ y: -20, duration: 400 }}
        out:fade={{ duration: 300 }}
      >
        <div class="zl-message-content">
          <span class="zl-sparkle">✨</span>
          All zipped up!
          <span class="zl-sparkle">✨</span>
        </div>
      </div>
    {/if}
    
    <!-- List Items -->
    <ul class="zl-list">
      {#if sortedItems.length > 0}
        {#each sortedItems as item, index (item.id)}
          <li
            class="zl-item {item.checked ? 'checked' : ''}"
            animate:flip={{ duration: 300 }}
            in:fly={{ y: 20, duration: 300, delay: getStaggerDelay(index) }}
          >
            <label class="zl-checkbox-wrapper">
              <input
                type="checkbox"
                id="item-{item.id}"
                checked={item.checked}
                on:change={() => toggleItem(item.id)}
                class="zl-checkbox"
              />
              <span class="zl-checkbox-custom"></span>
            </label>
            
            {#if editingItem === item.id}
              <input 
                type="text" 
                id="edit-{item.id}"
                bind:value={editingText}
                on:blur={saveEdit}
                on:keydown={handleEditKeyDown}
                class="zl-edit-input"
                in:fade={{ duration: 200 }}
              />
            {:else}
              <span 
                class="zl-item-text {item.checked ? 'checked' : ''}"
                on:click={() => startEditing(item)}
              >
                {item.text}
              </span>
            {/if}
          </li>
        {/each}
      {:else}
        <div class="zl-empty-state">
          <p class="zl-empty-title">No thoughts, just vibes</p>
          <p class="zl-empty-description">Your list is a blank canvas waiting for inspiration</p>
        </div>
      {/if}
    </ul>
    
    <!-- Add Item Form -->
    {#if isAddingItem}
      <div class="zl-add-form" in:fade={{ duration: 300 }}>
        <input
          type="text"
          bind:value={newItemText}
          placeholder="What are we zipping up today?"
          class="zl-input"
          on:keydown={handleKeyDown}
          autofocus
        />
        <div class="zl-form-buttons">
          <button 
            class="zl-button primary" 
            on:click={addItem}
            disabled={!newItemText.trim()}
          >
            Add
          </button>
          <button 
            class="zl-button secondary" 
            on:click={() => isAddingItem = false}
          >
            Cancel
          </button>
        </div>
      </div>
    {:else}
      <button 
        class="zl-add-button" 
        on:click={() => isAddingItem = true}
        aria-label="Add new item"
      >
        +
      </button>
    {/if}
  </div>
</div>

<style>
  /* Animation keyframes */
  @keyframes sparkle {
    0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
    50% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  
  @keyframes soft-pulse {
    0%, 100% { opacity: 0.8; }
    50% { opacity: 1; }
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes pulse {
    0%, 100% { 
      transform: scale(1); 
      box-shadow: 0 0 15px rgba(236, 158, 255, 0.2);
    }
    50% { 
      transform: scale(1.02); 
      box-shadow: 0 0 20px rgba(236, 158, 255, 0.3);
    }
  }
  
  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .page-container {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  
  h1 {
    font-family: 'Space Mono', monospace;
    text-align: center;
    color: #c978ff;
    font-size: 2rem;
    margin-bottom: 1rem;
    text-shadow: 0 0 10px rgba(201, 120, 255, 0.2);
    letter-spacing: 1px;
    position: relative;
  }
  
  h1::after {
    content: '';
    position: absolute;
    width: 100%;
    height: 2px;
    bottom: -8px;
    left: 0;
    background: linear-gradient(90deg, rgba(255, 180, 180, 0), rgba(201, 120, 255, 0.5), rgba(255, 180, 180, 0));
    border-radius: 2px;
  }
  
  /* Card styling with soft pastel gradient */
  .zl-card {
    border-radius: 28px;
    background: linear-gradient(145deg, #ffcdc1, #ffc6e5);
    background-size: 200% 200%;
    animation: gradient-shift 20s ease infinite;
    box-shadow: 0 10px 20px rgba(201, 120, 255, 0.15);
    padding: 1.75rem;
    position: relative;
    overflow: hidden;
    font-family: 'Space Mono', monospace;
    transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  
  /* Subtle inner border effect */
  .zl-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 28px;
    padding: 2px;
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.6), rgba(201, 120, 255, 0.2));
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: destination-out;
    mask-composite: exclude;
    pointer-events: none;
    z-index: 1;
    opacity: 0.7;
  }
  
  .zl-card:hover {
    box-shadow: 0 12px 24px rgba(201, 120, 255, 0.2);
    transform: translateY(-3px);
  }
  
  /* Subtle light effect in the corner */
  .zl-card::after {
    content: '';
    position: absolute;
    top: -50px;
    left: -50px;
    width: 150px;
    height: 150px;
    background: radial-gradient(circle, rgba(255, 202, 236, 0.3) 0%, rgba(255, 202, 236, 0) 70%);
    border-radius: 50%;
    opacity: 0.5;
    pointer-events: none;
    animation: soft-pulse 8s infinite alternate ease-in-out;
  }

  /* List container */
  .zl-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 1.5rem;
  }
  
  /* Individual list items */
  .zl-item {
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.5);
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 4px 10px rgba(201, 120, 255, 0.1);
    position: relative;
    cursor: pointer;
    border-left: 3px solid rgba(201, 120, 255, 0.3);
  }

  .zl-item:hover {
    background: rgba(255, 255, 255, 0.7);
    transform: translateY(-3px);
    box-shadow: 0 6px 15px rgba(201, 120, 255, 0.15);
    border-left: 3px solid rgba(201, 120, 255, 0.5);
  }
  
  .zl-item::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 60%;
    height: 100%;
    background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 235, 246, 0.3) 100%);
    border-radius: 0 18px 18px 0;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }
  
  .zl-item:hover::after {
    opacity: 1;
  }
  
  .zl-item.checked {
    opacity: 0.75;
    background: rgba(245, 240, 250, 0.4);
    border-left: 3px solid rgba(201, 120, 255, 0.2);
    transform: scale(0.98);
    box-shadow: 0 2px 6px rgba(201, 120, 255, 0.05);
  }
  
  /* Item text */
  .zl-item-text {
    font-size: 1.05rem;
    font-weight: 500;
    line-height: 1.5;
    color: #555555;
    flex-grow: 1;
    transition: all 0.2s ease;
    font-family: 'Space Mono', monospace;
    text-transform: capitalize;
    letter-spacing: 0.5px;
  }
  
  .zl-item-text.checked {
    text-decoration: line-through rgba(201, 120, 255, 0.5) 1.5px;
    color: #9d9d9d;
  }
  
  /* Edit input */
  .zl-edit-input {
    font-size: 1.05rem;
    font-weight: 500;
    font-family: 'Space Mono', monospace;
    color: #555555;
    flex-grow: 1;
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(201, 120, 255, 0.3);
    border-radius: 8px;
    padding: 0.3rem 0.7rem;
    outline: none;
    transition: all 0.2s ease;
  }
  
  .zl-edit-input:focus {
    border-color: rgba(201, 120, 255, 0.6);
    box-shadow: 0 0 0 2px rgba(201, 120, 255, 0.15);
    background: rgba(255, 255, 255, 0.95);
  }
  
  /* Custom checkbox styling */
  .zl-checkbox-wrapper {
    position: relative;
    display: inline-block;
    cursor: pointer;
  }
  
  .zl-checkbox {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
  }
  
  .zl-checkbox-custom {
    position: relative;
    display: inline-block;
    width: 24px;
    height: 24px;
    border: 2px solid rgba(201, 120, 255, 0.5);
    border-radius: 8px;
    background-color: rgba(255, 255, 255, 0.8);
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 2px 5px rgba(201, 120, 255, 0.1);
  }
  
  .zl-checkbox-wrapper:hover .zl-checkbox-custom {
    border-color: rgba(201, 120, 255, 0.7);
    background-color: rgba(255, 245, 250, 0.8);
    transform: scale(1.1);
    box-shadow: 0 3px 8px rgba(201, 120, 255, 0.15);
  }
  
  /* Checkbox checked state */
  .zl-checkbox:checked + .zl-checkbox-custom {
    background: linear-gradient(145deg, #e9a8ff 0%, #c978ff 100%);
    border-color: transparent;
    box-shadow: 0 3px 8px rgba(201, 120, 255, 0.2);
  }
  
  /* Sparkle effect - simplified */
  .zl-checkbox:checked + .zl-checkbox-custom::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 70%);
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
    animation: sparkle 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.5) forwards;
    z-index: 5;
  }
  
  /* Completion message */
  .zl-completion-message {
    background: linear-gradient(135deg, #ffcdc1, #e9a8ff);
    padding: 0.8rem 1.2rem;
    border-radius: 18px;
    box-shadow: 0 8px 15px rgba(201, 120, 255, 0.15); 
    margin: 0 auto 1.75rem;
    text-align: center;
    max-width: 90%;
    position: relative;
    overflow: hidden;
    animation: pulse 3s infinite ease-in-out;
    border: 1px solid rgba(255, 255, 255, 0.8);
  }
  
  .zl-message-content {
    font-family: 'Space Mono', monospace;
    font-weight: 600;
    color: #555555;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.8rem;
    position: relative;
    text-transform: capitalize;
  }
  
  .zl-sparkle {
    font-size: 1.2rem;
    animation: spin 4s linear infinite;
    display: inline-block;
    color: #c978ff;
  }
  
  /* Empty state */
  .zl-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2.5rem 1rem;
    min-height: 200px;
    position: relative;
  }
  
  .zl-empty-state::before {
    content: '';
    position: absolute;
    width: 150px;
    height: 150px;
    background: radial-gradient(circle, rgba(236, 158, 255, 0.15) 0%, rgba(236, 158, 255, 0) 70%);
    border-radius: 50%;
    z-index: 0;
    animation: pulse 5s infinite ease-in-out;
  }
  
  .zl-empty-title {
    font-weight: 600;
    color: #c978ff;
    margin-bottom: 0.8rem;
    font-size: 1.2rem;
    font-family: 'Space Mono', monospace;
    position: relative;
    z-index: 1;
  }
  
  .zl-empty-description {
    color: #9d9d9d;
    font-size: 0.95rem;
    max-width: 270px;
    font-family: 'Space Mono', monospace;
    position: relative;
    z-index: 1;
  }
  
  /* Add item form */
  .zl-add-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.2rem;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 18px;
    box-shadow: 0 5px 15px rgba(201, 120, 255, 0.1);
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.8);
  }
  
  .zl-input {
    font-family: 'Space Mono', monospace;
    font-weight: 400;
    border: 2px solid rgba(201, 120, 255, 0.3);
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 12px;
    padding: 0.7rem 1rem;
    outline: none;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    color: #555555;
  }
  
  .zl-input::placeholder {
    color: #aaaaaa;
  }
  
  .zl-input:focus {
    border-color: rgba(201, 120, 255, 0.6);
    box-shadow: 0 0 0 3px rgba(201, 120, 255, 0.1);
    background-color: rgba(255, 255, 255, 0.95);
  }
  
  .zl-form-buttons {
    display: flex;
    gap: 0.8rem;
    justify-content: flex-end;
  }
  
  /* Buttons */
  .zl-button {
    border: none;
    border-radius: 12px;
    padding: 0.6rem 1.1rem;
    font-weight: 500;
    font-size: 0.95rem;
    font-family: 'Space Mono', monospace;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    position: relative;
    overflow: hidden;
  }
  
  .zl-button.primary {
    background: linear-gradient(135deg, #e9a8ff 0%, #c978ff 100%);
    color: white;
    box-shadow: 0 3px 8px rgba(201, 120, 255, 0.2);
  }
  
  .zl-button.primary:hover:not(:disabled) {
    box-shadow: 0 5px 12px rgba(201, 120, 255, 0.3);
    transform: translateY(-2px);
  }
  
  .zl-button.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .zl-button.secondary {
    background: rgba(255, 255, 255, 0.8);
    color: #c978ff;
    border: 1px solid rgba(201, 120, 255, 0.3);
  }
  
  .zl-button.secondary:hover {
    background: rgba(255, 255, 255, 0.95);
    border-color: rgba(201, 120, 255, 0.5);
    box-shadow: 0 3px 8px rgba(201, 120, 255, 0.1);
    transform: translateY(-2px);
  }
  
  /* Add button - simplified to a plus button */
  .zl-add-button {
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, #e9a8ff 0%, #c978ff 100%);
    border: none;
    color: white;
    border-radius: 50%;
    font-weight: 400;
    font-size: 2rem;
    line-height: 1;
    font-family: 'Space Mono', monospace;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(201, 120, 255, 0.2);
    position: relative;
    margin-left: auto;
    margin-right: auto;
    margin-top: 10px;
  }
  
  .zl-add-button:hover {
    box-shadow: 0 8px 20px rgba(201, 120, 255, 0.3);
    transform: translateY(-3px) scale(1.05);
  }
</style>