/**
 * Provision the calling user's Ignis. POST (idempotent) with the Dynamic auth token to create
 * their server wallet, then it returns the address + balances so they know where to send
 * faucet ETH and Circle USDC.
 *   curl -X POST localhost:3000/api/daemon/init -H "Authorization: Bearer <token>"
 */
import { erc20Abi, formatEther, formatUnits } from "viem";
import { ensureAgentWallet } from "@/app/lib/dynamic-server";
import { publicClient } from "@/app/lib/evm";
import { USDC, explorerAddress } from "@/app/lib/chain";
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

  const key = await resolveUserKey(userId);
  if (!key) {
    return Response.json({ error: "Pick a handle first", needsHandle: true }, { status: 409 });
  }

  try {
    const ignis = await ensureAgentWallet(key);
    const address = ignis.address as `0x${string}`;

    const [eth, usdc] = await Promise.all([
      publicClient.getBalance({ address }),
      publicClient.readContract({
        address: USDC.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      }),
    ]);

    return Response.json({
      identity: { ensName: ignis.ensName, address: ignis.address },
      balances: { eth: formatEther(eth), usdc: formatUnits(usdc, USDC.decimals) },
      explorer: explorerAddress(ignis.address),
      fundHint: "Send Sepolia ETH + Circle test USDC to the address above before sending.",
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
