/**
 * Pending-execution store. Agent tools mint a ProposalCard here; the confirm tap hands back
 * only the executionId, and /api/daemon/execute looks the validated payload up by id. Nothing
 * state-changing is ever driven by client-supplied amounts/addresses — only by what was
 * stashed here. Each execution is bound to the userId that created it, so one user cannot
 * execute another user's proposal even with a leaked id.
 *
 * In-memory (single server process) — fine for the hackathon. A restart clears pending
 * proposals, which is the safe direction (you just re-ask).
 */
import "server-only";
import { randomUUID } from "node:crypto";
import type { ProposalCard, ProposalDetails, DaemonAction } from "./types";

interface Entry {
  card: ProposalCard;
  userId: string;
}

const pending = new Map<string, Entry>();

export function createExecution(
  input: {
    action: DaemonAction;
    agent: string;
    summary: string;
    details: ProposalDetails;
  },
  userId: string,
): ProposalCard {
  const executionId = randomUUID();
  const card: ProposalCard = { executionId, ...input };
  pending.set(executionId, { card, userId });
  return card;
}

/** Fetch and remove a pending execution (single-use). */
export function takeExecution(executionId: string): Entry | undefined {
  const entry = pending.get(executionId);
  if (entry) pending.delete(executionId);
  return entry;
}
