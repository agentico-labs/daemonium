'use client';

/**
 * Cluster — the "forge" screen below Home (reached by scrolling down). It shows the dæmon
 * family as an elemental star (a pentagram with Ignis at center and the sub-dæmons burning
 * at its points), the Daemons roster, and the Current spells (live background tasks).
 *
 * Everything is CSS/DOM — no canvas. Each dæmon is the one shared flame webp recolored to
 * its element (see lib/cluster · ELEMENTS). Tapping an empty `+` slot calls onSlotTap, which
 * the page turns into the summon ritual; while a slot is being summoned into, it pulses.
 *
 * Roster + spells arrive as props (the page feeds them live from useCluster → /api/daemon/cluster),
 * mapped into lib/cluster's view-model shapes.
 */
import type { CSSProperties } from 'react';
import { FlameImage } from '@/components/FlameImage';
import {
  ELEMENTS,
  buildStarNodes,
  flameFilter,
  type ClusterDaemon,
  type Spell,
  type StarNode,
} from '@/lib/cluster';

// Per-ring ambient timings (staggered so the flames don't breathe in lockstep) — the design's
// values, keyed by ring position. The center (ring -1) uses CENTER_TIMING. Slots aren't animated.
const CENTER_TIMING = { breathe: 5, halo: 4, delay: 0 };
const RING_TIMING: Array<{ breathe: number; halo: number; delay: number }> = [
  { breathe: 4.6, halo: 4.2, delay: 0 },
  { breathe: 5.2, halo: 5, delay: 0.5 },
  { breathe: 4.9, halo: 4.4, delay: 0.9 },
  { breathe: 4.7, halo: 4.6, delay: 0.3 },
  { breathe: 5.1, halo: 4.8, delay: 0.7 },
];

// Static star scaffold (concentric rings + the slowly-spinning dashed ring + the pentagram).
// Hoisted out of the component — it never changes (rendering-hoist-jsx).
const STAR_SCAFFOLD = (
  <>
    <div
      className="absolute rounded-full"
      style={{ inset: '2%', border: '1px solid rgba(255,150,60,.2)' }}
    />
    <div
      className="absolute rounded-full"
      style={{
        inset: '8%',
        border: '1px dashed rgba(255,170,80,.18)',
        animation: 'cluster-spin 80s linear infinite',
      }}
    />
    <svg
      viewBox="0 0 300 300"
      className="absolute inset-0 h-full w-full"
      style={{ overflow: 'visible' }}
      aria-hidden
    >
      <polygon
        points="150,30 220.5,247.1 35.9,112.9 264.1,112.9 79.5,247.1"
        fill="none"
        stroke="rgba(255,170,80,.4)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  </>
);

