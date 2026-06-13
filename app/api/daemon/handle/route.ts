/**
 * Per-user handle: GET to check if the caller has one yet (the frontend shows the picker
 * modal if not), POST to claim one. Claiming a handle AUTO-PROVISIONS the user's dæmon
 * identity (mints ignis.<handle>.daemonium.eth + ERC-8004 + text record via the minter) —
 * no separate "claim" step. This is the slow call (several Sepolia txs); the modal shows a
 * loading state.
 */
import { verifyUser, AuthError } from "@/app/lib/auth";
import { getHandle, claimHandle, ensNameForHandle } from "@/app/lib/handles";
import { provisionIdentity } from "@/app/lib/provision";

export const runtime = "nodejs";
export const maxDuration = 120;

async function user(req: Request) {
  return verifyUser(req);
}
function authFail(err: unknown) {
  const status = err instanceof AuthError ? err.status : 401;
  return Response.json({ error: err instanceof Error ? err.message : "Unauthorized" }, { status });
}

export async function GET(req: Request) {
  let userId: string;
  try {
    ({ userId } = await user(req));
  } catch (err) {
    return authFail(err);
  }
  const handle = await getHandle(userId);
  return Response.json({
    handle: handle ?? null,
    ensName: handle ? ensNameForHandle(handle) : null,
  });
}

export async function POST(req: Request) {
  let userId: string;
  try {
    ({ userId } = await user(req));
  } catch (err) {
    return authFail(err);
  }

  const body = await req.json().catch(() => null);
  const raw = body?.handle;
  if (typeof raw !== "string") {
    return Response.json({ error: "handle (string) required" }, { status: 400 });
  }

  const claimed = await claimHandle(userId, raw);
  if (!claimed.ok) {
    // invalid format → 400 (client bug); reserved/taken → 409 (conflict).
    const status = claimed.code === "invalid" ? 400 : 409;
    return Response.json({ error: claimed.error, code: claimed.code }, { status });
  }

  try {
    const result = await provisionIdentity(claimed.handle);
    return Response.json({ handle: claimed.handle, ...result });
  } catch (err) {
    // Handle is reserved for the user even if provisioning hiccups; they can retry.
    return Response.json(
      { handle: claimed.handle, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
