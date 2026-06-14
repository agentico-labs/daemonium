'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Flame } from '@/components/Flame';
import { IdentityBadge } from '@/components/IdentityBadge';
import { StatusPill } from '@/components/StatusPill';
import { MicButton } from '@/components/MicButton';
import { QuickActions } from '@/components/QuickActions';
import { ConfirmCard } from '@/components/ConfirmCard';
import { Onboarding } from '@/components/Onboarding';
import { VoicePicker } from '@/components/VoicePicker';
import { STATE_META } from '@/lib/stateMeta';
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";

import { useFlameDaemon } from './lib/useFlameDaemon';
import { useVoice } from './lib/useVoice';
import { useMic } from './lib/useMic';
import { useOnboarding } from './lib/useOnboarding';
import { explorerTx } from './lib/chain';
import { DEFAULT_VOICE_ID } from './lib/voices';


export default function Home() {
  const d = useFlameDaemon();
  const { user, setShowAuthFlow } = useDynamicContext();
  // Which character voice Ignis speaks in, persisted across sessions. Read from storage after
  // mount (not in the initializer) so server and first client render match — no hydration flash.
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  useEffect(() => {
    const saved = localStorage.getItem('ignis.voice');
    if (saved) setVoiceId(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem('ignis.voice', voiceId);
  }, [voiceId]);
  // Voice owns both the speech and the caption: it segments Ignis's streaming line into
  // sentences, speaks each as soon as it's ready, and reveals the text in sync with the audio.
  const voice = useVoice({ text: d.caption, busy: d.busy, voice: voiceId });
  const mic = useMic({ onTranscript: d.run, isSpeaking: voice.isSpeaking });

  const shellRef = useRef<HTMLDivElement>(null);
  const signedIn = !!user;

  // First-run gate: does this user have a fully provisioned dæmon yet?
  const onb = useOnboarding(signedIn);

  // The flame leads the onboarding: it "thinks" while the dæmon is being minted, the real mic
  // drives the `listening` overlay, and we cover the STT gap (audio stopped, transcript not
  // back yet) with `thinking` so the flame is never idle while a request is on its way.
  const flameState =
    onb.status === 'summoning'
      ? 'thinking'
      : d.state !== 'idle'
        ? d.state
        : mic.recording
          ? 'listening'
          : mic.transcribing
            ? 'thinking'
            : d.state;

  // Publish the live state color to CSS. Every glow reads var(--state); because
  // --state is a registered @property <color>, the whole room cross-fades.
  useEffect(() => {
    shellRef.current?.style.setProperty('--state', STATE_META[flameState].color);
  }, [flameState]);

  // Every tap is a chance to arm the iOS AudioContext (must happen in a gesture).
  const handleMic = useCallback(() => {
    voice.unlock();
    mic.toggle();
  }, [voice.unlock, mic.toggle]);

  const handlePick = useCallback(
    (text: string) => {
      voice.unlock();
      d.run(text);
    },
    [voice.unlock, d.run],
  );

  const handleSummon = useCallback(() => {
    voice.unlock();
    setShowAuthFlow(true);
  }, [voice.unlock, setShowAuthFlow]);

  return (
    <main
      ref={shellRef}
      className="relative mx-auto flex h-[100dvh] w-full max-w-md flex-col items-center overflow-hidden px-6 pt-[env(safe-area-inset-top)]"
      style={{ transition: '--state 600ms ease' }}
    >
      {/* ambient room glow the whole UI picks up, tinted by the state color */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          background:
            'radial-gradient(120% 78% at 50% 20%, color-mix(in srgb, var(--state, #ff7a18) 13%, transparent), transparent 60%)',
        }}
      />

      {/* voice picker — switch Ignis's character voice (with a one-tap preview) */}
      <div className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-20">
        <VoicePicker value={voiceId} onChange={setVoiceId} />
      </div>

      {/* upper third — flame, identity, status */}
      <section className="flex flex-1 flex-col items-center justify-center gap-6">
        <Flame state={flameState} getAmplitude={voice.getAmplitude} />
        <div className="flex flex-col items-center gap-3">
          <IdentityBadge ensName={onb.ensName} />
          <StatusPill state={flameState} label={d.label} />
        </div>
      </section>

      {/* middle — the confirm gate, else what Ignis says, plus tx + mic errors */}
      <div className="flex w-full flex-col items-center gap-2 px-2">
        {d.proposal ? (
          <ConfirmCard
            proposal={d.proposal}
            busy={d.busy}
            onConfirm={d.confirm}
            onDismiss={d.dismissProposal}
          />
        ) : (
          <div className="flex min-h-[2.75rem] items-center text-center">
            {voice.caption ? (
              <p className="text-pretty text-[15px] leading-snug text-white/75">
                {voice.caption}
              </p>
            ) : null}
          </div>
        )}

        {d.txResult ? <TxLine result={d.txResult} /> : null}
        {mic.error ? (
          <span className="text-[12px] text-red-400/80">{mic.error}</span>
        ) : null}
      </div>

      {/* lower third — summon gate (logged out) → onboarding (no dæmon yet) →
          mic + quick actions (provisioned) */}
      <section className="flex w-full flex-col items-center gap-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {!signedIn ? (
          <SummonGate onSummon={handleSummon} />
        ) : onb.status === 'ready' ? (
          <>
            <MicButton
              open={mic.recording}
              busy={d.busy || mic.transcribing}
              onToggle={handleMic}
            />
            <QuickActions busy={d.busy} onPick={handlePick} />
          </>
        ) : (
          <Onboarding
            status={onb.status}
            error={onb.error}
            reservedHandle={onb.reservedHandle}
            activeHandle={onb.activeHandle}
            onClaim={(h) => {
              voice.unlock();
              onb.claim(h);
            }}
            onRetry={onb.retry}
          />
        )}
      </section>
    </main>
  );
}

/** The logged-out call to action — wake your own Ignis (provisions the wallet). */
function SummonGate({ onSummon }: { onSummon: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <button
        type="button"
        onClick={onSummon}
        className="rounded-full px-7 py-3 text-sm font-semibold text-black transition active:scale-95"
        style={{
          background: 'var(--state, #ff7a18)',
          boxShadow: '0 0 30px color-mix(in srgb, var(--state, #ff7a18) 40%, transparent)',
        }}
      >
        Summon Ignis
      </button>
      <p className="text-[13px] text-white/45">
        Sign in to wake your dæmon and its wallet.
      </p>
    </div>
  );
}

/** Last confirmed action's outcome — a tappable tx link, or the error. */
function TxLine({
  result,
}: {
  result: { ok: boolean; hash?: string; error?: string };
}) {
  if (result.ok && result.hash) {
    return (
      <a
        href={explorerTx(result.hash)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[12px] text-emerald-400/90 hover:underline"
      >
        ✓ transaction confirmed — view on Etherscan
      </a>
    );
  }
  return (
    <span className="text-[12px] text-red-400/90">
      ✗ {result.error ?? 'the action failed'}
    </span>
  );
}
