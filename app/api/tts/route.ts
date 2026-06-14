/**
 * Text-to-speech for Ignis's spoken lines — ElevenLabs.
 *
 * Takes { text, voice? } (voice = an app voice id from app/lib/voices, default alien-3) and
 * streams back audio bytes (audio/mpeg) for the client to play through its AudioContext +
 * AnalyserNode. We use the eleven_flash_v2_5 model: ~75ms latency and ~half the per-character
 * cost of the standard models — the right fit for the client's per-sentence voice pipeline.
 *
 * The designed character voices (alien / wizard / pirate) live in the ElevenLabs library; we
 * reference them by voice_id (not secret). The API key (ELEVENLABS_API_KEY) stays server-side.
 */
import type { TtsRequest } from "@/app/lib/types";
import { resolveVoice } from "@/app/lib/voices";
import { withRoute } from "@/app/lib/observe";

export const runtime = "nodejs";
export const maxDuration = 30;

/** eleven_flash_v2_5: ultra-low latency (~75ms) and ~0.5 credit/char. mp3 decodes everywhere. */
const TTS_MODEL = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128";
const MAX_TEXT_LENGTH = 4096;

const speechUrl = (voiceId: string) =>
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`;

export const POST = withRoute("tts", postHandler);

async function postHandler(req: Request): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    // Fail clearly; the client falls back to a silent (text-only) reveal.
    return Response.json(
      { error: "TTS is not configured (missing ELEVENLABS_API_KEY)." },
      { status: 503 },
    );
  }

  let body: TtsRequest;
  try {
    body = (await req.json()) as TtsRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return Response.json({ error: "`text` is required." }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return Response.json(
      { error: `\`text\` exceeds ${MAX_TEXT_LENGTH} characters.` },
      { status: 413 },
    );
  }

  const voice = resolveVoice(body.voice);

  let upstream: Response;
  try {
    upstream = await fetch(speechUrl(voice.elevenVoiceId), {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text, model_id: TTS_MODEL }),
      signal: req.signal,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "TTS upstream request failed." },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    // Surface the provider's error text (JSON on failure) without leaking the key.
    const detail = await upstream.text().catch(() => "");
    return Response.json(
      { error: "TTS provider error.", status: upstream.status, detail: detail.slice(0, 500) },
      { status: 502 },
    );
  }

  // Stream the audio straight through to the client.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
