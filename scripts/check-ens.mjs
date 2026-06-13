/**
 * Prerequisite checker for the ENS parent. Run after registering + wrapping the parent and
 * approving the minter:  node --env-file=.env.local scripts/check-ens.mjs
 * Prints a PASS/FAIL checklist so you know provisioning will work before testing in-browser.
 */
import { createPublicClient, http, parseAbi, formatEther } from "viem";
import { sepolia } from "viem/chains";
import { namehash } from "viem/ens";
import { promises as fs } from "node:fs";
import path from "node:path";

const rpc = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const parent = process.env.ENS_PARENT_NAME ?? "daemonium.eth";
const NW = "0x0635513f179D50A207757E05759CbD106d7dFcE8";
const pc = createPublicClient({ chain: sepolia, transport: http(rpc) });
const abi = parseAbi([
  "function ownerOf(uint256 id) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
]);

const store = JSON.parse(await fs.readFile(path.join(process.cwd(), ".daemon", "wallets.json"), "utf8"));
const minter = store.minter?.address;
if (!minter) {
  console.error("No minter in .daemon/wallets.json — run scripts/provision-minter.mjs first.");
  process.exit(1);
}

const node = BigInt(namehash(parent));
const owner = await pc.readContract({ address: NW, abi, functionName: "ownerOf", args: [node] });
const wrapped = owner !== "0x0000000000000000000000000000000000000000";
const approved = wrapped
  ? await pc.readContract({ address: NW, abi, functionName: "isApprovedForAll", args: [owner, minter] })
  : false;
const minterEth = await pc.getBalance({ address: minter });
const minterIsOwner = owner.toLowerCase() === minter.toLowerCase();

const ok = (b) => (b ? "✅" : "❌");
console.log(`Parent:        ${parent}`);
console.log(`Minter:        ${minter}`);
console.log(`${ok(wrapped)} wrapped + registered  (NameWrapper owner: ${owner})`);
console.log(`${ok(approved || minterIsOwner)} minter can mint        (${minterIsOwner ? "minter owns it" : approved ? "approved operator" : "NOT approved — setApprovalForAll(minter,true)"})`);
console.log(`${ok(minterEth > 0n)} minter funded          (${formatEther(minterEth)} ETH)`);
console.log(
  wrapped && (approved || minterIsOwner) && minterEth > 0n
    ? "\n🔥 All set — log in and your dæmon will provision (funds + 8004) on the spot."
    : "\nNot ready yet — fix the ❌ rows above, then re-run.",
);
