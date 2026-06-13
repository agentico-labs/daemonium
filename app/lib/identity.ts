/**
 * Per-user agent naming. Each user gets their OWN Ignis, so we can't all share
 * `ignis.daemonium.eth`. We derive a stable, collision-resistant ENS name from the user's
 * Dynamic id and use that ENS name AS the agent's key everywhere (store key, signer key,
 * identity). Sub-agents nest under it: `research.ignis-<id>.daemonium.eth`.
 */
import { keccak256, toBytes } from "viem";
import { ENS_PARENT_NAME } from "./chain";

/** 8 hex chars derived from the Dynamic userId — deterministic and ENS-label-safe. */
export function shortId(userId: string): string {
  return keccak256(toBytes(userId)).slice(2, 10);
}

/** The user's root dæmon name, e.g. "ignis-a1b2c3d4.daemonium.eth". */
export function rootEnsName(userId: string): string {
  return `ignis-${shortId(userId)}.${ENS_PARENT_NAME}`;
}

/** A sub-agent's nested name under a parent, e.g. "research.ignis-….daemonium.eth". */
export function childEnsName(parentEnsName: string, label: string): string {
  return `${label}.${parentEnsName}`;
}

/** The leftmost ENS label of a name — what setSubnodeRecord needs. */
export function leftLabel(ensName: string): string {
  return ensName.split(".")[0];
}
