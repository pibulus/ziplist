<script>
  import "../app.css";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import Toast from "$lib/components/Toast.svelte";
  import PwaInstallCard from "$lib/components/PwaInstallCard.svelte";
  import {
    normalizeSyncPhrase,
    isValidSyncPhrase,
    deriveRoomIdFromPhrase,
  } from "$lib/services/realtime/syncPhrase.js";

  let { children } = $props();

  if (browser) {
    onMount(async () => {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, ""),
      );
      const rawSync = params.get("sync") || hashParams.get("sync");

      if (rawSync) {
        const syncPhrase = normalizeSyncPhrase(rawSync);
        if (isValidSyncPhrase(syncPhrase)) {
          params.delete("sync");
          hashParams.delete("sync");
          const newQuery = params.toString();
          const newHash = hashParams.toString();
          const newUrl =
            window.location.pathname +
            (newQuery ? `?${newQuery}` : "") +
            (newHash ? `#${newHash}` : "");
          window.history.replaceState({}, "", newUrl);

          window.dispatchEvent(
            new CustomEvent("ziplist:toast", {
              detail: {
                type: "success",
                message: `Linked device sync: ${syncPhrase} ⚡`,
              },
            }),
          );

          const roomId = await deriveRoomIdFromPhrase(syncPhrase);
          if (roomId && !window.location.pathname.startsWith("/live/")) {
            await goto(`/live/${roomId}`);
          }
        }
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
