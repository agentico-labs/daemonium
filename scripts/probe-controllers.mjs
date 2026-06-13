import { createPublicClient, http, parseAbi, zeroHash } from "viem";
import { sepolia } from "viem/chains";

const RPC = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";
const OWNER = "0xb2BA0ceCb1763A9F2969bcD834494eAF76bd28a0";
const pc = createPublicClient({ chain: sepolia, transport: http(RPC) });

const controllers = [
  "0xdf60C561Ca35AD3C89D24BbA854654b1c3477078",
  "0x802453f2F077d5a0C3d0F9A6Eb2a36dcFA3C6E0D",
  "0xB359d7d04F750E9C008A5a47Bd2b64134bD180F9",
];

const common = parseAbi([
  "function minCommitmentAge() view returns (uint256)",
  "function available(string) view returns (bool)",
  "function rentPrice(string, uint256) view returns (uint256 base, uint256 premium)",
]);
// Legacy wrapping controller (pre-EP3.5): flat params, bool reverseRecord, uint16 fuses, WRAPS.
const legacyAbi = parseAbi([
  "function makeCommitment(string name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, bool reverseRecord, uint16 ownerControlledFuses) pure returns (bytes32)",
]);
// New struct-based controller.
const newAbi = parseAbi([
  "struct Registration { string label; address owner; uint256 duration; bytes32 secret; address resolver; bytes[] data; uint8 reverseRecord; bytes32 referrer; }",
  "function makeCommitment(Registration registration) pure returns (bytes32)",
]);

const tryRead = async (address, abi, functionName, args) => {
  try {
    const r = await pc.readContract({ address, abi, functionName, args });
    return r;
  } catch (e) {
    return `ERR: ${(e.shortMessage ?? e.message).slice(0, 50)}`;
  }
};

for (const address of controllers) {
  console.log(`\n=== ${address} ===`);
  console.log("  minCommitmentAge:", await tryRead(address, common, "minCommitmentAge", []));
  console.log("  available('daemonium'):", await tryRead(address, common, "available", ["daemonium"]));
  console.log("  rentPrice:", await tryRead(address, common, "rentPrice", ["daemonium", 31536000n]));
  const legacy = await tryRead(address, legacyAbi, "makeCommitment", [
    "daemonium", OWNER, 31536000n, zeroHash, RESOLVER, [], false, 0,
  ]);
  console.log("  makeCommitment[LEGACY flat+wraps]:", typeof legacy === "string" && legacy.startsWith("ERR") ? legacy : "OK ✓ (this is the legacy WRAPPING controller)");
  const struct = await tryRead(address, newAbi, "makeCommitment", [
    { label: "daemonium", owner: OWNER, duration: 31536000n, secret: zeroHash, resolver: RESOLVER, data: [], reverseRecord: 0, referrer: zeroHash },
  ]);
  console.log("  makeCommitment[NEW struct]:", typeof struct === "string" && struct.startsWith("ERR") ? struct : "OK ✓ (new struct controller)");
}
