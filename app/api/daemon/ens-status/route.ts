/**
 * Read-only check of the ENS bootstrap prerequisite, scoped to the calling user's Ignis.
 * Tells you whether their wallet can mint its subname under the parent, and if not, what to do.
 *   curl localhost:3000/api/daemon/ens-status -H "Authorization: Bearer <token>"
 */
import { ENS } from "@/app/lib/chain";
import { canManageParent, parentOf } from "@/app/lib/ens";
import { ensureAgentWallet } from "@/app/lib/dynamic-server";
import { verifyUser, AuthError } from "@/app/lib/auth";
import { rootEnsName } from "@/app/lib/identity";

export const runtime = "nodejs";

export async function GET(req: Request) {
  let userId: string;
  try {
    ({ userId } = await verifyUser(req));
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return Response.json({ error: err instanceof Error ? err.message : "Unauthorized" }, { status });
  }

  const ignis = await ensureAgentWallet(rootEnsName(userId));
  const operator = ignis.address as `0x${string}`;
  const parent = parentOf(ignis.ensName!);

  let canManage = false;
  let note: string | undefined;
  try {
    canManage = await canManageParent(parent, operator);
  } catch (err) {
    note =
      `Could not read owner of ${parent} — is it wrapped in the NameWrapper? ` +
      (err instanceof Error ? err.message : String(err));
  }

  return Response.json({
    ensName: ignis.ensName,
    parent,
    ignisAddress: operator,
    canManage,
    note,
    howToAuthorize: canManage
      ? "Ready — Ignis can mint its subname under the parent."
      : `From the wallet that owns ${parent}, call setApprovalForAll(${operator}, true) on the NameWrapper at ${ENS.nameWrapper} (Sepolia). The parent must be wrapped.`,
  });
}
