<script>
  import { deviceSyncStore } from "$lib/services/realtime/deviceSyncStore.js";

  export let aloneLabel = "";

  $: others = Math.max(0, ($deviceSyncStore.peers || 0) - 1);
  $: connected = $deviceSyncStore.status === "connected";
  $: label = connected
    ? others > 0
      ? `Live in ${others + 1} places right now`
      : aloneLabel
    : ["connecting", "disconnected"].includes($deviceSyncStore.status)
      ? "Linking up…"
      : $deviceSyncStore.status === "mismatch"
        ? "Passkey mismatch — re-link with the 4-word key"
        : ["error", "unavailable"].includes($deviceSyncStore.status)
          ? "Sync resting — lists stay safe on this device"
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
    margin: 0;
    font-size: 11.5px;
    font-weight: 700;
    color: #44403c;
  }

  span {
    width: 7px;
    height: 7px;
    flex-shrink: 0;
    border: 1.5px solid currentColor;
    border-radius: 50%;
  }

  span.connected {
    border-color: #047857;
    background: #047857;
  }
</style>
