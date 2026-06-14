'use client';

/**
 * Summon a dæmon — the bottom-sheet ritual that opens when an empty `+` slot in the cluster
 * star is tapped. Collects a true name (an ENS subname) and a purpose, then kindles the new
 * dæmon. The dimmed star behind it is the live Cluster (the page passes the tapped slot so it
 * pulses); this renders the scrim + sheet over it.
 *
 * "Kindle" hands a single onKindle({ handle, purpose }) up to the page, which routes it through
 * Ignis as a real, confirm-gated spawn — so the actual onchain step happens on the confirm card
 * back home, not here. This sheet only owns the form.
 *
 * react-best-practices: the autofocus timer is a ref (transient); the label, suffix, and
 * availability are derived during render (no effects); the sanitize regex is hoisted.
 */
import { useEffect, useRef, useState } from 'react';
import { FlameImage } from '@/components/FlameImage';

const HANDLE_RX = /[^a-z0-9-]/g;
const sanitize = (v: string) => v.toLowerCase().replace(HANDLE_RX, '');

export function SummonSheet({
  rootEnsName,
  rootLabel,
  takenLabels,
  onKindle,
  onDismiss,
}: {
  /** The root dæmon's full ENS name — the new dæmon nests under it: `${handle}.${rootEnsName}`. */
  rootEnsName: string;
  /** Leaf of the root name (e.g. "ignis") — used in the "already burns" message. */
  rootLabel: string;
  /** Existing child labels, for the (mock) availability check. */
  takenLabels: string[];
  onKindle: (args: { handle: string; purpose: string }) => void;
  onDismiss: () => void;
}) {
  const [handle, setHandle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [kindling, setKindling] = useState(false);
  const handleRef = useRef<HTMLInputElement>(null);

  // Autofocus the name field once the sheet has started rising (keeps the keyboard tied to
  // the slot-tap gesture on iOS, same trick as the liquid sigil).
  useEffect(() => {
    const id = setTimeout(() => handleRef.current?.focus(), 120);
    return () => clearTimeout(id);
  }, []);

  // Esc / hardware-back closes the sheet (a recommended production affordance).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  // Derived during render — never stored.
  const h = handle.trim();
  const taken = h.length > 0 && takenLabels.includes(h);
  const summonLabel = h ? `Kindle ${h}` : 'Kindle the flame';

  const kindle = () => {
    if (!h || kindling) return;
    setKindling(true);
    onKindle({ handle: h, purpose: purpose.trim() });
  };

  return (
    <>
      {/* scrim — tap to cancel */}
      <button
        type="button"
        aria-label="Cancel"
        onClick={onDismiss}
        className="absolute inset-0 z-30 cursor-default"
        style={{ background: 'rgba(0,0,0,.5)', border: 'none', animation: 'fade-in .25s ease both' }}
      />

      {/* the sheet */}
      <div
        role="dialog"
        aria-label="Summon a dæmon"
        className="absolute inset-x-0 bottom-0 z-[31]"
        style={{
          borderRadius: '30px 30px 0 0',
          borderTop: '1px solid rgba(255,150,70,.3)',
          background: 'linear-gradient(180deg, #1a0f08, #0c0805)',
          boxShadow: '0 -24px 70px rgba(0,0,0,.55), 0 -1px 0 rgba(255,150,70,.12)',
          animation: 'sheet-up .42s cubic-bezier(.2,.8,.2,1) both',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* grabber */}
        <div className="flex justify-center pb-0.5 pt-2.5">
          <div className="h-[5px] w-10 rounded-[3px]" style={{ background: 'rgba(246,236,221,.22)' }} />
        </div>

        {/* seed flame — the unlit spark about to be kindled */}
        <div className="flex flex-col items-center pb-0.5 pt-3">
          <div className="relative" style={{ width: 76, height: 76 }}>
            <div
              className="absolute rounded-full"
              style={{
                inset: '-22%',
                background: 'radial-gradient(closest-side, rgba(255,150,60,.5), transparent 72%)',
                filter: 'blur(13px)',
                animation: 'cluster-halo 3.4s ease-in-out infinite',
              }}
            />
            <FlameImage
              style={{
                opacity: 0.5,
                filter: 'grayscale(.35) brightness(.85)',
                animation: 'cluster-seedflicker 2.6s ease-in-out infinite',
              }}
            />
          </div>
          <div
            className="mt-1.5 text-[11px] uppercase"
            style={{ letterSpacing: '2.5px', color: '#f0ad6b' }}
          >
            Summon a daemon
          </div>
        </div>

        <div className="px-[22px] pt-[18px]">
          {/* true name */}
          <label
            className="mb-2 block text-[11px] uppercase tracking-[1.2px]"
            style={{ color: 'rgba(246,236,221,.45)' }}
          >
            True name
          </label>
          <div
            className="flex items-center"
            style={{
              borderRadius: 15,
              border: '1px solid rgba(255,150,70,.32)',
              background: 'rgba(255,122,24,.06)',
              padding: '0 4px 0 14px',
              boxShadow: '0 0 0 3px rgba(255,122,24,.06)',
            }}
          >
            <input
              ref={handleRef}
              value={handle}
              onChange={(e) => setHandle(sanitize(e.target.value))}
              placeholder="oracle"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              enterKeyHint="done"
              aria-label="True name"
              className="min-w-0 flex-1 border-none bg-transparent py-3.5 font-mono text-[16px] text-[#f6ecdd] outline-none"
            />
            <span
              className="flex-none whitespace-nowrap font-mono text-[13.5px]"
              style={{ color: 'rgba(255,190,140,.7)', padding: '0 10px 0 4px' }}
            >
              .{rootEnsName}
            </span>
          </div>

          {/* availability hint (mock — wire to a real *.{root} subname lookup later) */}
          <div className="mt-2 min-h-[15px] font-mono text-[11.5px]">
            {h ? (
              taken ? (
                <span style={{ color: '#ff7a6a' }}>{h}.{rootLabel} already burns</span>
              ) : (
                <span style={{ color: '#6fe6a8' }}>{h}.{rootEnsName} is unclaimed</span>
              )
            ) : null}
          </div>

          {/* purpose */}
          <label
            className="mb-2 mt-[18px] block text-[11px] uppercase tracking-[1.2px]"
            style={{ color: 'rgba(246,236,221,.45)' }}
          >
            Its purpose
          </label>
          <div
            style={{
              borderRadius: 15,
              border: '1px solid rgba(255,255,255,.1)',
              background: 'rgba(255,255,255,.035)',
              padding: '13px 14px',
            }}
          >
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What should this dæmon watch, seek, or do on your behalf?"
              rows={3}
              aria-label="Its purpose"
              className="w-full resize-none border-none bg-transparent text-[15px] leading-normal text-[#f6ecdd] outline-none"
            />
          </div>
        </div>

        {/* kindle */}
        <div className="px-[22px] pb-[30px] pt-[22px]">
          <button
            type="button"
            onClick={kindle}
            disabled={!h || kindling}
            className="flex w-full items-center justify-center gap-2 text-[15px] font-bold transition active:scale-[0.98] disabled:opacity-60"
            style={{
              padding: 16,
              border: 'none',
              borderRadius: 16,
              background: 'linear-gradient(135deg, #ffb347 0%, #ff7a3c 38%, #ff5e9a 100%)',
              color: '#2a0f08',
              boxShadow: '0 0 30px rgba(255,120,80,.38), inset 0 1px 1px rgba(255,240,220,.5)',
            }}
          >
            {kindling ? (
              <>
                <span>Kindling {h}</span>
                <KindlingDots />
              </>
            ) : (
              summonLabel
            )}
          </button>
        </div>
      </div>
    </>
  );
}

/** Three bobbing dots shown while the spawn is being handed to Ignis. */
function KindlingDots() {
  return (
    <span aria-hidden className="inline-flex gap-[3px]">
      {[0, 0.15, 0.3].map((delay) => (
        <span
          key={delay}
          className="inline-block h-[4px] w-[4px] rounded-full"
          style={{
            background: '#2a0f08',
            animation: `cluster-dots 1s ease-in-out ${delay}s infinite`,
          }}
        />
      ))}
    </span>
  );
}
