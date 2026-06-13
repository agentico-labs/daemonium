/**
 * Debug/manual proposal entry — mints a pending send_usdc execution for the calling user's
 * Ignis and returns its card. The agent loop builds the same cards via createExecution; this
 * route lets you exercise the confirm→execute path directly.
 *   curl -X POST localhost:3000/api/daemon/propose -H "Authorization: Bearer <token>" \
 *     -H 'content-type: application/json' -d '{"to":"0x..","amount":"1"}'
 */
import { createExecution } from "@/app/lib/executions";
import { verifyUser, AuthError } from "@/app/lib/auth";
import { resolveUserKey } from "@/app/lib/handles";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let userId: string;
  try {
    ({ userId } = await verifyUser(req));
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return Response.json({ error: err instanceof Error ? err.message : "Unauthorized" }, { status });
  }

  const body = await req.json().catch(() => null);
  const { to, amount, toEns } = body ?? {};
  if (!to || !amount) {
    return Response.json({ error: "to and amount are required" }, { status: 400 });
  }

  const agent = await resolveUserKey(userId);
  if (!agent) {
    return Response.json({ error: "Pick a handle first", needsHandle: true }, { status: 409 });
  }

  const card = createExecution(
    {
      action: "send_usdc",
      agent,
      summary: `Send ${amount} USDC to ${toEns ?? to}`,
      details: { action: "send_usdc", to, amount: String(amount), toEns },
    },
    userId,
  );

  return Response.json(card);
}
