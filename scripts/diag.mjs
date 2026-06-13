import { createPublicClient, http, parseAbi, formatEther } from "viem";
import { sepolia } from "viem/chains";
import { namehash } from "viem/ens";

const rpc = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const pc = createPublicClient({ chain: sepolia, transport: http(rpc) });
const NW = "0x0635513f179D50A207757E05759CbD106d7dFcE8";
const REG = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const daemon = "0x0b96E1195e2cfc3f9B19214727c4fC16f1A9c584";
const minter = "0xb2BA0ceCb1763A9F2969bcD834494eAF76bd28a0";
const nwAbi = parseAbi(["function ownerOf(uint256) view returns (address)"]);
const regAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

async function owner(name) {
  try {
    return await pc.readContract({
      address: NW,
      abi: nwAbi,
      functionName: "ownerOf",
      args: [BigInt(namehash(name))],
    });
  } catch (e) {
    return "ERR: " + (e.shortMessage ?? e.message);
  }
}

console.log("daemon ETH:", formatEther(await pc.getBalance({ address: daemon })));
console.log("minter ETH:", formatEther(await pc.getBalance({ address: minter })));
console.log(
  "8004 balanceOf(daemon):",
  (await pc.readContract({ address: REG, abi: regAbi, functionName: "balanceOf", args: [daemon] })).toString(),
);
console.log("NameWrapper.ownerOf daemonium.eth:", await owner("daemonium.eth"));

// Classic ENS registry owner — tells us if daemonium.eth is wrapped (owner == NameWrapper) or not.
const REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const regOwnerAbi = parseAbi(["function owner(bytes32 node) view returns (address)"]);
async function regOwner(name) {
  try {
    return await pc.readContract({ address: REGISTRY, abi: regOwnerAbi, functionName: "owner", args: [namehash(name)] });
  } catch (e) {
    return "ERR: " + (e.shortMessage ?? e.message);
  }
}
console.log("Registry.owner daemonium.eth:     ", await regOwner("daemonium.eth"));
console.log("  (NameWrapper addr is            ", NW, ")");
console.log("Registry.owner eth (TLD, sanity): ", await regOwner("eth"));
console.log("ENS_PARENT_NAME env:              ", process.env.ENS_PARENT_NAME);
