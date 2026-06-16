/**
 * Pending-execution store. Agent tools mint a ProposalCard here; the confirm tap hands back
 * only the executionId, and /api/daemon/execute looks the validated payload up by id. Nothing
 * state-changing is ever driven by client-supplied amounts/addresses — only by what was
 * stashed here. Each execution is bound to the userId that created it, so one user cannot
 * execute another user's proposal even with a leaked id.
 *
 * Storage must be visible ACROSS serverless instances: the /api/agent invocation that creates a
 * proposal and the /api/daemon/execute invocation that confirms it are different lambdas in a
 * deployment. So when Redis is configured we store proposals there (with a TTL); otherwise — a
 * single local dev process — we keep them in memory (a restart clears pending, the safe direction).
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { kvBackend, kvSetEx, kvGetStr, kvGetDel } from "./kv";
import type { ProposalCard, ProposalDetails, DaemonAction } from "./types";

interface Entry {
  card: ProposalCard;
  userId: string;
}

/** Pending proposals expire after an hour — abandoned confirms clean themselves up. */
const TTL_SECONDS = 3600;
const keyOf = (executionId: string) => `exec:${executionId}`;
const useRedis = kvBackend() === "redis";

// Local single-process fallback (dev only).
const pending = new Map<string, Entry>();

export async function createExecution(
  input: {
    action: DaemonAction;
    agent: string;
    summary: string;
    details: ProposalDetails;
  },
  userId: string,
): Promise<ProposalCard> {
  const executionId = randomUUID();
  const card: ProposalCard = { executionId, ...input };
  const entry: Entry = { card, userId };
  if (useRedis) await kvSetEx(keyOf(executionId), entry, TTL_SECONDS);
  else pending.set(executionId, entry);
  return card;
}

/** Look up a pending execution WITHOUT consuming it, so an unauthorized or losing-race tap can't
 *  burn a valid proposal before the caller has been checked. */
export async function peekExecution(executionId: string): Promise<Entry | undefined> {
  if (useRedis) return kvGetStr<Entry>(keyOf(executionId));
  return pending.get(executionId);
}

/** Atomic single-use: remove the proposal and report whether THIS caller won the removal. Call
 *  after the owner check; only execute when it returns true, so a double-tap can't double-execute. */
export async function consumeExecution(executionId: string): Promise<boolean> {
  if (useRedis) return (await kvGetDel<Entry>(keyOf(executionId))) !== undefined;
  return pending.delete(executionId);
}
