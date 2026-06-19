/**
 * Completion of a CO-SIGN action. The proposal was already consumed (single-use) at /execute when
 * the cosign calls were issued, and the client has co-signed + broadcast the UserOp itself — so the
 * on-chain effect already happened. This endpoint just records the client-reported outcome for
 * UI/telemetry; it grants nothing on-chain, so it only needs auth.
 */
import { verifyUser, AuthError } from "@/app/lib/auth";
import type { ExecuteResponse } from "@/app/lib/types";
import { withRoute } from "@/app/lib/observe";

export const runtime = "nodejs";
export const maxDuration = 30;

interface CompleteRequest {
  executionId: string;
  hash?: string;
  ok?: boolean;
  error?: string;
  chainId?: number;
}

export const POST = withRoute("execute-complete", postHandler);

async function postHandler(req: Request) {
  try {
    await verifyUser(req);
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "Unauthorized" }, { status });
  }

  const body = (await req.json().catch(() => null)) as CompleteRequest | null;
  if (!body?.executionId) {
    return Response.json({ ok: false, error: "executionId required" }, { status: 400 });
  }

  // The proposal was already CONSUMED at /execute (the cosign branch claims it single-use before
  // returning calls), so there's nothing to look up or consume here — this endpoint just records
  // the client-reported outcome for UI/telemetry. It grants nothing on-chain (the client already
  // co-signed + broadcast), so it only needs auth, not an ownership re-check against the store.
  const res: ExecuteResponse = {
    ok: body.ok ?? Boolean(body.hash),
    hash: body.hash,
    error: body.error,
    chainId: body.chainId,
  };
  return Response.json(res, { status: res.ok ? 200 : 500 });
}
