"use client";

/**
 * Ignis's voice — and the caption that appears *in lockstep with it*.
 *
 * The problem this solves: the agent streams its line token-by-token, but speech used to wait
 * for the WHOLE turn to finish, then synthesize the whole paragraph, then play. Measured, that
 * left the voice starting 4–12s after you stopped talking, with the text already fully on
 * screen for seconds. Two fixes, both here:
 *
 *  1. PIPELINE. We segment the streaming text into sentences as they complete and synthesize
 *     each one the moment it's ready (TTS has a ~1s floor but is otherwise flat for short
 *     clips, so the first sentence speaks ~1.5s sooner than the full paragraph would). While
 *     sentence N plays, N+1… are already being fetched, so the line flows without gaps.
 *  2. SYNC. The on-screen caption is NOT the raw stream — it is revealed one sentence at a
 *     time, exactly when that sentence's audio begins. Text appears as Ignis says it.
 *
 * Pipeline per sentence: POST /api/tts -> mp3 -> decodeAudioData -> AudioBufferSourceNode ->
 * AnalyserNode -> destination. The analyser feeds getAmplitude() for the flame's lip-sync.
 *
 * Graceful degradation: if Web Audio is unavailable or a /api/tts call fails, the sentence is
 * still revealed (paced to a readable speed) so the caption never stalls — the demo survives a
 * dead mic or a missing key, just silently.
 *
 * React-best-practices: caption + isSpeaking are UI state; everything transient (audio nodes,
 * the play queue, segmentation cursor) lives in refs so the flame never re-renders from them.
 * The only effect trigger is the (text, busy) pair; all callbacks are stable.
 *
 * iOS Safari: AudioContext only starts inside a user gesture — call unlock() from a tap
 * (Summon / mic / quick-action / claim) to arm it for the session.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** One spoken unit: a sentence, its cumulative caption, and its (prefetched) decoded audio. */
interface QueueItem {
  /** Cumulative text to show when this unit starts (the line built up through this sentence). */
  display: string;
  /** Length of just this sentence, for pacing the silent fallback. */
  len: number;
  /** The turn this belongs to; a reset bumps the turn token and stale items are dropped. */
  turn: number;
  /** Decoded audio, or null if synthesis failed / Web Audio is unavailable. */
  audio: Promise<AudioBuffer | null>;
  /** Aborts the in-flight /api/tts fetch on reset/interrupt. */
  controller: AbortController;
}

export interface UseVoice {
  /** The caption to render — revealed sentence-by-sentence, synced to playback. */
  caption: string;
  /** True while audio is actively playing (half-duplex hint for the mic). */
  isSpeaking: boolean;
  /** Live voice amplitude 0..1; transient, call per animation frame. 0 when silent. */
  getAmplitude: () => number;
  /** Arm/resume the AudioContext from inside a user gesture (required on iOS Safari). */
  unlock: () => void;
}

/** Lazily create the shared AudioContext (one per page is plenty). */
function makeContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

/**
 * Find sentence-boundary offsets in `s` at or after `from`. A boundary is end-punctuation
 * (.!?…) optionally trailed by a closing quote/bracket, then whitespace — or a newline run.
 * While the model is still streaming (`requireTrailingSpace`), we require real whitespace
 * after the punctuation so we don't cut a sentence that the next token will continue
 * ("12." about to become "12.5"); at turn end we relax that and flush the tail separately.
 */
