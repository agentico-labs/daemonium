'use client';

/**
 * The proactive moment — Ignis notices an incoming USDC transfer and speaks up on its own.
 * Polls /api/daemon/watch on a timer, owns the block cursor, and on a genuinely-new transfer
 * feeds a synthetic turn into the live agent (`run`) so the flame reacts and Ignis voices it.
 *
 * Baseline-then-react: the first poll only records what's already on-chain (it never reacts to
 * history); only transfers that land after we start watching trigger a reaction. Dedupe is by
 * tx hash, so the route's inclusive block-range rescan can't double-announce. Polling pauses
 * whenever a turn is in flight, the mic is open, Ignis is mid-sentence, or a proposal is
 * waiting — so the unprompted line never steps on the user or on itself.
 */
import { useEffect, useRef } from 'react';
import { authHeaders } from './daemon-client';

/** Shape of GET /api/daemon/watch — kept local so this client hook never imports server-only evm.ts. */
interface WatchTransfer {
  from: string;
  amount: string;
  tx: string;
  block: string;
}
interface WatchResponse {
  latestBlock: string;
  transfers: WatchTransfer[];
}

const POLL_MS = 10_000;

export function useProactiveWatch(opts: {
  /** Watch only once the user has a fully provisioned dæmon. */
  enabled: boolean;
  /** Hold the unprompted line while a turn/mic/speech/proposal is active. */
  paused: boolean;
  /** Feed a synthetic turn into the live agent so the flame reacts + speaks. */
  run: (text: string) => void;
}) {
  const { enabled, paused, run } = opts;

  // Read the latest paused/run inside the interval without re-subscribing it every render.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const runRef = useRef(run);
  runRef.current = run;

  const cursorRef = useRef<bigint | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      // Reset so a later sign-in re-baselines instead of firing on stale history.
      cursorRef.current = null;
      seenRef.current = new Set();
      return;
    }

    let cancelled = false;

    const poll = async () => {
      if (cancelled || pausedRef.current || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const since = cursorRef.current;
        const qs = since !== null ? `?since=${since.toString()}` : '';
        const res = await fetch(`/api/daemon/watch${qs}`, { headers: authHeaders() });
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as WatchResponse;

        const baseline = cursorRef.current === null;
        cursorRef.current = BigInt(data.latestBlock);

        const fresh = data.transfers.filter((t) => !seenRef.current.has(t.tx));
        for (const t of fresh) seenRef.current.add(t.tx);

        // First poll just records what's already there; react only to what lands afterwards.
        if (baseline || fresh.length === 0 || pausedRef.current) return;
        runRef.current(proactivePrompt(fresh));
      } catch {
        // Network blip — try again next tick.
      } finally {
        inFlightRef.current = false;
      }
    };

    void poll(); // establish the baseline immediately on enable
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled]);
}

/** One short, natural utterance for Ignis to voice when funds land. */
function proactivePrompt(transfers: WatchTransfer[]): string {
  const newest = transfers[transfers.length - 1];
  const short = `${newest.from.slice(0, 6)}…${newest.from.slice(-4)}`;
  const extra = transfers.length > 1 ? ` (plus ${transfers.length - 1} more)` : '';
  return (
    `[ambient] You just received ${newest.amount} USDC from ${short}${extra}. ` +
    `Notice it and react briefly and warmly out loud — one short line, no questions.`
  );
}
