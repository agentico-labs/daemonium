import { createPublicClient, http, parseAbi, formatEther, zeroHash } from "viem";
import { sepolia } from "viem/chains";

const RPC = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const CONTROLLER = "0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968";
const PUBLIC_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";
const ZERO = "0x0000000000000000000000000000000000000000";
const MINTER = "0xb2BA0ceCb1763A9F2969bcD834494eAF76bd28a0";
const SECRET = "0x87f7486f9f0732676799f4029008d6f331ae7b56d83438c19992334d35ffb3ad";

const pc = createPublicClient({ chain: sepolia, transport: http(RPC) });
const abi = parseAbi([
  "struct Registration { string label; address owner; uint256 duration; bytes32 secret; address resolver; bytes[] data; uint8 reverseRecord; bytes32 referrer; }",
  "struct Price { uint256 base; uint256 premium; }",
  "function available(string label) view returns (bool)",
  "function rentPrice(string label, uint256 duration) view returns (Price)",
  "function makeCommitment(Registration registration) pure returns (bytes32)",
  "function commitments(bytes32) view returns (uint256)",
  "function minCommitmentAge() view returns (uint256)",
  "function maxCommitmentAge() view returns (uint256)",
  "function register(Registration registration) payable",
  // EXACT custom errors from the verified ABI so viem decodes the revert
  "error CommitmentNotFound(bytes32 commitment)",
  "error CommitmentTooNew(bytes32 commitment, uint256 minimumCommitmentTimestamp, uint256 currentTimestamp)",
  "error CommitmentTooOld(bytes32 commitment, uint256 maximumCommitmentTimestamp, uint256 currentTimestamp)",
  "error DurationTooShort(uint256 duration)",
  "error InsufficientValue()",
  "error MaxCommitmentAgeTooHigh()",
  "error MaxCommitmentAgeTooLow()",
  "error NameNotAvailable(string name)",
  "error ResolverRequiredForReverseRecord()",
  "error ResolverRequiredWhenDataSupplied()",
  "error UnexpiredCommitmentExists(bytes32 commitment)",
]);

const reg = {
  label: "daemonium",
  owner: MINTER,
  duration: 31536000n,
  secret: SECRET,
  resolver: ZERO,
  data: [],
  reverseRecord: 0,
  referrer: zeroHash,
};

const commitment = await pc.readContract({ address: CONTROLLER, abi, functionName: "makeCommitment", args: [reg] });
const block = await pc.getBlock();
let commitTs = 0n;
try {
  commitTs = await pc.readContract({ address: CONTROLLER, abi, functionName: "commitments", args: [commitment] });
} catch (e) {
  console.log("commitments() read failed:", e.shortMessage ?? e.message);
}
const minAge = await pc.readContract({ address: CONTROLLER, abi, functionName: "minCommitmentAge" });
const maxAge = await pc.readContract({ address: CONTROLLER, abi, functionName: "maxCommitmentAge" });
const available = await pc.readContract({ address: CONTROLLER, abi, functionName: "available", args: ["daemonium"] });
const price = await pc.readContract({ address: CONTROLLER, abi, functionName: "rentPrice", args: ["daemonium", reg.duration] });
const value = ((price.base + price.premium) * 103n) / 100n;

console.log("commitment:", commitment);
console.log("commit ts:", commitTs.toString(), " now:", block.timestamp.toString(), " age:", (block.timestamp - commitTs).toString(), "s");
console.log("minAge:", minAge.toString(), " maxAge:", maxAge.toString());
console.log("available(daemonium):", available);
console.log("value to send:", formatEther(value), "ETH");

try {
  await pc.simulateContract({ address: CONTROLLER, abi, functionName: "register", args: [reg], value, account: MINTER });
  console.log("\n✅ simulate OK — register would succeed now (original failure was gas/timing). Retry with explicit gas.");
} catch (e) {
  console.log("\n❌ simulate revert:", e.shortMessage);
  console.log("   errorName:", e.cause?.data?.errorName ?? e.cause?.cause?.data?.errorName ?? "(undecoded / empty)");
  console.log("   args:", e.cause?.data?.args ?? "—");
}
