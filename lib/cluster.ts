/**
 * Presentational view-models for the Cluster screen + Summon ritual.
 *
 * The seam (app/lib/types.ts) stays frozen — these are UI-only shapes. For now the
 * roster + spells are MOCK data (the design handoff's placeholder values), the same
 * way the flame UI built against `mockAgentRun` before the live agent existed. When a
 * "list my cluster / list spells" endpoint exists, feed it into the same shapes and the
 * components don't change.
 *
 * The elemental color system (the heart of the design): every dæmon is the SAME flame
 * webp (public/daemon/idle/full.webp) recolored to its element via CSS `hue-rotate`.
 * The color IS the identity; status is implied by which dæmon.
 */

export type Element = 'fire' | 'blue' | 'green' | 'purple';

export interface ElementStyle {
  /** Core recolor filter for the shared flame webp (no drop-shadow). 'none' = Ignis (fire). */
  recolor: string;
  /** rgba for the soft halo behind the flame. */
  halo: string;
  /** rgba for the flame's drop-shadow glow. */
  shadow: string;
  /** Status-word color (RESEARCHING / WORKING / IDLE). */
  status: string;
  /** "doing now" subtitle color. */
  subtitle: string;
  /** Running-duration color. */
  duration: string;
  /** Idle dæmons (herald) render dimmed — this is their parent opacity. */
  dim?: number;
}

export const ELEMENTS: Record<Element, ElementStyle> = {
  fire: {
    recolor: 'none',
    halo: 'rgba(255,122,24,.6)',
    shadow: 'rgba(255,122,24,.5)',
    status: '#ffb37a',
    subtitle: 'rgba(255,200,150,.62)',
    duration: 'rgba(255,190,140,.7)',
  },
  blue: {
    recolor: 'hue-rotate(198deg) saturate(1.45)',
    halo: 'rgba(80,150,255,.5)',
    shadow: 'rgba(80,150,255,.6)',
    status: '#8fc0ff',
    subtitle: 'rgba(180,210,255,.62)',
    duration: 'rgba(180,210,255,.7)',
  },
  green: {
    recolor: 'hue-rotate(96deg) saturate(1.4)',
    halo: 'rgba(57,255,158,.48)',
    shadow: 'rgba(57,255,158,.55)',
    status: '#6fe6a8',
    subtitle: 'rgba(150,235,190,.62)',
    duration: 'rgba(150,235,190,.7)',
  },
  purple: {
    recolor: 'hue-rotate(252deg) saturate(1.15) brightness(.78)',
    halo: 'rgba(168,85,247,.35)',
    shadow: 'rgba(168,85,247,.45)',
    status: 'rgba(190,150,235,.85)',
    subtitle: 'rgba(200,170,235,.55)',
    duration: 'rgba(200,170,235,.6)',
    dim: 0.72,
  },
};

/** Compose the flame img filter for an element at a given glow blur radius. */
export function flameFilter(element: Element, blur: number): string {
  const { recolor, shadow } = ELEMENTS[element];
  const drop = `drop-shadow(0 0 ${blur}px ${shadow})`;
  return recolor === 'none' ? drop : `${recolor} ${drop}`;
}

/** A node in the elemental star: the center, the burning points, or an empty `+` slot. */
export interface StarNode {
  id: string;
  /** Position within the 230×230 star, as the design's percentages. */
  top: string;
  left: string;
  /** Flame size in px. */
  size: number;
  /** The element, or null for an empty summon slot. */
  element: Element | null;
  /** Empty-slot index (the summon target); present only when element === null. */
  slot?: number;
}

/** The pentagram layout: Ignis at center, three burning points, two empty slots. */
export const STAR_NODES: StarNode[] = [
  { id: 'ignis', top: '50%', left: '50%', size: 80, element: 'fire' },
  { id: 'research', top: '10%', left: '50%', size: 54, element: 'blue' },
  { id: 'scout', top: '37.6%', left: '88%', size: 48, element: 'green' },
  { id: 'herald', top: '82.4%', left: '73.5%', size: 44, element: 'purple' },
  { id: 'slot-0', top: '82.4%', left: '26.5%', size: 36, element: null, slot: 0 },
  { id: 'slot-1', top: '37.6%', left: '12%', size: 36, element: null, slot: 1 },
];

/** A sub-dæmon in the roster. `sub` is the leaf label; the row shows `${sub}.${rootLabel}`. */
export interface ClusterDaemon {
  id: string;
  sub: string;
  element: Element;
  /** The "doing now" subtitle, ellipsised. */
  doingNow: string;
  /** Status word, lowercase here, uppercased in the UI (researching/working/idle). */
  status: string;
  /** Running duration, e.g. "0:42" / "18m". */
  elapsed: string;
}

export type SpellTone = 'ember' | 'ignis';

/** A live background task ("spell"). All threads are warm ember except Ignis's own. */
export interface Spell {
  id: string;
  title: string;
  elapsed: string;
  /** Progress 0–100 (done). */
  percent: number;
  description: string;
  tone: SpellTone;
}

// ---- MOCK data (design handoff placeholders). Swap for a live feed when one exists. ----

export const MOCK_DAEMONS: ClusterDaemon[] = [
  {
    id: 'research',
    sub: 'research',
    element: 'blue',
    doingNow: 'analyzing $HIGHER liquidity',
    status: 'researching',
    elapsed: '0:42',
  },
  {
    id: 'scout',
    sub: 'scout',
    element: 'green',
    doingNow: 'watching 14 new pairs',
    status: 'working',
    elapsed: '3:08',
  },
  {
    id: 'herald',
    sub: 'herald',
    element: 'purple',
    doingNow: 'no active task',
    status: 'idle',
    elapsed: '18m',
  },
];

export const MOCK_SPELLS: Spell[] = [
  {
    id: 'higher',
    title: 'Researching $HIGHER',
    elapsed: '0:42',
    percent: 68,
    description: 'checking liquidity, holders & momentum…',
    tone: 'ember',
  },
  {
    id: 'pairs',
    title: 'Scanning new pairs on Base',
    elapsed: '3:08',
    percent: 84,
    description: '14 new pairs found · ranking by momentum…',
    tone: 'ember',
  },
  {
    id: 'settle',
    title: 'Settling 12 USDC → wallet',
    elapsed: '0:08',
    percent: 92,
    description: 'auto-swapping via x402 · almost done…',
    tone: 'ignis',
  },
];

export const SPELL_SUMMARY = '3 active · 1 queued';

/** Leaf label of the root ENS name, e.g. "ignis" from "ignis.daemonium.eth". */
export function rootLabelOf(ensName: string | null | undefined): string {
  return ensName?.split('.')[0] || 'ignis';
}
