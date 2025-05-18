<script>
    import { onMount } from 'svelte';
    import { ghostStateStore } from '../state';
    import { ANIMATION_STATES } from '../animation/animationConstants';
    import { theme as themeStore } from '../theme';

    // Props
    export let expanded = false;
    export let position = 'bottom-right'; // Possible values: 'top-left', 'top-right', 'bottom-left', 'bottom-right'
    export let showControls = true;
    
    // State variables
    let currentTheme;
    let allStates = Object.values(ANIMATION_STATES);
    
    // Subscribe to stores
    let unsubscribeTheme;
    
    onMount(() => {
        // Initialize theme subscription
        unsubscribeTheme = themeStore.subscribe(value => {
            currentTheme = value;
        });
        
        return () => {
            // Clean up subscriptions
            if (unsubscribeTheme) unsubscribeTheme();
        };
    });
    
    // Toggle expanded state
    function toggleExpanded() {
        expanded = !expanded;
    }
    
    // Handle state change
    function setAnimationState(state) {
        ghostStateStore.setAnimationState(state);
    }
    
    // Handle recording state
    function toggleRecording() {
        ghostStateStore.setRecording(!$ghostStateStore.isRecording);
    }
    
    // Handle processing state
    function toggleProcessing() {
        ghostStateStore.setProcessing(!$ghostStateStore.isProcessing);
    }
    
    // Force a reaction
    function triggerReaction() {
        ghostStateStore.triggerReaction();
    }
    
    // Trigger wake up
    function wakeUp() {
        ghostStateStore.wakeUp();
    }
    
    // Toggle debug mode
    function toggleDebug() {
        ghostStateStore.setDebug(!$ghostStateStore.debug);
    }
    
    // Get position class
    $: positionClass = `position-${position}`;
</script>

