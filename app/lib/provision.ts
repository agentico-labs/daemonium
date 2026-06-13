/**
 * Auto-provision a user's dæmon identity from their chosen handle. Idempotent and safe to
 * retry — each step checks on-chain/store state before acting. This is the "auto-claim on
 * login" path: no human confirmation (claiming a name isn't a value transfer), all gas paid
 * by the minter.
 *
 * Builds the 3-level cluster:
 *   daemonium.eth (owner) → <handle>.daemonium.eth (minter) → ignis.<handle>.daemonium.eth (dæmon)
 */
import "server-only";
import { type Address } from "viem";
import { agentCardUri, ENS_PARENT_NAME, ENS } from "./chain";
import { ensureAgentWallet } from "./dynamic-server";
import { ensureMinter, seedGasIfLow, MINTER_KEY } from "./minter";
import { registerSubname, setAgentCardRecord, subnameExists, canManageParent } from "./ens";
import { registerIdentity, ownsIdentity } from "./erc8004";
import { getWallet, updateWallet } from "./wallet-store";
import { ensNameForHandle, userRootName } from "./handles";
import { withLock } from "./lock";

export interface ProvisionResult {
  ensName: string;
  address: string;
  agentId?: string;
  /** True if the ERC-8004 identity step completed (false = names exist, identity deferred). */
  identityComplete: boolean;
}

export async function provisionIdentity(handle: string): Promise<ProvisionResult> {
  // Serialize per handle so concurrent calls (modal retry, two tabs) can't double-submit the
  // same mints while the first tx is still pending (the on-chain subnameExists check only
  // flips true after a receipt).
  return withLock(`provision:${handle}`, () => provisionInner(handle));
}

async function provisionInner(handle: string): Promise<ProvisionResult> {
  const ensName = ensNameForHandle(handle); // ignis.<handle>.daemonium.eth
  const userRoot = userRootName(handle); // <handle>.daemonium.eth

  // 1. The dæmon's own wallet — keyed by its ENS name.
  const ignis = await ensureAgentWallet(ensName);
  const owner = ignis.address as Address;

  // 2. The minter (approved once on daemonium.eth) owns the per-user root subname.
  const minter = await ensureMinter();
  const minterAddr = minter.address as Address;

  // Preflight: fail fast with a clear message if the one-time setup wasn't done, instead of a
  // cryptic on-chain revert on the first setSubnodeRecord.
  if (!(await canManageParent(ENS_PARENT_NAME, minterAddr))) {
    throw new Error(
      `Minter ${minterAddr} is not authorized on ${ENS_PARENT_NAME}. ` +
        `Ensure ${ENS_PARENT_NAME} is wrapped and call NameWrapper.setApprovalForAll(${minterAddr}, true) ` +
        `on ${ENS.nameWrapper} (Sepolia), then fund the minter with ETH.`,
    );
  }

  if (!(await subnameExists(userRoot))) {
    await registerSubname({
      parentName: ENS_PARENT_NAME,
      label: handle,
      owner: minterAddr,
      signerLabel: MINTER_KEY,
    });
  }

  // 3. Mint ignis.<handle>.daemonium.eth under the user root, OWNED BY THE DÆMON.
  if (!(await subnameExists(ensName))) {
    await registerSubname({
      parentName: userRoot,
      label: "ignis",
      owner,
      signerLabel: MINTER_KEY, // the minter owns the user root, so it can mint under it
    });
  }

  // 4. Seed the dæmon a little gas (from the minter) for the next two steps.
  await seedGasIfLow(owner);

  // 5. The dæmon registers its OWN ERC-8004 identity + sets its OWN text record. Best-effort,
  //    and guarded by an on-chain ownsIdentity() check so a crash between mine and persist
  //    never re-mints a duplicate identity on the next retry.
  let identityComplete = Boolean(ignis.agentId);
  if (!identityComplete) {
    try {
      const uri = agentCardUri(ensName);
      if (!(await ownsIdentity(owner))) {
        const { agentId } = await registerIdentity({ agentURI: uri, signerLabel: ensName });
        await updateWallet(ensName, { agentId, agentCardUri: uri });
      }
      await setAgentCardRecord({ name: ensName, uri, signerLabel: ensName });
      identityComplete = Boolean((await getWallet(ensName))!.agentId);
    } catch {
      identityComplete = false;
    }
  }

  const updated = (await getWallet(ensName))!;
  return {
    ensName,
    address: updated.address,
    agentId: updated.agentId,
    identityComplete,
  };
}
