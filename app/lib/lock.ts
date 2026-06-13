/**
 * Tiny per-key async mutex. Serializes read-modify-write sequences that would otherwise race
 * on the shared JSON stores (handle uniqueness, wallet create, children updates) within a
 * single server process. Not cross-process — production would use a DB with real constraints.
 */
import "server-only";

const chains = new Map<string, Promise<unknown>>();

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  // Run fn after the previous holder settles (success OR failure).
  const next = prev.then(fn, fn);
  // Keep the chain alive but swallow errors so one failure doesn't poison the queue.
  chains.set(
    key,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}