/** One star node: a burning flame (recolored), or an empty `+` slot that opens the ritual. */
function StarNodeView({
  node,
  activeSlot,
  onSlotTap,
}: {
  node: StarNode;
  activeSlot: number | null;
  onSlotTap: (slot: number) => void;
}) {
  const base: CSSProperties = {
    position: 'absolute',
    top: node.top,
    left: node.left,
    width: node.size,
    height: node.size,
    transform: 'translate(-50%,-50%)',
  };

  if (node.element) {
    const el = ELEMENTS[node.element];
    const isCenter = node.ring === -1;
    const t = isCenter ? CENTER_TIMING : RING_TIMING[node.ring] ?? CENTER_TIMING;
    const haloInset = isCenter ? '-18%' : '-24%';
    const haloBlur = isCenter ? 13 : 8;
    const shadowBlur = isCenter ? 14 : 7;
    return (
      <div style={{ ...base, opacity: el.dim }}>
        <div
          className="absolute rounded-full"
          style={{
            inset: haloInset,
            background: `radial-gradient(closest-side, ${el.halo}, transparent 72%)`,
            filter: `blur(${haloBlur}px)`,
            animation: `cluster-halo ${t.halo}s ease-in-out ${t.delay}s infinite`,
          }}
        />
        <FlameImage
          style={{
            animation: `${isCenter ? 'cluster-breathe' : 'cluster-breathe-s'} ${t.breathe}s ease-in-out infinite`,
            filter: flameFilter(node.element, shadowBlur),
          }}
        />
      </div>
    );
  }

  const isActive = activeSlot === node.slot;
  return (
    <button
      type="button"
      onClick={() => onSlotTap(node.slot!)}
      aria-label="Summon a dæmon"
      style={{ ...base, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={
          isActive
            ? {
                border: '1.5px solid rgba(255,180,100,.7)',
                animation: 'cluster-emptypulse 1.8s ease-in-out infinite',
              }
            : { border: '1px dashed rgba(255,170,80,.28)' }
        }
      />
      <div
        className="absolute inset-0 grid place-items-center"
        style={{ color: isActive ? 'rgba(255,200,130,.9)' : 'rgba(255,180,100,.5)', fontSize: 16 }}
      >
        +
      </div>
    </button>
  );
}

/** A roster row: a small tinted flame, the nested handle + "doing now", the status + duration. */
function DaemonRow({ daemon, rootLabel }: { daemon: ClusterDaemon; rootLabel: string }) {
  const el = ELEMENTS[daemon.element];
  return (
    <div className="flex items-center gap-3 py-1" style={{ opacity: el.dim ? 0.8 : 1 }}>
      <div className="relative flex-none" style={{ width: 36, height: 36 }}>
        <div
          className="absolute rounded-full"
          style={{
            inset: '-22%',
            background: `radial-gradient(closest-side, ${el.halo}, transparent 72%)`,
            filter: 'blur(6px)',
          }}
        />
        <FlameImage style={{ filter: flameFilter(daemon.element, 5) }} />
      </div>

      <div className="min-w-0 flex-1">
        <div
          className="font-mono text-[13px]"
          style={{ color: el.dim ? 'rgba(246,236,221,.82)' : '#f6ecdd' }}
        >
          {daemon.sub}.{rootLabel}
        </div>
        <div className="mt-px truncate text-[11px]" style={{ color: el.subtitle }}>
          {daemon.doingNow}
        </div>
      </div>

      <div className="flex-none text-right">
        <div className="text-[10.5px] uppercase tracking-[0.6px]" style={{ color: el.status }}>
          {daemon.status}
        </div>
        <div className="mt-0.5 font-mono text-[11px]" style={{ color: el.duration }}>
          {daemon.elapsed}
        </div>
      </div>
    </div>
  );
}

/** A spell thread: status dot + title + elapsed, a glowing progress bar with an ember knob,
 * and a description. All ember-warm; Ignis's own task burns pure fire (per the design). */
function SpellThread({ spell }: { spell: Spell }) {
  const ember = spell.tone === 'ember';
  const dot = ember ? '#ff9a3c' : '#ff7a18';
  const fillEnd = ember ? '#ff8a2e' : '#ff7a18';
  const fillStart = ember ? 'rgba(255,140,50,.25)' : 'rgba(255,122,24,.25)';
  const fillGlow = ember ? 'rgba(255,140,50,.6)' : 'rgba(255,122,24,.6)';
  const knobGlow = ember ? '#ff8a2e' : '#ff7a18';
  const timeColor = ember ? 'rgba(255,200,150,.7)' : 'rgba(255,190,140,.7)';
  const descColor = ember ? 'rgba(255,200,150,.62)' : 'rgba(255,190,140,.62)';
  const remaining = 100 - spell.percent;
  // A live run has no honest percent (the sub-agent doesn't report progress), so it gets an
  // indeterminate shimmer instead of a fabricated fill. Settled spells show a full/empty bar.
  const running = spell.status === 'running';

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[9px]">
          <span
            className="rounded-full"
            style={{ width: 8, height: 8, background: dot, boxShadow: `0 0 9px ${knobGlow}` }}
          />
          <span className="text-[14px] font-medium">{spell.title}</span>
        </div>
        <span className="font-mono text-[11px]" style={{ color: timeColor }}>
          {spell.elapsed}
        </span>
      </div>

      <div
        className="relative ml-[17px] mt-2 h-1 overflow-hidden rounded-[3px]"
        style={{ background: 'rgba(255,255,255,.06)' }}
      >
        {running ? (
          // Indeterminate: a glowing segment sliding across, no knob (no real percent to point to).
          <div
            className="absolute rounded-[3px]"
            style={{
              top: 0,
              bottom: 0,
              width: '42%',
              background: `linear-gradient(90deg, transparent, ${fillEnd}, transparent)`,
              boxShadow: `0 0 10px ${fillGlow}`,
              animation: 'spell-flow 1.5s ease-in-out infinite',
            }}
          />
        ) : (
          <>
            <div
              className="absolute rounded-[3px]"
              style={{
                inset: `0 ${remaining}% 0 0`,
                background: `linear-gradient(90deg, ${fillStart}, ${fillEnd})`,
                boxShadow: `0 0 10px ${fillGlow}`,
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                left: `${spell.percent}%`,
                top: -2,
                width: 8,
                height: 8,
                background: '#ffe0bf',
                boxShadow: `0 0 9px ${knobGlow}`,
              }}
            />
          </>
        )}
      </div>

      <div className="ml-[17px] mt-1.5 text-[11.5px]" style={{ color: descColor }}>
        {spell.description}
      </div>
    </div>
  );
}

export function Cluster({
  rootLabel,
  daemons,
  spells,
  summary,
  activeSlot,
  onSlotTap,
}: {
  /** Leaf of the root ENS name, e.g. "ignis" — roster rows read `${sub}.${rootLabel}`. */
  rootLabel: string;
  daemons: ClusterDaemon[];
  spells: Spell[];
  /** Live "Current spells" summary line, e.g. "2 active · 1 recent". */
  summary: string;
  /** The empty slot currently being summoned into (pulses), or null. */
  activeSlot: number | null;
  /** Tap an empty `+` slot — the page opens the summon ritual for it. */
  onSlotTap: (slot: number) => void;
}) {
  const starNodes = buildStarNodes(daemons);
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        color: '#f6ecdd',
        background:
          'linear-gradient(180deg, #0a0604 0%, #0a0604 52%, #150c06 82%, #1d0d05 100%)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* bottom forge glow + top ember bloom (non-interactive) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height: '40%',
          background:
            'radial-gradient(120% 90% at 50% 140%, rgba(255,96,22,.32), rgba(255,96,22,.08) 44%, transparent 66%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: 'radial-gradient(110% 38% at 50% 10%, rgba(255,122,24,.13), transparent 54%)',
        }}
      />

      <div className="h-[22px] flex-none" />

      {/* elemental star hero */}
      <div className="relative z-[2] mx-auto flex-none" style={{ width: 230, height: 230 }}>
        {STAR_SCAFFOLD}
        {starNodes.map((node) => (
          <StarNodeView
            key={node.id}
            node={node}
            activeSlot={activeSlot}
            onSlotTap={onSlotTap}
          />
        ))}
      </div>

      {/* Daemons roster */}
      <div className="relative z-[2] flex-none px-[22px] pt-1.5">
        <div
          className="mb-[7px] text-[11px] uppercase tracking-[1.2px]"
          style={{ color: 'rgba(246,236,221,.4)' }}
        >
          Daemons
        </div>
        <div className="flex flex-col gap-0.5">
          {daemons.length ? (
            daemons.map((d) => <DaemonRow key={d.id} daemon={d} rootLabel={rootLabel} />)
          ) : (
            <p className="py-1 text-[12px]" style={{ color: 'rgba(246,236,221,.4)' }}>
              No sub-dæmons yet — tap a <span style={{ color: 'rgba(255,200,130,.8)' }}>+</span> on the
              star to summon one.
            </p>
          )}
        </div>
      </div>

      {/* Current spells */}
      <div className="relative z-[2] min-h-0 flex-1 overflow-hidden px-[22px] pt-4">
        <div className="mb-3 flex items-center justify-between">
          <span
            className="text-[11px] uppercase tracking-[1.2px]"
            style={{ color: 'rgba(246,236,221,.4)' }}
          >
            Current spells
          </span>
          <span
            className="font-mono text-[11px] whitespace-nowrap"
            style={{ color: 'rgba(246,236,221,.4)' }}
          >
            {summary}
          </span>
        </div>
        <div className="flex flex-col gap-[15px]">
          {spells.length ? (
            spells.map((s) => <SpellThread key={s.id} spell={s} />)
          ) : (
            <p className="text-[12px]" style={{ color: 'rgba(246,236,221,.4)' }}>
              Quiet for now. When a dæmon takes on a task, its spell burns here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
