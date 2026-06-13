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
 * The five Ignis expressions. Each lives in its own folder under public/daemon/
 * as four 1024² transparent webp layers: full (flat composite), core (stable
 * body + face), tips (the licking flame that gets distorted), glow (soft aura).
 */
export type ExpressionKey =
  | 'idle' | 'listening' | 'thinking' | 'happy' | 'concerned';

export interface ExpressionAssets {
  full: string;
  core: string;
  tips: string;
  glow: string;
}

export function expressionAssets(key: ExpressionKey): ExpressionAssets {
  const base = `/daemon/${key}`;
  return {
    full: `${base}/full.webp`,
    core: `${base}/core.webp`,
    tips: `${base}/tips.webp`,
    glow: `${base}/glow.webp`,
  };
}

/** Which expression each DaemonState wears. */
export const STATE_EXPRESSION: Record<DaemonState, ExpressionKey> = {
  idle: 'idle',
  listening: 'listening',
  thinking: 'thinking',
  delegating: 'thinking',
  executing: 'thinking',
  success: 'happy',
  error: 'concerned',
};

/** State → flat composite URL (the PNG fallback + the renderer's base texture). */
export const STATE_IMAGE: Record<DaemonState, string> = {
  idle: expressionAssets('idle').full,
  listening: expressionAssets('listening').full,
  thinking: expressionAssets('thinking').full,
  delegating: expressionAssets('thinking').full,
  executing: expressionAssets('thinking').full,
  success: expressionAssets('happy').full,
  error: expressionAssets('concerned').full,
};
