"use client";

/**
 * Bridges the agent's streaming text to TTS: speaks Ignis's latest line aloud once it is
 * FINAL, never the partial stream.
 *
 * The agent's words arrive token-by-token, so `caption` changes many times per turn. We only
 * want to synthesize the completed line, exactly once. The reliable completion edge is `busy`
 * going true -> false (a turn finished streaming); at that moment the current `caption` is the
 * final assistant line, so we speak it. A ref remembers the last line we spoke so the same
 * text is never re-spoken (e.g. on unrelated re-renders).
 *
 * Speaking is a real external side effect gated on a state transition, so an effect is the
 * right tool here. Transient bookkeeping (previous-busy, last-spoken) lives in refs.
 *
 * Wiring (see report): in the page, after `const d = useFlameDaemon()` and a `useTts()`, add
 *   useSpeakOnNewLine(d.caption, d.busy, tts.speak);
 * and call `tts.unlock()` inside the existing button tap handlers (Summon / mic / actions).
 */
import { useEffect, useRef } from "react";

export function useSpeakOnNewLine(
  caption: string | null,
  busy: boolean,
  speak: (text: string) => Promise<void> | void,
): void {
  const prevBusyRef = useRef(busy);
  const lastSpokenRef = useRef<string | null>(null);
  // Keep the latest caption/speak readable from the effect without making them deps that
  // re-fire it; the trigger is solely the busy edge.
  const captionRef = useRef(caption);
  const speakRef = useRef(speak);
  captionRef.current = caption;
  speakRef.current = speak;

  useEffect(() => {
    const wasBusy = prevBusyRef.current;
    prevBusyRef.current = busy;

    // Only act on the streaming-finished edge (busy: true -> false).
    if (!(wasBusy && !busy)) return;

    const line = captionRef.current?.trim();
    if (!line || line === lastSpokenRef.current) return;

    lastSpokenRef.current = line;
    void speakRef.current(line);
  }, [busy]);
}
