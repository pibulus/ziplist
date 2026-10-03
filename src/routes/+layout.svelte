<script>
  import "../app.css";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import Toast from "$lib/components/Toast.svelte";
  import PwaInstallCard from "$lib/components/PwaInstallCard.svelte";
  import { deviceSyncStore } from "$lib/services/realtime/deviceSyncStore.js";
  import { firstVisitService } from "$lib/services/first-visit/firstVisitService.js";

  let { children } = $props();

  if (browser) {
    onMount(async () => {
      const handled = deviceSyncStore.handleIncomingUrl();
      if (handled) {
        // A paired device already knows ZipList from the other one. Child
        // onMounts run first, so the intro's timer is already pending here.
        firstVisitService.cancelPendingIntroModal();
        firstVisitService.markIntroAsSeen();
        window.dispatchEvent(
          new CustomEvent("ziplist:toast", {
            detail: {
              type: "success",
              message: "Devices linked",
            },
          }),
        );
      } else {
        // No-op unless this device was paired before.
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
