/**
 * Generic ENS-name helpers. Per-user dæmon naming now lives in `handles.ts`
 * (`ignis.<handle>.daemonium.eth`), derived from the user's chosen handle rather than a hash.
 */

/** A sub-agent's nested name under a parent, e.g. "research.ignis.<handle>.daemonium.eth". */
export function childEnsName(parentEnsName: string, label: string): string {
  return `${label}.${parentEnsName}`;
}

/** The leftmost ENS label of a name — what setSubnodeRecord needs. */
export function leftLabel(ensName: string): string {
  return ensName.split(".")[0];
}
