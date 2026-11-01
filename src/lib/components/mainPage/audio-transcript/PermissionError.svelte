<script>
  import { browser } from "$app/environment";
  import { createEventDispatcher } from "svelte";
  import { pwaService } from "$lib/services/pwa";

  // Event handling
  const dispatch = createEventDispatcher();

  let title = "Microphone Needs Access";
  let description =
    "ZipList needs microphone access for voice lists. Update your browser settings when you are ready.";
  let steps = [
    "Click the microphone or lock icon in your address bar",
    'Select "Allow" for microphone access',
    "Refresh the page and try again",
  ];

  import {
    getInAppBrowserName,
    getUnsupportedBrowserMessage,
  } from "$lib/services/audio/inAppBrowser.js";

  if (browser) {
    const inApp = getInAppBrowserName();
    if (inApp) {
      title = `${inApp} Blocks the Microphone`;
      description = getUnsupportedBrowserMessage();
      steps = [
        "Tap the ••• or share menu in this app",
        'Select "Open in Safari" or "Open in Chrome"',
        "Speak your list freely in your standard browser",
      ];
    } else {
      const platform = pwaService.getPlatformInfo();

      if (platform.isIOS) {
        title = "Microphone Needs Access";
        description =
          "ZipList needs microphone access for voice lists. iPhone permissions are managed outside the app.";
        steps = platform.isStandalone
          ? [
              "Open iOS Settings",
              "Find ZipList or Safari",
              "Allow Microphone, then reopen ZipList",
            ]
          : [
              "Open iOS Settings",
              "Go to Safari, then Microphone",
              "Allow access, then reopen ZipList",
            ];
      } else if (platform.isAndroid) {
        title = "Microphone Needs Access";
        description =
          "ZipList needs microphone access for voice lists. Update this site's microphone permission when you are ready.";
        steps = [
          "Open site settings from your browser menu",
          'Set Microphone to "Allow"',
          "Refresh ZipList and try again",
        ];
      }
    }
  }

  // Close the modal when clicked
  function closeModal() {
    dispatch("close");
  }
</script>

<svelte:window on:keydown={(e) => e.key === "Escape" && closeModal()} />

<div
  class="permission-error-container flex w-full justify-center"
  role="status"
  aria-labelledby="permission_error_title"
  aria-describedby="permission_error_description"
  aria-live="polite"
>
  <div class="permission-error-modal">
    <!-- Icon and title -->
    <div class="modal-header">
      <div class="error-icon">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-6 w-6"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h3 id="permission_error_title">{title}</h3>
    </div>

    <!-- Permission error message -->
    <p id="permission_error_description">
      {description}
    </p>

    <!-- Solution steps -->
    <div class="error-steps">
      {#each steps as step, index}
        <div class="step">
          <div class="step-number">{index + 1}</div>
          <p>{step}</p>
        </div>
      {/each}
    </div>

    <!-- Dismiss button -->
    <button
      type="button"
      class="dismiss-btn"
      on:click|stopPropagation={closeModal}
    >
      Got it
    </button>
  </div>
</div>

<style>
  .permission-error-container {
    max-width: 30rem;
    margin: 0 auto 1rem;
  }

  .permission-error-modal {
    display: grid;
    gap: 0.75rem;
    width: 100%;
    padding: 1rem;
    border: 2px solid #1e1714;
    border-radius: 18px;
    background: #fbf1e4;
    color: #1e1714;
    box-shadow: 3px 3px 0 #1e1714;
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 900;
    line-height: 1.2;
  }

  .error-icon {
    display: grid;
    width: 32px;
    height: 32px;
    flex: 0 0 32px;
    place-items: center;
    border-radius: 10px;
    background: color-mix(in srgb, var(--zl-cta-color, #ffcc33) 35%, #fbf1e4);
  }

  #permission_error_description {
    margin: 0;
    font-size: 0.84rem;
    line-height: 1.4;
  }

  .error-steps {
    display: grid;
    gap: 0.5rem;
  }

  .step {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
  }

  .step-number {
    display: grid;
    width: 24px;
    height: 24px;
    flex: 0 0 24px;
    place-items: center;
    border: 1.5px solid #1e1714;
    border-radius: 50%;
    background: #ffcc33;
    font-size: 0.74rem;
    font-weight: 900;
  }

  .step p {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.35;
  }

  .dismiss-btn {
    justify-self: end;
    min-height: 44px;
    padding: 0.35rem 1rem;
    border: 2px solid #1e1714;
    border-radius: 12px;
    background: var(--zl-cta-color, #ffcc33);
    color: #1e1714;
    font-weight: 900;
    box-shadow: 2px 2px 0 #1e1714;
  }

  .dismiss-btn:active {
    transform: translate(1px, 1px);
    box-shadow: 1px 1px 0 #1e1714;
  }
</style>
