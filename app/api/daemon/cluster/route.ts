/**
 * The live cluster feed for the calling user: their dæmon's sub-agents (from the wallet tree) and
 * the spells running across them right now (from the in-memory spell registry). The Cluster screen
 * polls this to render the real roster + "current spells", replacing the old hardcoded mock.
 *   GET /api/daemon/cluster  (Authorization: Bearer <token>)
 */
import { getWallet } from "@/app/lib/wallet-store";
import { listSpells } from "@/app/lib/spells";
import { verifyUser, AuthError } from "@/app/lib/auth";
import { resolveUserKey } from "@/app/lib/handles";
import { withRoute } from "@/app/lib/observe";
import type { ClusterResponse, ClusterDaemonDTO, SpellDTO } from "@/lib/cluster";

export const runtime = "nodejs";

export const GET = withRoute("cluster", getHandler);

async function getHandler(req: Request) {
  let userId: string;
  try {
    ({ userId } = await verifyUser(req));
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return Response.json({ error: err instanceof Error ? err.message : "Unauthorized" }, { status });
  }

  const selfKey = await resolveUserKey(userId);
  if (!selfKey) {
    return Response.json({ error: "Pick a handle first", needsHandle: true }, { status: 409 });
  }

  const root = await getWallet(selfKey);
  if (!root) return Response.json({ error: `No agent "${selfKey}"` }, { status: 404 });

  const rootLabel = root.label.split(".")[0];
  const now = Date.now();
  const spellEntries = listSpells(userId);

  // The running spell (if any) for a given sub-agent label, so its roster row shows what it's at.
  const runningFor = (sub: string) =>
    spellEntries.find((s) => s.agent === sub && s.status === "running");

  // Roster = the root's direct children, in order. Each child key is `<sub>.<selfKey>`.
  const daemons: ClusterDaemonDTO[] = [];
  for (const childKey of root.children) {
    const w = await getWallet(childKey);
    if (!w) continue;
    const sub = childKey.split(".")[0];
    const active = runningFor(sub);
    daemons.push({
      sub,
      ensName: w.ensName ?? childKey,
      address: w.address,
      status: active ? "working" : "idle",
      doingNow: active ? active.title : "no active task",
      elapsedSec: active ? Math.floor((now - active.startedAt) / 1000) : null,
    });
  }

  const spells: SpellDTO[] = spellEntries.map((s) => ({
    id: s.id,
    title: s.title,
    agent: s.agent,
    status: s.status,
    elapsedSec: Math.floor(((s.endedAt ?? now) - s.startedAt) / 1000),
    summary: s.summary,
  }));

  const body: ClusterResponse = { rootLabel, daemons, spells };
  return Response.json(body);
}
