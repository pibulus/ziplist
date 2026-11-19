// ===================================================================
// Store mutation lock + cross-isolate Compare-And-Set (CAS)
// ===================================================================
// In-process queueing serializes concurrent async mutations inside one Node
// process, while snapshot() + compareAndSet() (ETag onlyIfMatch on Netlify
// Blobs) prevents concurrent serverless Lambda isolates from silently
// clobbering each other's paid checkouts or newly issued licenses.

const tails = new Map();

export function withStoreLock(key, fn) {
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.then(() => fn());
  tails.set(
    key,
    run.catch(() => {}),
  );
  return run;
}

/**
 * Atomically snapshot -> mutate -> compareAndSet with bounded retries.
 * `mutator(currentData)` returns `{ nextData, result, skipWrite }`.
 */
export function mutateWithCas(storage, key, mutator, maxAttempts = 6) {
  return withStoreLock(key, async () => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { data, version } = await storage.snapshot(key);
      const outcome = await mutator(data);
      if (outcome?.skipWrite) {
        return outcome.result;
      }
      const committed = await storage.compareAndSet(
        key,
        version,
        outcome.nextData,
      );
      if (committed) {
        return outcome.result;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, 15 * (attempt + 1) + Math.random() * 20),
      );
    }
    throw new Error(`Concurrent store conflict on ${key} after retries`);
  });
}
