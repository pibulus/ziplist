<script>
  import { deviceSyncStore } from "$lib/services/realtime/deviceSyncStore.js";

  // What to say when this is the only one open. The Passport modal says
  // nothing (its heading already says to scan the card).
  export let aloneLabel = "";

  $: peerTotal = Math.max(
    $deviceSyncStore.peerCount || 0,
    $deviceSyncStore.peers || 0,
  );
  $: others = Math.max(0, peerTotal - 1);
  $: connected = $deviceSyncStore.status === "connected";
  $: label = connected
    ? others > 0
      ? `Live in ${others + 1} places right now`
      : aloneLabel
    : ["connecting", "disconnected"].includes($deviceSyncStore.status)
      ? "Linking up…"
      : ["error", "unavailable", "mismatch"].includes($deviceSyncStore.status)
        ? "Sync is having a nap. Lists are safe here."
        : "";
</script>

{#if label}
  <p class="sync-presence" role="status">
    <span class:connected={connected && others > 0} aria-hidden="true"></span>
    {label}
  </p>
{/if}

<style>
  .sync-presence {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    font-size: 11px;
    font-weight: 600;
    color: #525252;
  }
  span {
    width: 7px;
    height: 7px;
    flex-shrink: 0;
    border: 1px solid currentColor;
    border-radius: 50%;
  }
  span.connected {
    border-color: #047857;
    background: #047857;
  }
</style>
