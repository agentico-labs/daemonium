/**
 * Pure handle validation — NO server-only imports, so both the client modal and the server
 * route share one source of truth (fixes client/server validation drift).
 */

// 3–32 chars, lowercase alphanumerics + hyphen, no leading/trailing hyphen. ENS-label-safe.
export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

export const RESERVED = new Set([
  "admin", "minter", "daemonium", "ignis", "www", "api", "root", "system", "dynamic",
]);

export type HandleError = "invalid" | "reserved";

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Returns a machine code if invalid, else null. */
export function validateHandle(handle: string): HandleError | null {
  if (!HANDLE_RE.test(handle)) return "invalid";
  if (RESERVED.has(handle)) return "reserved";
  return null;
}

export const HANDLE_ERROR_MESSAGE: Record<HandleError, string> = {
  invalid: "3–32 chars: lowercase letters, numbers, and hyphens (not at the ends).",
  reserved: "That handle is reserved.",
};
