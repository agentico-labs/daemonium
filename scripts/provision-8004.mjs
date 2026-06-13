/**
 * Verify + run the decoupled provisioning for an existing dæmon: seed gas from the minter,
 * then register its ERC-8004 identity (no ENS needed). Proves the new provisionIdentity path
 * works on Sepolia and fixes the half-provisioned account in the store.
 *   node --env-file=.env.local scripts/provision-8004.mjs ignis.thelucazip1.daemonium.eth
 */
import { DynamicEvmWalletClient } from "@dynamic-labs-wallet/node-evm";
import { createPublicClient, http, parseAbi, parseEventLogs, parseEther, formatEther } from "viem";
import { sepolia } from "viem/chains";
import { promises as fs } from "node:fs";
import path from "node:path";

const RPC = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const REG = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const ZERO = "0x0000000000000000000000000000000000000000";
const STORE = path.join(process.cwd(), ".daemon", "wallets.json");
const daemonKey = process.argv[2] ?? "ignis.thelucazip1.daemonium.eth";

const pc = createPublicClient({ chain: sepolia, transport: http(RPC) });
const env = (n) => { if (!process.env[n]) throw new Error(`Missing env ${n}`); return process.env[n]; };
const store = JSON.parse(await fs.readFile(STORE, "utf8"));
const minter = store.minter;
const daemon = store[daemonKey];
if (!daemon) throw new Error(`No wallet "${daemonKey}" in store`);

const client = new DynamicEvmWalletClient({ environmentId: env("DYNAMIC_ENVIRONMENT_ID") });
await client.authenticateApiToken(env("DYNAMIC_API_TOKEN"));
const signerFor = (w) => client.getWalletClient({
  walletMetadata: w.walletMetadata,
  externalServerKeyShares: w.externalServerKeyShares,
  password: env("DAEMON_WALLET_PASSWORD"),
  chain: sepolia, chainId: 11155111, rpcUrl: RPC,
});

const abi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function balanceOf(address) view returns (uint256)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);

const daemonAddr = daemon.address;
console.log(`Dæmon ${daemonKey}\n  address: ${daemonAddr}`);

// 1. seed gas
const bal = await pc.getBalance({ address: daemonAddr });
console.log(`  ETH balance: ${formatEther(bal)}`);
if (bal < parseEther("0.005")) {
  const m = await signerFor(minter);
  const h = await m.sendTransaction({ to: daemonAddr, value: parseEther("0.02"), account: m.account, chain: sepolia });
  await pc.waitForTransactionReceipt({ hash: h });
  console.log(`  ✓ seeded 0.02 ETH from minter: ${h}`);
}

// 2. register 8004 (skip if already owns one)
const owned = await pc.readContract({ address: REG, abi, functionName: "balanceOf", args: [daemonAddr] });
if (owned > 0n) {
  console.log(`  already owns an ERC-8004 identity (balance ${owned}). Skipping register.`);
  process.exit(0);
}
const uri = `http://localhost:3000/api/agent-card/${daemonKey}`;
const d = await signerFor(daemon);
console.log(`→ registering ERC-8004 (agentURI ${uri})…`);
const hash = await d.writeContract({ address: REG, abi, functionName: "register", args: [uri], account: d.account, chain: sepolia });
const receipt = await pc.waitForTransactionReceipt({ hash });

let agentId;
const reg = parseEventLogs({ abi, logs: receipt.logs, eventName: "Registered" });
agentId = reg[0]?.args.agentId;
if (agentId === undefined) {
  const mints = parseEventLogs({ abi, logs: receipt.logs, eventName: "Transfer" }).filter((l) => l.args.from === ZERO);
  agentId = mints[0]?.args.tokenId;
}
console.log(`  ✓ registered. tx: ${hash}`);
console.log(`  agentId: ${agentId}`);

// 3. persist into the store so the app sees it as complete
store[daemonKey].agentId = agentId?.toString();
store[daemonKey].agentCardUri = uri;
await fs.writeFile(STORE, JSON.stringify(store, null, 2));
console.log(`\n🔥 ${daemonKey} is funded + has an ERC-8004 identity (agentId ${agentId}).`);
console.log(`   View: https://sepolia.etherscan.io/tx/${hash}`);
