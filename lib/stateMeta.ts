import type { DaemonState } from '@/app/lib/types';

export interface StateMeta {
  /** Default status-pill copy for this state (an event may override via label). */
  label: string;
  /** The room color for this state — drives every glow via --state. */
  color: string;
}

/**
 * The 7 DaemonStates → their copy + color.
 * Mirrors the mapping in NOTE_FOR_MYSELF.md:
 *   idle=orange · listening=green · thinking/executing=blue ·
 *   delegating=indigo · success=bright green · error=red.
 */
export const STATE_META: Record<DaemonState, StateMeta> = {
  idle: { label: 'Idle', color: '#ff7a18' },
  listening: { label: 'Listening…', color: '#34d399' },
  thinking: { label: 'Thinking…', color: '#4f8cff' },
  delegating: { label: 'Consulting research…', color: '#7c83ff' },
  executing: { label: 'Acting onchain…', color: '#4f8cff' },
  success: { label: 'Done', color: '#2bd576' },
  error: { label: 'Something went wrong', color: '#ff5a5a' },
};

/**
 * Ignis wears three moods, each its own folder under public/daemon/. State
 * identity comes from the color (--state) + per-state motion params, so several
 * states share one mood: calm (the idle folder) covers idle / listening /
 * thinking / delegating / executing, happy = success, concerned = error.
 *
 * Each mood folder holds the layered webp art (1024², straight alpha): full
 * (flat fallback composite), core (the stable face/body), tips (the licking
 * flame that gets distorted), glow (soft aura). The core also carries the cel
 * frames that make the face move: core-talk (mouth open) for every mood, and
 * core-blink (eyes closed) for the moods whose neutral has open eyes.
 */
export type ExpressionKey = 'idle' | 'happy' | 'concerned';

/** Moods whose neutral face has open eyes, so an eyes-closed blink frame fits. */
const MOODS_WITH_BLINK = new Set<ExpressionKey>(['idle', 'concerned']);

export interface ExpressionAssets {
  full: string;
  core: string;
  coreTalk: string;
  coreBlink?: string;
  tips: string;
  glow: string;
}

export function expressionAssets(key: ExpressionKey): ExpressionAssets {
  const base = `/daemon/${key}`;
  const assets: ExpressionAssets = {
    full: `${base}/full.webp`,
    core: `${base}/core.webp`,
    coreTalk: `${base}/core-talk.webp`,
    tips: `${base}/tips.webp`,
    glow: `${base}/glow.webp`,
  };
  if (MOODS_WITH_BLINK.has(key)) assets.coreBlink = `${base}/core-blink.webp`;
  return assets;
}

/** Which mood each DaemonState wears. */
export const STATE_EXPRESSION: Record<DaemonState, ExpressionKey> = {
  idle: 'idle',
  listening: 'idle',
  thinking: 'idle',
  delegating: 'idle',
  executing: 'idle',
  success: 'happy',
  error: 'concerned',
};

/** State → flat composite URL (the no-WebGL fallback image). */
export const STATE_IMAGE: Record<DaemonState, string> = {
  idle: expressionAssets('idle').full,
  listening: expressionAssets('idle').full,
  thinking: expressionAssets('idle').full,
  delegating: expressionAssets('idle').full,
  executing: expressionAssets('idle').full,
  success: expressionAssets('happy').full,
  error: expressionAssets('concerned').full,
};
