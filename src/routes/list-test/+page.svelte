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
</script>

<svelte:head>
  <title>ZipList - Test Page</title>
  <style>
    /* Reset and base styles */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    /* Form elements reset */
    button, input {
      font-family: inherit;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #F9F5FF;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    
    /* Import fonts */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600&display=swap');
    
    /* Animation keyframes */
    @keyframes sparkle {
      0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
      50% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    
    @keyframes checkmark {
      from { transform: scale(0); }
      to { transform: scale(1); }
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    @keyframes pulse {
      0%, 100% { 
        transform: scale(1); 
        box-shadow: 0 8px 20px rgba(157, 134, 230, 0.15), 0 0 0 1px rgba(200, 180, 255, 0.2);
      }
      50% { 
        transform: scale(1.03); 
        box-shadow: 0 12px 25px rgba(157, 134, 230, 0.25), 0 0 0 1px rgba(200, 180, 255, 0.3);
      }
    }
  </style>
</svelte:head>

<div class="page-container">
  <h1>Minimalist List Test</h1>
  
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
            
            <span class="zl-item-text {item.checked ? 'checked' : ''}">
              {item.text}
            </span>
          </li>
        {/each}
        
        <!-- Removed divider as requested -->
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
      >
        {allCompleted ? 'All Zipped Up ✨' : 'Add More Goodness'}
      </button>
    {/if}
  </div>
</div>

<style>
  .page-container {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  
  h1 {
    font-family: 'Nunito', sans-serif;
    text-align: center;
    color: #8066d0;
    font-size: 2rem;
    margin-bottom: 1rem;
  }
  
  /* Card styling with NEON background and EXTREME corners */
  .zl-card {
    border-radius: 40px; /* SUPER pillowy corners */
    background: linear-gradient(145deg, #FF8A00, #FF00FF); /* EXTREME orange-pink gradient */
    box-shadow: 0 0 40px rgba(255, 0, 255, 0.5); /* MASSIVE pink glow */
    padding: 1.75rem;
    position: relative;
    overflow: hidden;
    font-family: 'Space Mono', monospace; /* FORCE monospace */
  }

  /* Fancy inner border effect - EXTREME */
  .zl-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 40px;
    padding: 4px; /* THICKER border */
    background: linear-gradient(145deg, #00FFFF, #FFFF00); /* CYAN-YELLOW gradient */
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: destination-out;
    mask-composite: exclude;
    pointer-events: none;
    z-index: 10; /* Ensure high z-index */
  }
  
  /* List container */
  .zl-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 1.5rem;
  }
  
  /* Individual list items - EXTREME */
  .zl-item {
    border-radius: 25px;
    background-color: rgba(0, 0, 0, 0.7); /* DARK background */
    padding: 16px 18px;
    display: flex;
    align-items: center;
    gap: 0.9rem;
    transition: all 0.3s ease;
    box-shadow: 0 0 15px #00FFFF; /* CYAN glow */
    position: relative;
    border: 3px solid #00FFFF; /* CYAN border */
    margin-bottom: 15px; /* More spacing */
  }

  .zl-item:hover {
    background: linear-gradient(90deg, #000000, #330066); /* DARK PURPLE gradient */
    transform: translateY(-8px) scale(1.05) rotate(1deg); /* EXTREME transform */
    box-shadow: 0 0 25px #FF00FF; /* PINK glow on hover */
    border-color: #FF00FF; /* PINK border on hover */
  }

  .zl-item.checked {
    opacity: 1; /* FULL opacity */
    background-color: #2D0050; /* PURPLE when checked */
    text-decoration: line-through #FF00FF solid 3px; /* EXTREME strikethrough */
    border: 3px dashed #FFFF00; /* YELLOW dashed border */
  }
  
  /* Item text - EXTREME */
  .zl-item-text {
    font-size: 1.2rem;
    font-weight: 700; /* BOLD */
    line-height: 1.5;
    color: #00FFFF; /* CYAN text */
    flex-grow: 1;
    transition: all 0.15s ease;
    text-shadow: 0 0 10px #00FFFF; /* GLOW */
    letter-spacing: 2px; /* SPACED OUT */
    font-family: 'Space Mono', monospace; /* FORCE monospace */
    text-transform: uppercase; /* ALL CAPS */
  }

  .zl-item-text.checked {
    text-decoration: line-through wavy #FF00FF 3px; /* WAVY line */
    color: #FFFF00; /* YELLOW text when checked */
    text-shadow: 0 0 10px #FFFF00; /* YELLOW glow */
    opacity: 0.8;
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
    width: 30px; /* BIGGER checkbox */
    height: 30px; /* BIGGER checkbox */
    border: 3px solid #FF00FF; /* NEON PINK border */
    border-radius: 8px;
    background-color: rgba(255, 255, 255, 0.9);
    transition: all 0.2s ease;
    box-shadow: 0 0 15px #FF00FF; /* EXTREME glow */
  }

  .zl-checkbox-wrapper:hover .zl-checkbox-custom {
    border-color: #00FFFF; /* CYAN on hover */
    background-color: rgba(245, 241, 255, 0.8);
    transform: scale(1.3); /* EXTREME scaling */
    box-shadow: 0 0 20px #00FFFF; /* EXTREME cyan glow */
  }

  /* Checkbox checked state */
  .zl-checkbox:checked + .zl-checkbox-custom {
    background: linear-gradient(135deg, #FF00FF 0%, #00FFFF 100%); /* GARISH gradient */
    border-color: #FFFF00; /* YELLOW border */
    box-shadow: 0 0 25px #FFFF00; /* EXTREME yellow glow */
  }

  /* Checkmark - EXTREME X */
  .zl-checkbox:checked + .zl-checkbox-custom::before {
    content: 'X';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-family: 'Space Mono', monospace; /* MONOSPACE font */
    font-size: 24px;
    font-weight: bold;
    color: #FFFF00; /* YELLOW X */
  }

  /* Sparkle effect - EXTREME */
  .zl-checkbox:checked + .zl-checkbox-custom::after {
    content: '✨';
    position: absolute;
    top: -10px;
    right: -10px;
    font-size: 20px;
    animation: spin 1s linear infinite;
  }
  
  /* Remove the divider entirely as requested */
  
  /* Completion message - EXTREME */
  .zl-completion-message {
    background: linear-gradient(135deg, #FF00FF, #FF8A00); /* PINK-ORANGE gradient */
    padding: 1.5rem;
    border-radius: 30px;
    box-shadow: 0 0 40px rgba(255, 0, 255, 0.6); /* EXTREME shadow */
    margin: 0 auto 1.75rem;
    text-align: center;
    max-width: 90%;
    position: relative;
    overflow: hidden;
    animation: pulse 0.5s infinite ease-in-out; /* FASTER pulse */
    border: 4px solid #FFFF00; /* YELLOW border */
    transform: rotate(-2deg); /* TILTED */
  }

  .zl-message-content {
    font-family: 'Space Mono', monospace; /* FORCE monospace */
    font-weight: 800; /* EXTRA BOLD */
    color: #FFFFFF; /* WHITE text */
    font-size: 1.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    position: relative;
    text-shadow: 0 0 10px #FFFFFF, 0 0 20px #FFFFFF; /* EXTREME glow */
    letter-spacing: 2px;
    text-transform: uppercase; /* ALL CAPS */
  }

  .zl-sparkle {
    font-size: 2rem; /* BIGGER sparkles */
    animation: spin 0.5s linear infinite; /* FASTER spin */
    display: inline-block;
    color: #FFFF00; /* YELLOW sparkles */
    text-shadow: 0 0 15px #FFFF00; /* EXTREME glow */
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
  }
  
  .zl-empty-title {
    font-weight: 600;
    color: #9d86e6;
    margin-bottom: 0.6rem;
    font-size: 1.2rem;
    font-family: 'Nunito', sans-serif;
  }
  
  .zl-empty-description {
    color: #9d9d9d;
    font-size: 0.95rem;
    max-width: 270px;
  }
  
  /* Add item form */
  .zl-add-form {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    padding: 1.2rem;
    background: linear-gradient(145deg, rgba(255, 252, 249, 0.9), rgba(255, 245, 236, 0.9));
    border-radius: 18px;
    box-shadow: 0 3px 10px rgba(186, 165, 240, 0.08), inset 0 0 0 1px rgba(200, 180, 255, 0.15);
  }
  
  .zl-input {
    font-family: 'Inter', sans-serif;
    font-weight: 400;
    border: 2px solid rgba(200, 180, 255, 0.5);
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 14px;
    padding: 0.6rem 0.9rem;
    outline: none;
    transition: all 0.25s ease;
    color: #444444;
  }
  
  .zl-input:focus {
    border-color: rgba(181, 152, 255, 0.8);
    box-shadow: 0 0 0 3px rgba(181, 152, 255, 0.2);
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
    border-radius: 14px;
    padding: 0.6rem 1rem;
    font-weight: 500;
    font-size: 0.95rem;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  
  .zl-button.primary {
    background: linear-gradient(135deg, #b598ff 0%, #9d86e6 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(157, 134, 230, 0.25);
  }
  
  .zl-button.primary:hover:not(:disabled) {
    box-shadow: 0 7px 14px rgba(157, 134, 230, 0.35);
    transform: translateY(-3px) scale(1.02);
  }
  
  .zl-button.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .zl-button.secondary {
    background: rgba(255, 255, 255, 0.8);
    color: #9d86e6;
    border: 1px solid rgba(181, 152, 255, 0.2);
    box-shadow: 0 2px 5px rgba(157, 134, 230, 0.1);
  }
  
  /* Add button (when form is hidden) - EXTREME */
  .zl-add-button {
    width: 100%;
    background: linear-gradient(90deg, #FF00FF, #00FFFF); /* NEON gradient */
    border: 3px solid #FFFF00; /* YELLOW border */
    color: #FFFFFF;
    border-radius: 20px;
    padding: 1rem 1.5rem;
    font-weight: 700;
    font-size: 1.3rem;
    font-family: 'Space Mono', monospace; /* FORCE monospace */
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 30px rgba(255, 0, 255, 0.6); /* EXTREME glow */
    position: relative;
    overflow: hidden;
    text-shadow: 0 0 10px #FFFFFF; /* Text glow */
    letter-spacing: 2px;
    text-transform: uppercase; /* ALL CAPS */
    margin-top: 20px;
  }

  .zl-add-button::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 50%);
    border-radius: 20px;
  }

  .zl-add-button:hover {
    box-shadow: 0 0 40px rgba(0, 255, 255, 0.7); /* CYAN glow on hover */
    transform: translateY(-5px) scale(1.05);
    background: linear-gradient(90deg, #00FFFF, #FF00FF); /* REVERSED gradient */
    animation: pulse 0.5s infinite; /* PULSING effect */
  }

  .zl-add-button::after {
    content: '✨';
    position: absolute;
    font-size: 2rem;
    right: 10px;
    animation: spin 1s linear infinite;
  }
</style>