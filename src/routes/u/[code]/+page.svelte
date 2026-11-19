<script>
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { deviceSyncStore } from "$lib/services/realtime/deviceSyncStore.js";
  import { firstVisitService } from "$lib/services/first-visit/firstVisitService.js";

  onMount(async () => {
    if (!browser) return;
    const code = $page.params.code;
    if (code) {
      firstVisitService.cancelPendingIntroModal();
      firstVisitService.markIntroAsSeen();
      await deviceSyncStore.pairWithLink(code);
    }
    await goto("/", { replaceState: true });
  });
</script>

<svelte:head>
  <title>Unlocking Passport · ZipList</title>
  <meta name="robots" content="noindex, nofollow, noarchive" />
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-[#fffef7]">
  <p class="animate-pulse text-sm font-bold text-[#1e1714]">
    Linking Passport...
  </p>
</div>
