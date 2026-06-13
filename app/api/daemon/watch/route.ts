/**
 * Proactive watch — the backend side of "Ignis notices an incoming transfer and speaks up".
 * Scoped to the calling user's Ignis (or one of their sub-agents via ?subagent=). The client
 * polls with the last block it saw; when `transfers` is non-empty it can flip the flame and
 * send Ignis a synthetic prompt to react. Stateless: the client owns the cursor.
 *   GET /api/daemon/watch?since=<block>&subagent=research  (Authorization: Bearer <token>)
 */
import { getIncomingUsdc } from "@/app/lib/evm";
import { getWallet } from "@/app/lib/wallet-store";
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

  const url = new URL(req.url);
  const subagent = url.searchParams.get("subagent");
  const sinceParam = url.searchParams.get("since");
  const selfKey = rootEnsName(userId);
  const key = subagent ? `${subagent}.${selfKey}` : selfKey;

  const wallet = await getWallet(key);
  if (!wallet) return Response.json({ error: `No agent "${key}"` }, { status: 404 });

  const since = sinceParam ? BigInt(sinceParam) : undefined;
  const { latestBlock, transfers } = await getIncomingUsdc(
    wallet.address as `0x${string}`,
    since,
  );

  return Response.json({
    agent: key,
    address: wallet.address,
    latestBlock: latestBlock.toString(),
    transfers,
  });
}
