/**
 * Is `daemonium.eth` actually registered on Sepolia, and who owns it? Cross-checks the .eth
 * BaseRegistrar + ENS registry + NameWrapper across multiple RPCs to rule out RPC lag.
 *   node scripts/whois.mjs
 */
import { createPublicClient, http, parseAbi } from "viem";
import { sepolia } from "viem/chains";
import { namehash, labelhash } from "viem/ens";

const RPCS = [
  process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
  "https://rpc.sepolia.org",
  "https://1rpc.io/sepolia",
];
const BASE_REGISTRAR = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";
const REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const NW = "0x0635513f179D50A207757E05759CbD106d7dFcE8";
const label = "daemonium";
const name = "daemonium.eth";

const baseAbi = parseAbi([
  "function ownerOf(uint256 id) view returns (address)",
  "function nameExpires(uint256 id) view returns (uint256)",
  "function available(uint256 id) view returns (bool)",
]);
const ownerAbi = parseAbi(["function owner(bytes32 node) view returns (address)"]);
const tokenId = BigInt(labelhash(label));
const node = namehash(name);

for (const rpc of RPCS) {
  console.log(`\n=== via ${rpc} ===`);
  const pc = createPublicClient({ chain: sepolia, transport: http(rpc) });
  try {
    const block = await pc.getBlockNumber();
    const available = await pc.readContract({ address: BASE_REGISTRAR, abi: baseAbi, functionName: "available", args: [tokenId] }).catch((e) => "ERR " + (e.shortMessage ?? e.message));
    let registrant = "—", expires = "—";
    try {
      registrant = await pc.readContract({ address: BASE_REGISTRAR, abi: baseAbi, functionName: "ownerOf", args: [tokenId] });
      expires = (await pc.readContract({ address: BASE_REGISTRAR, abi: baseAbi, functionName: "nameExpires", args: [tokenId] })).toString();
    } catch (e) {
      registrant = "not registered (" + (e.shortMessage ?? e.message).slice(0, 40) + ")";
    }
    const regOwner = await pc.readContract({ address: REGISTRY, abi: ownerAbi, functionName: "owner", args: [node] }).catch((e) => "ERR");
    const nwOwner = await pc.readContract({ address: NW, abi: baseAbi, functionName: "ownerOf", args: [BigInt(node)] }).catch((e) => "ERR");
    console.log(`  block:               ${block}`);
    console.log(`  BaseRegistrar.available(daemonium): ${available}`);
    console.log(`  BaseRegistrar.ownerOf (registrant): ${registrant}`);
    console.log(`  BaseRegistrar.nameExpires:          ${expires}`);
    console.log(`  Registry.owner(daemonium.eth):      ${regOwner}`);
    console.log(`  NameWrapper.ownerOf(daemonium.eth): ${nwOwner}`);
  } catch (e) {
    console.log(`  RPC error: ${e.shortMessage ?? e.message}`);
  }
}
