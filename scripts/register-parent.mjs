/**
 * One-shot: the MINTER registers + wraps the ENS parent (daemonium.eth) on Sepolia, so all our
 * NameWrapper-based code works unchanged and the minter owns the wrapped parent (no approval
 * step needed downstream).
 *
 * Why: the current Sepolia ETHRegistrarController is the UnwrappedEthRegistrarController — it
 * registers names UNWRAPPED. Our system needs a WRAPPED parent, so after registering we wrap it
 * via NameWrapper.wrapETH2LD (which requires approving the NameWrapper on the BaseRegistrar).
 *
 * Idempotent: skips any step already done. Costs the minter a little Sepolia ETH.
 *   node --env-file=.env.local scripts/register-parent.mjs
 */
import { createPublicClient, http, parseAbi, formatEther, zeroHash } from "viem";
import { sepolia } from "viem/chains";
import { namehash, labelhash } from "viem/ens";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DynamicEvmWalletClient } from "@dynamic-labs-wallet/node-evm";

const RPC = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const CONTROLLER = "0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968";
const BASE_REGISTRAR = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";
const NAME_WRAPPER = "0x0635513f179D50A207757E05759CbD106d7dFcE8";
const PUBLIC_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";
const ZERO = "0x0000000000000000000000000000000000000000";

const parent = process.env.ENS_PARENT_NAME ?? "daemonium.eth";
const label = parent.split(".")[0]; // "daemonium"
const node = BigInt(namehash(parent));
const tokenId = BigInt(labelhash(label));

const controllerAbi = parseAbi([
  "struct Registration { string label; address owner; uint256 duration; bytes32 secret; address resolver; bytes[] data; uint8 reverseRecord; bytes32 referrer; }",
  "struct Price { uint256 base; uint256 premium; }",
  "function available(string label) view returns (bool)",
  "function rentPrice(string label, uint256 duration) view returns (Price)",
  "function makeCommitment(Registration registration) pure returns (bytes32)",
  "function commit(bytes32 commitment)",
  "function register(Registration registration) payable",
  "function minCommitmentAge() view returns (uint256)",
]);
const baseAbi = parseAbi([
  "function ownerOf(uint256 id) view returns (address)",
  "function setApprovalForAll(address operator, bool approved)",
]);
const nwAbi = parseAbi([
  "function ownerOf(uint256 id) view returns (address)",
  "function wrapETH2LD(string label, address wrappedOwner, uint16 ownerControlledFuses, address resolver) returns (uint64)",
]);

const pc = createPublicClient({ chain: sepolia, transport: http(RPC) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const env = (n) => {
  if (!process.env[n]) throw new Error(`Missing env ${n}`);
  return process.env[n];
};

// --- load the minter's MPC wallet + a viem signer for it ---
const store = JSON.parse(await fs.readFile(path.join(process.cwd(), ".daemon", "wallets.json"), "utf8"));
const minter = store.minter;
if (!minter) throw new Error("No minter in .daemon/wallets.json — run scripts/provision-minter.mjs first.");
const minterAddr = minter.address;
console.log(`Minter: ${minterAddr}  (${parent})`);

const dynamic = new DynamicEvmWalletClient({ environmentId: env("DYNAMIC_ENVIRONMENT_ID") });
await dynamic.authenticateApiToken(env("DYNAMIC_API_TOKEN"));
const wc = await dynamic.getWalletClient({
  walletMetadata: minter.walletMetadata,
  externalServerKeyShares: minter.externalServerKeyShares,
  password: env("DAEMON_WALLET_PASSWORD"),
  chain: sepolia,
  chainId: 11155111,
  rpcUrl: RPC,
});

const send = async (opts, note) => {
  console.log(`→ ${note}…`);
  const hash = await wc.writeContract({ account: wc.account, chain: sepolia, ...opts });
  await pc.waitForTransactionReceipt({ hash });
  console.log(`  ✓ ${hash}`);
  return hash;
};

// --- 1. Register (unwrapped) if not already owned by the minter ---
const nwOwner = await pc.readContract({ address: NAME_WRAPPER, abi: nwAbi, functionName: "ownerOf", args: [node] });
if (nwOwner.toLowerCase() === minterAddr.toLowerCase()) {
  console.log("Already wrapped + owned by the minter. Nothing to do. ✅");
  process.exit(0);
}

let baseOwner = ZERO;
try {
  baseOwner = await pc.readContract({ address: BASE_REGISTRAR, abi: baseAbi, functionName: "ownerOf", args: [tokenId] });
} catch {
  baseOwner = ZERO; // not registered → ownerOf reverts
}

if (baseOwner === ZERO) {
  const available = await pc.readContract({ address: CONTROLLER, abi: controllerAbi, functionName: "available", args: [label] });
  if (!available) throw new Error(`${parent} is not available and not owned by the minter — registered to someone else?`);

  const registration = {
    label,
    owner: minterAddr,
    duration: 31536000n, // 1 year
    secret: `0x${randomBytes(32).toString("hex")}`,
    // Register BARE — no resolver/records at registration (this controller empty-reverts when
    // setting records during register). wrapETH2LD below sets the PublicResolver instead.
    resolver: ZERO,
    data: [],
    reverseRecord: 0,
    referrer: zeroHash,
  };
  const price = await pc.readContract({ address: CONTROLLER, abi: controllerAbi, functionName: "rentPrice", args: [label, registration.duration] });
  const value = ((price.base + price.premium) * 103n) / 100n;
  console.log(`Price: ${formatEther(price.base + price.premium)} ETH (sending ${formatEther(value)} with buffer)`);

  const commitment = await pc.readContract({ address: CONTROLLER, abi: controllerAbi, functionName: "makeCommitment", args: [registration] });
  await send({ address: CONTROLLER, abi: controllerAbi, functionName: "commit", args: [commitment] }, "commit");

  const minAge = await pc.readContract({ address: CONTROLLER, abi: controllerAbi, functionName: "minCommitmentAge" });
  const waitS = Number(minAge) + 10;
  console.log(`  waiting ${waitS}s for the commitment to mature…`);
  await sleep(waitS * 1000);

  await send({ address: CONTROLLER, abi: controllerAbi, functionName: "register", args: [registration], value }, "register (payable)");
} else if (baseOwner.toLowerCase() === minterAddr.toLowerCase()) {
  console.log("Already registered (unwrapped) by the minter — proceeding to wrap.");
} else {
  throw new Error(`${parent} is registered to ${baseOwner}, not the minter. Use a different name or transfer it.`);
}

// --- 2. Approve the NameWrapper on the BaseRegistrar, then wrap ---
await send({ address: BASE_REGISTRAR, abi: baseAbi, functionName: "setApprovalForAll", args: [NAME_WRAPPER, true] }, "approve NameWrapper on BaseRegistrar");
await send({ address: NAME_WRAPPER, abi: nwAbi, functionName: "wrapETH2LD", args: [label, minterAddr, 0, PUBLIC_RESOLVER] }, "wrapETH2LD");

// --- 3. Verify ---
const finalOwner = await pc.readContract({ address: NAME_WRAPPER, abi: nwAbi, functionName: "ownerOf", args: [node] });
console.log(
  finalOwner.toLowerCase() === minterAddr.toLowerCase()
    ? `\n🔥 ${parent} is registered + wrapped + owned by the minter. Provisioning will now work.`
    : `\n⚠️ Unexpected: NameWrapper owner is ${finalOwner}, not the minter.`,
);
