/**
 * Server-side verification of the Dynamic session JWT. This is the security boundary that
 * makes per-user dæmons safe: every wallet-touching route resolves the caller's identity here
 * and scopes all operations to that userId. Without this, anyone reaching /api/daemon/execute
 * could drive any wallet.
 *
 * The token (from the client's getAuthToken()) is an RS256 JWT we verify against Dynamic's
 * per-environment JWKS. We bind it to OUR environment and require the user:basic scope, per
 * Dynamic's server-verification guidance.
 */
import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

const ENV_ID = process.env.DYNAMIC_ENVIRONMENT_ID;

// Remote JWKS with built-in caching + key rotation (kid-based). Created lazily so a missing
// env var produces a clear error at request time, not at module load.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!ENV_ID) throw new AuthError("Server missing DYNAMIC_ENVIRONMENT_ID", 500);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://app.dynamic.xyz/api/v0/sdk/${ENV_ID}/.well-known/jwks`),
    );
  }
  return jwks;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401,
  ) {
    super(message);
  }
}

export interface DaemonUser {
  /** Dynamic userId (JWT `sub`) — the stable per-user key. */
  userId: string;
  email?: string;
}

function bearer(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) throw new AuthError("Missing bearer token");
  const token = header.slice(7).trim();
  if (!token) throw new AuthError("Empty bearer token");
  return token;
}

/** Verify the caller's Dynamic session and return their identity, or throw AuthError. */
export async function verifyUser(req: Request): Promise<DaemonUser> {
  const token = bearer(req);
  let payload;
  try {
    ({ payload } = await jwtVerify(token, getJwks(), { algorithms: ["RS256"] }));
  } catch (err) {
    throw new AuthError(`Invalid session token: ${err instanceof Error ? err.message : err}`);
  }

  // Bind to our environment (JWKS is already env-specific; this is belt-and-suspenders).
  if (payload.environment_id && payload.environment_id !== ENV_ID) {
    throw new AuthError("Token from a different environment");
  }
  // Require completed authentication.
  const scope = typeof payload.scope === "string" ? payload.scope.split(" ") : [];
  if (!scope.includes("user:basic")) {
    throw new AuthError("Token not fully authenticated (missing user:basic scope)");
  }
  if (!payload.sub) throw new AuthError("Token has no subject");

  return {
    userId: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}
