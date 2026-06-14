/**
 * Live "spells" — the real, in-flight (and just-finished) sub-agent runs for a user's cluster.
 * A spell is born when Ignis delegates to a sub-agent (delegate_to_subagent) and dies when that
 * run returns. The Cluster screen reads this to show what each dæmon is doing right now, instead
 * of the old hardcoded mock feed.
 *
 * In-memory (single server process), like executions.ts — fine for the hackathon; a restart just
 * clears the board (the safe direction). Finished spells linger briefly so a short run still
 * shows up as "recent" rather than vanishing the instant it completes.
 */
import "server-only";
import { randomUUID } from "node:crypto";

export type SpellStatus = "running" | "done" | "failed";

export interface SpellEntry {
  id: string;
  userId: string;
  /** Acting sub-agent's leaf label, e.g. "research". */
  agent: string;
  /** What it's doing (the delegated task), trimmed for display. */
  title: string;
  startedAt: number;
  endedAt?: number;
  status: SpellStatus;
  /** The sub-agent's returned summary, once done. */
  summary?: string;
}

/** How long a finished spell stays on the board after it ends. */
const LINGER_MS = 90_000;

const spells = new Map<string, SpellEntry>();

function sweep(now: number) {
  for (const [id, s] of spells) {
    if (s.endedAt && now - s.endedAt > LINGER_MS) spells.delete(id);
  }
}

/** Begin a spell when a delegation starts. Returns its id; pass it to finishSpell when done. */
export function startSpell(userId: string, input: { agent: string; title: string }): string {
  const id = randomUUID();
  spells.set(id, {
    id,
    userId,
    agent: input.agent,
    title: input.title.trim().slice(0, 80),
    startedAt: Date.now(),
    status: "running",
  });
  return id;
}

/** End a spell — keeps it on the board (as done/failed) for a short linger window. */
export function finishSpell(id: string, outcome: { ok: boolean; summary?: string }): void {
  const s = spells.get(id);
  if (!s) return;
  s.status = outcome.ok ? "done" : "failed";
  s.summary = outcome.summary?.trim().slice(0, 160);
  s.endedAt = Date.now();
}

/** This user's spells — running first, then recently-finished, newest first. Sweeps stale ones. */
export function listSpells(userId: string): SpellEntry[] {
  const now = Date.now();
  sweep(now);
  return [...spells.values()]
    .filter((s) => s.userId === userId)
    .sort((a, b) => {
      if (a.status === "running" && b.status !== "running") return -1;
      if (b.status === "running" && a.status !== "running") return 1;
      return b.startedAt - a.startedAt;
    });
}
