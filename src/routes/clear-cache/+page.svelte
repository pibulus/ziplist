<script>
  import { onDestroy } from "svelte";

  let status = "Ready for a fresh local cache.";
  let cleared = false;
  let reloadTimeout;

  const commonDatabaseNames = [
    "transformers-cache",
    "transformers-models",
    "transformersjs",
    "model-cache",
    "onnx-models",
  ];

  async function clearIndexedDb() {
    if (typeof indexedDB === "undefined") return;

    const databases = (await indexedDB.databases?.()) || [];
    const discoveredNames = databases
      .map((database) => database.name)
      .filter(Boolean);
    const names = new Set([...discoveredNames, ...commonDatabaseNames]);

    await Promise.all(
      [...names].map(
        (name) =>
          new Promise((resolve) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = resolve;
            request.onerror = resolve;
            request.onblocked = resolve;
          }),
      ),
    );
  }

  async function clearCacheStorage() {
    if (!("caches" in window)) return 0;

    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    return cacheNames.length;
  }

  async function clearAllCaches() {
    status = "Clearing local caches...";
    cleared = false;

    try {
      await clearIndexedDb();
      const cacheCount = await clearCacheStorage();

      localStorage.clear();
      sessionStorage.clear();

      status = `Local cache refreshed. Removed ${cacheCount} browser cache ${
        cacheCount === 1 ? "entry" : "entries"
      }.`;
      cleared = true;

      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
      }

      reloadTimeout = setTimeout(() => {
        status = "Reloading ZipList...";
        window.location.assign("/");
      }, 1800);
    } catch (error) {
      status = `Cache refresh needs one more try: ${error?.message || "unknown error"}`;
    }
  }

  onDestroy(() => {
    if (reloadTimeout) {
      clearTimeout(reloadTimeout);
    }
  });
</script>

<svelte:head>
  <title>Refresh Local Cache | ZipList</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="zl-cache-page">
  <section class="zl-cache-card" aria-live="polite">
    <div class="zl-cache-mark" aria-hidden="true">Zip</div>

    <div class="zl-cache-copy">
      <p>Device Cache</p>
      <h1>Refresh Local Cache</h1>
      <span>
        Clears cached offline models, service worker caches, and browser storage
        on this device.
      </span>
    </div>

    <button
      type="button"
      class="zl-cache-button"
      disabled={cleared}
      on:click={clearAllCaches}
    >
      {cleared ? "Cache refreshed" : "Refresh Local Cache"}
    </button>

    <p class="zl-cache-status">Status: {status}</p>

    <a href="/" class="zl-cache-return">Return to ZipList</a>
  </section>
</main>

<style>
  .zl-cache-page {
    align-items: center;
    background:
      radial-gradient(
        circle at 50% 18%,
        rgba(255, 204, 77, 0.24),
        transparent 34rem
      ),
      #fff6e6;
    color: #111827;
    display: flex;
    font-family: "Space Mono", monospace;
    justify-content: center;
    min-height: 100dvh;
    padding: 1.25rem;
  }

  .zl-cache-card {
    align-items: center;
    background: linear-gradient(145deg, #fffaf0, #ffefd5);
    border: 4px solid #000000;
    border-radius: 28px;
    box-shadow: 10px 10px 0 #000000;
    display: flex;
    flex-direction: column;
    gap: 1.15rem;
    max-width: 30rem;
    padding: 2rem;
    text-align: center;
    width: 100%;
  }

  .zl-cache-mark {
    align-items: center;
    background: linear-gradient(135deg, #ffd56a, #79e7d3);
    border: 3px solid #000000;
    border-radius: 18px;
    box-shadow: 4px 4px 0 #000000;
    display: inline-flex;
    font-weight: 900;
    min-height: 56px;
    padding: 0 1rem;
  }

  .zl-cache-copy p {
    color: #11776d;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0;
    margin: 0 0 0.45rem;
    text-transform: uppercase;
  }

  .zl-cache-copy h1 {
    font-size: clamp(2rem, 10vw, 2.7rem);
    font-weight: 900;
    letter-spacing: 0;
    line-height: 1;
    margin: 0;
  }

  .zl-cache-copy span,
  .zl-cache-status {
    color: #4b5563;
    display: block;
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0.75rem 0 0;
  }

  .zl-cache-button,
  .zl-cache-return {
    border: 3px solid #000000;
    border-radius: 16px;
    box-shadow: 4px 4px 0 #000000;
    color: #111827;
    font-weight: 900;
    min-height: 44px;
    padding: 0.75rem 1rem;
    text-decoration: none;
    transition:
      box-shadow 0.16s ease,
      transform 0.16s ease;
    width: 100%;
  }

  .zl-cache-button {
    background: linear-gradient(135deg, #ffcc33, #ff6ac2);
  }

  .zl-cache-return {
    background: rgba(255, 255, 255, 0.72);
  }

  .zl-cache-button:hover:not(:disabled),
  .zl-cache-return:hover {
    box-shadow: 6px 6px 0 #000000;
    transform: translate(-2px, -2px);
  }

  .zl-cache-button:disabled {
    cursor: default;
    opacity: 0.68;
  }

  .zl-cache-status {
    background: rgba(255, 255, 255, 0.72);
    border: 2px solid rgba(0, 0, 0, 0.12);
    border-radius: 16px;
    padding: 0.85rem;
    width: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .zl-cache-button,
    .zl-cache-return {
      transition: none;
    }

    .zl-cache-button:hover:not(:disabled),
    .zl-cache-return:hover {
      transform: none;
    }
  }
</style>
