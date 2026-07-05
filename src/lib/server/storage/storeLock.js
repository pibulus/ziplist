// ===================================================================
// Store mutation lock
// ===================================================================
// The JSON stores do full-file read → mutate → write. Node serves requests
// concurrently, so two webhook deliveries (or a webhook racing the success
// page poll) can interleave those cycles and clobber each other's writes —
// dropping a paid checkout or a freshly issued license. Queueing mutations
// per store key makes each cycle run to completion before the next starts.

const tails = new Map();

/**
 * Run fn after all previously queued operations for the same key finish.
 * @param {string} key - Store key to serialize on
 * @param {() => Promise<any>} fn - Mutation to run exclusively
 * @returns {Promise<any>} Resolves/rejects with fn's result
 */
export function withStoreLock(key, fn) {
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.then(() => fn());
  tails.set(
    key,
    run.catch(() => {}),
  );
  return run;
}
