<script>
  import "../app.css";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import Toast from "$lib/components/Toast.svelte";
  import PwaInstallCard from "$lib/components/PwaInstallCard.svelte";
  import { deviceSyncStore } from "$lib/services/realtime/deviceSyncStore.js";

  let { children } = $props();

  if (browser) {
    onMount(async () => {
      const handled = deviceSyncStore.handleIncomingUrl();
      if (handled) {
        window.dispatchEvent(
          new CustomEvent("ziplist:toast", {
            detail: {
              type: "success",
              message: "Linked with your other device! ⚡",
            },
          }),
        );
      } else {
        // Connect to sync room if credentials already exist
        deviceSyncStore.connect();
      }
    });
  }
</script>

{@render children()}

<Toast />

<PwaInstallCard
  appName="ZipList"
  tagline="Talk it into a list. Tick it off."
  iconSrc="/icons/icon-192x192.png"
  storagePrefix="ziplist"
/>
