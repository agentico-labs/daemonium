# Workstream B — agent + onchain backend

Ignis is an AI dæmon that **is** a Dynamic server wallet (Dynamic manages it); sub-agents get
their own wallets and nest as an ENS cluster. **Each user gets their own Ignis**, and every
state-changing action is gated by a human confirmation. This doc covers the seam for Workstream
A and how to run + verify.

## Architecture in one breath
Human logs in with Dynamic → backend **verifies their JWT** → at first login they **pick a handle**
and their dæmon is auto-provisioned at **`ignis.<handle>.daemonium.eth`** (own Dynamic MPC server
wallet + ENS subtree + ERC-8004 card, all minted by the minter — no confirm, since claiming a name
isn't a value transfer) → agent tools **propose** value-moving actions (never sign) → human taps
Confirm → `POST /api/daemon/execute` is the **only** signer (and checks the proposal belongs to that
user). Sub-agents nest under the user's own dæmon, e.g. `research.ignis.<handle>.daemonium.eth`.

**Auth:** every `/api/agent` and `/api/daemon/*` route requires a Dynamic session token
(`Authorization: Bearer <getAuthToken()>`), verified server-side against the env's JWKS
(`app/lib/auth.ts`). The agent's key is `resolveUserKey(userId)` (the user's chosen handle →
`ignis.<handle>.daemonium.eth`), never from the client — so you can only ever drive your own dæmon.
Routes return 409 `needsHandle` until the user has picked one.

## The seam (`app/lib/types.ts`)
- **`DaemonEvent`** stream (server→client, sent as ai-sdk `data-daemon` parts):
  `state` · `speak` · `proposal` · `txResult` · `subagentResult` · `done`.
- **`ProposalCard`** `{ executionId, action, agent, summary, details }` — the confirm tap returns
  only `executionId`.
- **`DaemonIdentity`** (recursive) and **`AgentCard`** (ERC-8004 registration-v1).
- **`mockAgentRun()`** (`app/lib/mock-agent.ts`) — scripted events to build the flame against.

Workstream A: use the **`useDaemon()`** hook (`app/lib/daemon-client.ts`). It exposes
`{ messages, state, proposal, txResult, sendPrompt, confirm, dismissProposal }`. Replace the dev
`Console` (`app/components/console.tsx`) with the flame; the seam is identical.

## Routes
All except `agent-card` require `Authorization: Bearer <Dynamic token>`.

| Route | Method | Purpose |
|---|---|---|
| `/api/daemon/handle` | GET/POST | GET checks if the user has a handle; POST claims one + **auto-provisions** the dæmon (slow: several Sepolia txs). Auth'd. |
| `/api/agent` | POST | The user's dæmon brain (ai-sdk → Claude via AI Gateway). Auth'd. |
| `/api/daemon/init` | POST | Report the user's Ignis address + balances. Auth'd. |
| `/api/daemon/execute` | POST | **The only signer.** Body `{ executionId }`; checks owner. Auth'd. |
| `/api/daemon/propose` | POST | Debug: mint a send_usdc proposal without the agent. Auth'd. |
| `/api/daemon/ens-status` | GET | Is the user's Ignis authorized to mint its subname? Auth'd. |
| `/api/daemon/watch` | GET | Incoming USDC since `?since=<block>` (proactive). Auth'd. |
| `/api/agent-card/[name]` | GET | **Public** ERC-8004 agent card JSON (= agentURI + ENS text). `[name]` is the agent's ENS name. |

## Run it
1. `pnpm install` (already done) — env is in `.env.local` (`DYNAMIC_*`, `DAEMON_WALLET_PASSWORD`,
   `SEPOLIA_RPC_URL`, `ENS_PARENT_NAME`, `AI_GATEWAY_API_KEY`).
2. `pnpm dev` → http://localhost:3000. Log in (email/social) → **pick a handle** in the modal →
   your dæmon `ignis.<handle>.daemonium.eth` is auto-provisioned (~30s of Sepolia txs).
3. Talk to Ignis in the console: "what's my balance?", "send 1 USDC to vitalik.eth" (→ confirm card),
   "spawn a research sub-agent". (The token is attached automatically by the client; to call routes
   via curl you need `Authorization: Bearer <getAuthToken()>`.)

## Setup (ONE-TIME) + per-user funding
ENS provisioning is automated by a **minter** wallet — the parent owner approves it once and then
every user is provisioned with no further approval. `GET /api/daemon/ens-status` prints the minter
address + approval/balance status and the how-to. One-time:
1. **Approve the minter**: from the wallet that owns `daemonium.eth`, call
   `setApprovalForAll(<minter address>, true)` on the NameWrapper
   `0x0635513f179D50A207757E05759CbD106d7dFcE8` (Sepolia).
2. **Fund the minter** with Sepolia ETH — it pays for every user's subname mint and seeds each
   user's Ignis a little gas for its ERC-8004 + text record.

Per user, only **USDC funding** remains manual (you can't auto-hand out value): to send USDC, a
user funds their own Ignis with test USDC. Identity-claim gas is auto-seeded by the minter.

## Verified working (no funds needed)
Per-user wallet creation + persistence + idempotent reload; JWT auth gate (401 on missing/bad
token, JWKS reachable, RS256); the agent loop with tool calls; read tools
(balance/identity/ENS/activity); the propose→confirm gate; `register_subname`/`spawn_subagent`
proposals; the sub-agent delegation loop; agent-card JSON; watch endpoint.

## Blocked on the two prerequisites above (code complete, awaiting on-chain verify)
A real USDC send; a user's Ignis claiming `ignis-<id>.daemonium.eth` + ERC-8004; spawning a real
sub-agent (wallet + nested subname + card). Also: the authed happy-path with a real browser token
(verified at the mechanism level; needs a logged-in session for a full end-to-end pass).

## Verified constants (Sepolia)
USDC `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` · ENS NameWrapper `0x0635513f179D50A207757E05759CbD106d7dFcE8`
· PublicResolver `0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5` · ERC-8004 IdentityRegistry
`0x8004A818BFB912233c491871b3d84c89A494BD9e`. Model: `anthropic/claude-sonnet-4.6` via AI Gateway.

## Not built (stretch)
x402 paywall; receive-any-settle-USDC via Flow (needs Flow enterprise entitlement; would run on
**Base Sepolia**, not Ethereum Sepolia).