function sentenceEnds(s: string, from: number, requireTrailingSpace: boolean): number[] {
  const re = requireTrailingSpace
    ? /[.!?…]+["'”’)\]]*\s|\n+/g
    : /[.!?…]+["'”’)\]]*(?:\s|$)|\n+/g;
  re.lastIndex = from;
  const ends: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    ends.push(re.lastIndex);
    if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-width loops
  }
  return ends;
}

export function useVoice({
  text,
  busy,
  voice,
}: {
  /** The agent's latest line, as it streams (the source we segment + speak). */
  text: string | null;
  /** Whether a turn is in flight. Its true->false edge flushes the final sentence. */
  busy: boolean;
  /** Selected character voice id (app id from lib/voices); sent to /api/tts per sentence. */
  voice?: string;
}): UseVoice {
  const [caption, setCaption] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Audio graph (shared for the page lifetime).
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  // Scratch buffer reused across amplitude reads to avoid per-frame allocation.
  const ampBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  // Play queue + turn bookkeeping.
  const queueRef = useRef<QueueItem[]>([]);
  const playingRef = useRef(false);
  const turnRef = useRef(0);

  // Segmentation cursor over the streaming text.
  const cursorRef = useRef(0);
  const prevTextRef = useRef("");
  const prevBusyRef = useRef(busy);

  // Latest selected voice, read inside synthesize so changing it never re-creates callbacks.
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  /** Ensure ctx + analyser exist and the ctx is running. Returns null if unsupported. */
  const ensureContext = useCallback((): AudioContext | null => {
    if (!ctxRef.current) {
      const ctx = makeContext();
      if (!ctx) return null;
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.8;
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      ampBufRef.current = new Uint8Array(analyser.fftSize);
    }
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const unlock = useCallback(() => {
    ensureContext();
  }, [ensureContext]);

  /** Tear down the current source node (without closing the shared context). */
  const stopSource = useCallback(() => {
    const src = sourceRef.current;
    if (src) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      try {
        src.disconnect();
      } catch {
        /* already disconnected */
      }
      sourceRef.current = null;
    }
  }, []);

  /** Synthesize one sentence to a decoded buffer. Null on any failure (caller falls back). */
  const synthesize = useCallback(
    async (sentence: string, signal: AbortSignal): Promise<AudioBuffer | null> => {
      const ctx = ensureContext();
      if (!ctx || !analyserRef.current) return null;
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sentence, voice: voiceRef.current }),
          signal,
        });
        if (!res.ok) return null;
        const encoded = await res.arrayBuffer();
        if (signal.aborted) return null;
        return await ctx.decodeAudioData(encoded);
      } catch {
        return null; // aborted, network, or decode error — degrade to a silent reveal
      }
    },
    [ensureContext],
  );

  /** Play one decoded buffer; resolves when it ends. */
  const playBuffer = useCallback((buffer: AudioBuffer): Promise<void> => {
    return new Promise((resolve) => {
      const ctx = ctxRef.current;
      const analyser = analyserRef.current;
      if (!ctx || !analyser) {
        resolve();
        return;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(analyser);
      sourceRef.current = src;
      src.onended = () => {
        if (sourceRef.current === src) sourceRef.current = null;
        resolve();
      };
      setIsSpeaking(true);
      src.start();
    });
  }, []);

  /** Drain the queue in order, revealing each caption exactly as its audio begins. */
  const playLoop = useCallback(async () => {
    if (playingRef.current) return;
    playingRef.current = true;
    while (queueRef.current.length) {
      const item = queueRef.current.shift();
      if (!item) break;
      let buffer: AudioBuffer | null = null;
      try {
        buffer = await item.audio;
      } catch {
        buffer = null;
      }
      if (item.turn !== turnRef.current) continue; // a reset superseded this turn

      setCaption(item.display); // reveal in sync with the voice
      if (buffer) {
        await playBuffer(buffer);
      } else {
        // Silent fallback: pace the reveal so the text doesn't flash all at once.
        const wait = Math.min(3500, Math.max(650, item.len * 38));
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    playingRef.current = false;
    setIsSpeaking(false);
  }, [playBuffer]);

  /** Queue a sentence: start its synthesis immediately (prefetch) and kick the player. */
  const enqueue = useCallback(
    (sentence: string, display: string) => {
      const controller = new AbortController();
      const item: QueueItem = {
        display,
        len: sentence.length,
        turn: turnRef.current,
        audio: synthesize(sentence, controller.signal),
        controller,
      };
      queueRef.current.push(item);
      if (!playingRef.current) void playLoop();
    },
    [synthesize, playLoop],
  );

  /** Clear the stage for a new turn: drop the queue, stop audio, reset the caption + cursor. */
  const reset = useCallback(() => {
    turnRef.current += 1;
    for (const it of queueRef.current) it.controller.abort();
    queueRef.current = [];
    stopSource();
    playingRef.current = false;
    cursorRef.current = 0;
    prevTextRef.current = "";
    setIsSpeaking(false);
    setCaption("");
  }, [stopSource]);

  // Segment the streaming text into sentences and feed the voice. The sole trigger is the
  // (text, busy) pair; everything it touches is a ref or a stable callback.
  useEffect(() => {
    const wasBusy = prevBusyRef.current;
    prevBusyRef.current = busy;

    // A rising busy edge means a fresh turn is starting — wipe the previous line.
    if (busy && !wasBusy) reset();

    const full = text ?? "";
    // If the text isn't an extension of what we had, realign the cursor (turn boundary).
    if (!full.startsWith(prevTextRef.current)) cursorRef.current = 0;
    prevTextRef.current = full;
    if (!full) return;

    // While streaming we only cut on punctuation followed by whitespace; at turn end we
    // also accept end-of-string and then flush whatever tail remains.
    for (const end of sentenceEnds(full, cursorRef.current, busy)) {
      const sentence = full.slice(cursorRef.current, end).trim();
      cursorRef.current = end;
      if (sentence) enqueue(sentence, full.slice(0, end).trim());
    }
    if (!busy) {
      const tail = full.slice(cursorRef.current).trim();
      if (tail) {
        enqueue(tail, full.trim());
        cursorRef.current = full.length;
      }
    }
  }, [text, busy, enqueue, reset]);

  const getAmplitude = useCallback((): number => {
    const analyser = analyserRef.current;
    const buf = ampBufRef.current;
    if (!analyser || !buf || !sourceRef.current) return 0;
    analyser.getByteTimeDomainData(buf);
    let sumSquares = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / buf.length);
    return Math.min(1, rms * 2.2);
  }, []);

  // Tear down on unmount: abort fetches, stop playback, close the context.
  useEffect(() => {
    return () => {
      for (const it of queueRef.current) it.controller.abort();
      queueRef.current = [];
      stopSource();
      const ctx = ctxRef.current;
      if (ctx && ctx.state !== "closed") void ctx.close();
      ctxRef.current = null;
    };
  }, [stopSource]);

  return { caption, isSpeaking, getAmplitude, unlock };
}
