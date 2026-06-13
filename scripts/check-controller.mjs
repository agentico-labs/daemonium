import { createPublicClient, http, parseAbi, getAbiItem } from "viem";
import { sepolia } from "viem/chains";

const RPC = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const BASE_REGISTRAR = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";

const pc = createPublicClient({ chain: sepolia, transport: http(RPC) });
const abi = parseAbi([
  "function controllers(address) view returns (bool)",
  "event ControllerAdded(address indexed controller)",
]);

const latest = await pc.getBlockNumber();
const span = 1_400_000n; // ~recent history
const chunk = 50_000n;
const start = latest > span ? latest - span : 0n;
console.log(`Scanning ControllerAdded from ${start} to ${latest} (chunks of ${chunk})…`);

const found = new Set();
for (let from = start; from <= latest; from += chunk) {
  const to = from + chunk - 1n > latest ? latest : from + chunk - 1n;
  try {
    const logs = await pc.getLogs({
      address: BASE_REGISTRAR,
      event: getAbiItem({ abi, name: "ControllerAdded" }),
      fromBlock: from,
      toBlock: to,
    });
    for (const l of logs) found.add(l.args.controller);
  } catch {
    /* skip a bad chunk */
  }
}

console.log(`\nControllerAdded addresses found in range: ${found.size}`);
for (const c of found) {
  const active = await pc.readContract({ address: BASE_REGISTRAR, abi, functionName: "controllers", args: [c] });
  console.log(`  ${c}  active=${active}`);
}
if (found.size === 0) {
  console.log("  (none in recent range — the active controller was likely added earlier)");
}
