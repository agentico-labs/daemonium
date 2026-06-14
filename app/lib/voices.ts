/**
 * Ignis's selectable character voices (ElevenLabs). Shared by the picker (client) and the TTS
 * route (server): the client sends an app `id` (e.g. "alien-3"), the route maps it to the
 * ElevenLabs library `voice_id`. The voice_id is NOT a secret — only ELEVENLABS_API_KEY is — so
 * this can live in the shared bundle.
 *
 * The three characters (alien / wizard / pirate) were made with ElevenLabs Voice Design and
 * persisted to permanent library voices. `alien-3` is the default.
 */
export type VoiceCharacter = "Alien" | "Wizard" | "Pirate";

export interface VoiceOption {
  /** App-facing id sent in TtsRequest.voice and stored in the picker. */
  id: string;
  /** Short label for the picker. */
  label: string;
  character: VoiceCharacter;
  /** ElevenLabs library voice_id rendered by /api/tts. */
  elevenVoiceId: string;
}

export const VOICES: VoiceOption[] = [
  { id: "alien-1", label: "Alien 1", character: "Alien", elevenVoiceId: "NH6popEfbzjv2gskOww7" },
  { id: "alien-2", label: "Alien 2", character: "Alien", elevenVoiceId: "GPDPirLLJlIISyDC9HqJ" },
  { id: "alien-3", label: "Alien 3", character: "Alien", elevenVoiceId: "Uh56wCvSjKk4V1Pu9C7T" },
  { id: "wizard-1", label: "Wizard 1", character: "Wizard", elevenVoiceId: "KC8O19D4jcvynsOoSQKN" },
  { id: "wizard-2", label: "Wizard 2", character: "Wizard", elevenVoiceId: "TvgfGpHzNNT2g7AilOyV" },
  { id: "wizard-3", label: "Wizard 3", character: "Wizard", elevenVoiceId: "Pp92vPPI3gFOrpVmpFYr" },
  { id: "pirate-1", label: "Pirate 1", character: "Pirate", elevenVoiceId: "CPsMhdTi481MMCf9LVUz" },
  { id: "pirate-2", label: "Pirate 2", character: "Pirate", elevenVoiceId: "u03JQWUZJVW8Lwpww1YE" },
  { id: "pirate-3", label: "Pirate 3", character: "Pirate", elevenVoiceId: "MkRNVFkmdEgMnBNV8npF" },
];

/** The default voice id (Ignis speaks in this unless the user picks another). */
export const DEFAULT_VOICE_ID = "alien-3";

/** The character order the picker groups by. */
export const VOICE_CHARACTERS: VoiceCharacter[] = ["Alien", "Wizard", "Pirate"];

/** Resolve an app voice id to its option, falling back to the default. */
export function resolveVoice(id?: string): VoiceOption {
  return (
    VOICES.find((v) => v.id === id) ??
    VOICES.find((v) => v.id === DEFAULT_VOICE_ID)!
  );
}
