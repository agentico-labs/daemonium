'use client';

/**
 * Live cluster feed for the Cluster screen. Polls GET /api/daemon/cluster and maps the transport
 * DTOs into the screen's view-models (roster + spell threads), so the components stay the same
 * shape they had against the old mock — only the source changed. Empty until a sub-dæmon exists.
 */
import { useEffect, useState } from 'react';
import { authHeaders } from './daemon-client';
import {
  toClusterDaemons,
  toSpells,
  spellSummary,
  type ClusterResponse,
  type ClusterDaemon,
  type Spell,
} from '@/lib/cluster';

export interface ClusterView {
  daemons: ClusterDaemon[];
  spells: Spell[];
  summary: string;
}

const EMPTY: ClusterView = { daemons: [], spells: [], summary: 'none active' };
const POLL_MS = 6_000;

export function useCluster(opts: { enabled: boolean; rootLabel: string }): ClusterView {
  const { enabled, rootLabel } = opts;
  const [view, setView] = useState<ClusterView>(EMPTY);

  useEffect(() => {
    if (!enabled) {
      setView(EMPTY);
      return;
    }
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch('/api/daemon/cluster', { headers: authHeaders() });
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as ClusterResponse;
        if (cancelled) return;
        setView({
          daemons: toClusterDaemons(data.daemons),
          spells: toSpells(data.spells, rootLabel),
          summary: spellSummary(data.spells),
        });
      } catch {
        // Network blip — keep the last view, try again next tick.
      }
    };

    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, rootLabel]);

  return view;
}
