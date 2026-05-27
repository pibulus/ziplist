<script>
  import { browser } from "$app/environment";
  import { createEventDispatcher } from "svelte";
  import { pwaService } from "$lib/services/pwa";

  // Event handling
  const dispatch = createEventDispatcher();

  let title = "Microphone Access Denied";
  let description =
    "ZipList needs microphone access to transcribe your speech. Please update your browser settings to allow microphone access.";
  let steps = [
    "Click the microphone or lock icon in your address bar",
    'Select "Allow" for microphone access',
    "Refresh the page and try again",
  ];

  if (browser) {
    const platform = pwaService.getPlatformInfo();

    if (platform.isIOS) {
      title = "Microphone Is Blocked";
      description =
        "ZipList needs microphone access for voice lists. iPhone permissions are managed outside the app when access is blocked.";
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
      title = "Microphone Is Blocked";
      description =
        "ZipList needs microphone access for voice lists. Update this site's microphone permission and try again.";
      steps = [
        "Open site settings from your browser menu",
        'Set Microphone to "Allow"',
        "Refresh ZipList and try again",
      ];
    }
  }

  // Close the modal when clicked
  function closeModal() {
    dispatch("close");
  }
</script>

<div
  class="flex justify-center w-full permission-error-container"
  on:click={closeModal}
  on:keydown={(e) => (e.key === "Enter" || e.key === " ") && closeModal()}
  role="alertdialog"
  tabindex="0"
  aria-labelledby="permission_error_title"
  aria-describedby="permission_error_description"
  aria-live="assertive"
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
          class="w-6 h-6"
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