<div class="ghost-state-debug {positionClass} {expanded ? 'expanded' : 'collapsed'}">
    <button class="toggle-button" on:click={toggleExpanded}>
        {expanded ? '×' : '👻'}
    </button>
    
    {#if expanded}
        <div class="state-display">
            <h3>Ghost State Debug</h3>
            
            <div class="state-info">
                <div class="state-row">
                    <strong>Current:</strong> 
                    <span class="state-value">{$ghostStateStore.current}</span>
                </div>
                <div class="state-row">
                    <strong>Previous:</strong> 
                    <span class="state-value">{$ghostStateStore.previous || 'none'}</span>
                </div>
                <div class="state-row">
                    <strong>Theme:</strong> 
                    <span class="state-value">{currentTheme}</span>
                </div>
                <div class="state-row">
                    <strong>Recording:</strong> 
                    <span class="state-value state-indicator {$ghostStateStore.isRecording ? 'active' : ''}">
                        {$ghostStateStore.isRecording ? 'Yes' : 'No'}
                    </span>
                </div>
                <div class="state-row">
                    <strong>Processing:</strong> 
                    <span class="state-value state-indicator {$ghostStateStore.isProcessing ? 'active' : ''}">
                        {$ghostStateStore.isProcessing ? 'Yes' : 'No'}
                    </span>
                </div>
                <div class="state-row">
                    <strong>Eyes Closed:</strong> 
                    <span class="state-value">{$ghostStateStore.eyesClosed ? 'Yes' : 'No'}</span>
                </div>
                <div class="state-row">
                    <strong>Eye Tracking:</strong> 
                    <span class="state-value">{$ghostStateStore.isEyeTrackingEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div class="state-row">
                    <strong>Eye Position:</strong> 
                    <span class="state-value">x: {$ghostStateStore.eyePosition.x.toFixed(2)}, y: {$ghostStateStore.eyePosition.y.toFixed(2)}</span>
                </div>
                <div class="state-row">
                    <strong>First Visit:</strong> 
                    <span class="state-value">{$ghostStateStore.isFirstVisit ? 'Yes' : 'No'}</span>
                </div>
                <div class="state-row">
                    <strong>Debug Mode:</strong> 
                    <span class="state-value state-indicator {$ghostStateStore.debug ? 'active' : ''}">
                        {$ghostStateStore.debug ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
            </div>
            
            {#if showControls}
                <div class="controls">
                    <h4>Controls</h4>
                    
                    <div class="control-section">
                        <h5>Animation States</h5>
                        <div class="button-grid">
                            {#each allStates as state}
                                <button 
                                    class="state-button {$ghostStateStore.current === state ? 'active' : ''}"
                                    on:click={() => setAnimationState(state)}
                                >
                                    {state}
                                </button>
                            {/each}
                        </div>
                    </div>
                    
                    <div class="control-section">
                        <h5>Toggle States</h5>
                        <div class="button-row">
                            <button 
                                class="toggle-button {$ghostStateStore.isRecording ? 'active' : ''}"
                                on:click={toggleRecording}
                            >
                                Recording
                            </button>
                            <button 
                                class="toggle-button {$ghostStateStore.isProcessing ? 'active' : ''}"
                                on:click={toggleProcessing}
                            >
                                Processing
                            </button>
                            <button 
                                class="toggle-button {$ghostStateStore.debug ? 'active' : ''}"
                                on:click={toggleDebug}
                            >
                                Debug
                            </button>
                        </div>
                    </div>
                    
                    <div class="control-section">
                        <h5>Actions</h5>
                        <div class="button-row">
                            <button class="action-button" on:click={triggerReaction}>Reaction</button>
                            <button class="action-button" on:click={wakeUp}>Wake Up</button>
                        </div>
                        <div class="button-row" style="margin-top: 0.5rem;">
                            <button 
                                class="action-button {$ghostStateStore.eyesClosed ? 'active' : ''}"
                                on:click={() => ghostStateStore.setEyesClosed(!$ghostStateStore.eyesClosed)}
                            >
                                Toggle Eyes {$ghostStateStore.eyesClosed ? 'Open' : 'Closed'}
                            </button>
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .ghost-state-debug {
        position: fixed;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #333;
        transition: all 0.3s ease;
    }
    
    .position-top-left {
        top: 1rem;
        left: 1rem;
    }
    
    .position-top-right {
        top: 1rem;
        right: 1rem;
    }
    
    .position-bottom-left {
        bottom: 1rem;
        left: 1rem;
    }
    
    .position-bottom-right {
        bottom: 1rem;
        right: 1rem;
    }
    
    .toggle-button {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #fff;
        border: 2px solid #e0e0e0;
        color: #333;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        position: absolute;
        z-index: 2;
    }
    
    .position-top-left .toggle-button,
    .position-bottom-left .toggle-button {
        right: -18px;
        top: 0;
    }
    
    .position-top-right .toggle-button,
    .position-bottom-right .toggle-button {
        left: -18px;
        top: 0;
    }
    
    .collapsed .toggle-button {
        position: static;
    }
    
    .state-display {
        background: #fff;
        border-radius: 0.75rem;
        padding: 1rem;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        max-width: 360px;
        max-height: 80vh;
        overflow-y: auto;
    }
    
    h3 {
        margin: 0 0 1rem 0;
        font-size: 16px;
        text-align: center;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #f0f0f0;
    }
    
    h4 {
        margin: 1rem 0 0.5rem 0;
        font-size: 15px;
    }
    
    h5 {
        margin: 0.5rem 0;
        font-size: 14px;
        font-weight: 500;
    }
    
    .state-info {
        background: #f9f9f9;
        border-radius: 0.5rem;
        padding: 0.75rem;
    }
    
    .state-row {
        display: flex;
        justify-content: space-between;
        margin: 0.25rem 0;
        line-height: 1.4;
    }
    
    .state-value {
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        font-size: 12px;
    }
    
    .state-indicator {
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        background: #f0f0f0;
    }
    
    .state-indicator.active {
        background: #5baefd;
        color: white;
    }
    
    .control-section {
        margin: 0.75rem 0;
        padding: 0.75rem;
        background: #f9f9f9;
        border-radius: 0.5rem;
    }
    
    .button-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
        gap: 0.5rem;
    }
    
    .button-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    
    .state-button, .toggle-button, .action-button {
        padding: 0.375rem 0.5rem;
        border-radius: 0.25rem;
        border: 1px solid #e0e0e0;
        background: #fff;
        font-size: 12px;
        cursor: pointer;
        text-align: center;
        transition: all 0.2s ease;
    }
    
    .state-button:hover, .toggle-button:hover, .action-button:hover {
        background: #f5f5f5;
        border-color: #d0d0d0;
    }
    
    .state-button.active {
        background: #5baefd;
        color: white;
        border-color: #4a9dee;
    }
    
    .toggle-button.active {
        background: #5baefd;
        color: white;
        border-color: #4a9dee;
    }
    
    .action-button {
        background: #f0f0f0;
        flex: 1;
    }
    
    /* For small screens, we need to make adjustments */
    @media (max-width: 768px) {
        .ghost-state-debug {
            font-size: 12px;
        }
        
        .state-display {
            max-width: 300px;
            padding: 0.75rem;
        }
        
        .button-grid {
            grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
        }
        
        .state-button, .toggle-button, .action-button {
            font-size: 11px;
            padding: 0.25rem 0.375rem;
        }
    }
</style>