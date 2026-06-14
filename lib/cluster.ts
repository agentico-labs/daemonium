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
  /** Ring position 0–4 (the center is -1) — picks the node's staggered ambient timing. */
  ring: number;
}

/** The pentagram's five point positions (the design's coordinates), in placement order. */
const STAR_POINTS: Array<{ top: string; left: string; size: number }> = [
  { top: '10%', left: '50%', size: 54 }, // top
  { top: '37.6%', left: '88%', size: 48 }, // upper-right
  { top: '82.4%', left: '73.5%', size: 44 }, // lower-right
  { top: '82.4%', left: '26.5%', size: 36 }, // lower-left
  { top: '37.6%', left: '12%', size: 36 }, // upper-left
];

/**
 * Build the elemental star from the live roster: Ignis (fire) at the center, each sub-dæmon on
 * the next pentagram point (recolored to its element), and every remaining point an empty `+`
 * slot the summon ritual can fill. With no sub-dæmons yet, it's Ignis ringed by five open slots.
 */
export function buildStarNodes(daemons: ClusterDaemon[]): StarNode[] {
  const center: StarNode = { id: 'ignis', top: '50%', left: '50%', size: 80, element: 'fire', ring: -1 };
  const points = STAR_POINTS.map((p, i): StarNode => {
    const d = daemons[i];
    return d
      ? { id: d.id, ...p, element: d.element, ring: i }
      : { id: `slot-${i - daemons.length}`, ...p, element: null, slot: i - daemons.length, ring: i };
  });
  return [center, ...points];
}

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
  /** Live state — running threads render an indeterminate shimmer instead of a percent fill.
   *  Optional so the design-mock spells (no real lifecycle) still type-check. */
  status?: 'running' | 'done' | 'failed';
}

// ---- Live feed shapes (GET /api/daemon/cluster). Client-safe DTOs the server fills from the
//      wallet tree + the spell registry; the page maps them into the view-models above. ----

/** A sub-dæmon as the cluster endpoint reports it (the raw, transport shape). */
export interface ClusterDaemonDTO {
  /** Leaf label, e.g. "research" (row shows `${sub}.${rootLabel}`). */
  sub: string;
  ensName: string;
  address: string;
  /** Whether a spell is running for this dæmon right now. */
  status: 'working' | 'idle';
  doingNow: string;
  /** Seconds the current task has been running, or null when idle. */
  elapsedSec: number | null;
}

/** A live/recent spell as the endpoint reports it. */
export interface SpellDTO {
  id: string;
  title: string;
  /** Acting sub-dæmon's leaf label. */
  agent: string;
  status: 'running' | 'done' | 'failed';
  elapsedSec: number;
  summary?: string;
}

export interface ClusterResponse {
  rootLabel: string;
  daemons: ClusterDaemonDTO[];
  spells: SpellDTO[];
}

/** Elements handed to sub-dæmons in roster order (Ignis is always fire, at the center). */
const SUB_ELEMENTS: Element[] = ['blue', 'green', 'purple', 'blue', 'green'];
export function elementForIndex(i: number): Element {
  return SUB_ELEMENTS[i % SUB_ELEMENTS.length];
}

/** mm:ss for live durations, e.g. 42 → "0:42", 188 → "3:08". */
export function formatElapsed(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Map the endpoint's roster DTOs into the roster view-model (assigning elements by order). */
export function toClusterDaemons(dtos: ClusterDaemonDTO[]): ClusterDaemon[] {
  return dtos.map((d, i) => ({
    id: d.sub,
    sub: d.sub,
    element: elementForIndex(i),
    doingNow: d.doingNow,
    status: d.status,
    elapsed: d.elapsedSec != null ? formatElapsed(d.elapsedSec) : '—',
  }));
}

/** Map the endpoint's spell DTOs into the spell-thread view-model. */
export function toSpells(dtos: SpellDTO[], rootLabel: string): Spell[] {
  return dtos.map((s) => {
    const running = s.status === 'running';
    const failed = s.status === 'failed';
    return {
      id: s.id,
      title: s.title,
      elapsed: formatElapsed(s.elapsedSec),
      percent: running ? 100 : failed ? 0 : 100,
      description:
        s.summary ?? (running ? 'working…' : failed ? 'failed' : 'done'),
      tone: s.agent === rootLabel ? 'ignis' : 'ember',
      status: s.status,
    };
  });
}

/** "2 active · 1 done" — the live spell summary line. */
export function spellSummary(dtos: SpellDTO[]): string {
  const active = dtos.filter((s) => s.status === 'running').length;
  const settled = dtos.length - active;
  const parts: string[] = [];
  if (active) parts.push(`${active} active`);
  if (settled) parts.push(`${settled} recent`);
  return parts.join(' · ') || 'none active';
}

// The roster + spells are live now — fed by GET /api/daemon/cluster through app/lib/useCluster.ts
// and mapped via toClusterDaemons / toSpells above. (The old hardcoded MOCK_DAEMONS / MOCK_SPELLS
// design-handoff placeholders lived here and have been removed.)

/** Leaf label of the root ENS name, e.g. "ignis" from "ignis.daemonium.eth". */
export function rootLabelOf(ensName: string | null | undefined): string {
  return ensName?.split('.')[0] || 'ignis';
}
