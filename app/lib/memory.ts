/**
 * Per-user memory — SCAFFOLD.
 *
 * A running, append-only log of things worth remembering, plus a dumb `recall`. Built on `kv.ts`
 * exactly like `wallet-store.ts` (Redis when REDIS_URL is set, else the gitignored `.daemon` file),
 * so it deploys with no extra infra.
 *
 * Intentionally simple — the point is the INTERFACE, not the insides:
 *   • storage is one JSON array per user (fine for hundreds of items, not millions)
 *   • `recall` is recency + case-insensitive substring match (a placeholder for embeddings)
 * Later we swap the insides for a real store with semantic search; `remember`/`recall` callers
 * don't change. Not for secrets (see `secrets.ts`). Not yet wired into the agent loop — that's Phase 1.
 */
import "server-only";
import { kvGet, kvUpdate } from "./kv";

const NS = "memory";

// Scaffold bounds so the single-array store can't grow without limit: keep only the most recent
// MAX_ITEMS memories, and cap each one to MAX_TEXT chars (a memory is a sentence, not a document).
const MAX_ITEMS = 200;
const MAX_TEXT = 500;

/** One remembered thing. Keep it small and human-readable. */
export interface MemoryItem {
  /** ISO timestamp when it was remembered. */
  at: string;
  /** Loose category, e.g. "fact", "event", "preference", "interaction". */
  kind: string;
  /** The memory itself, in plain text. */
  text: string;
}

/**
 * Append a memory for a user via the shared locked read-modify-write (`kvUpdate`), so concurrent
 * appends can't clobber each other. Process-local; a multi-instance deploy would want a server-side
 * atomic list push, which the real store will provide.
 */
export async function remember(userId: string, item: { kind: string; text: string }): Promise<void> {
  await kvUpdate<MemoryItem[]>(NS, userId, (current) => {
    const log = current ?? [];
    log.push({ at: new Date().toISOString(), kind: item.kind, text: item.text.slice(0, MAX_TEXT) });
    // Keep only the most recent MAX_ITEMS so the stored blob — and every future recall — stay bounded.
    return log.length > MAX_ITEMS ? log.slice(-MAX_ITEMS) : log;
  });
}

/**
 * Recall a user's memories, most-recent first.
 *   • no query  → the latest `limit` items
 *   • a query   → the latest `limit` items whose text loosely matches (substring, case-insensitive)
 * The substring match is the placeholder that real semantic search replaces behind this same signature.
 */
export async function recall(
  userId: string,
  opts: { query?: string; limit?: number } = {},
): Promise<MemoryItem[]> {
  const { query, limit = 10 } = opts;
  if (limit <= 0) return []; // guard: slice(-0) would otherwise return the WHOLE array
  const log = (await kvGet<MemoryItem[]>(NS, userId)) ?? [];
  const matched = query
    ? log.filter((m) => m.text.toLowerCase().includes(query.toLowerCase()))
    : log;
  return matched.slice(-limit).reverse();
}
