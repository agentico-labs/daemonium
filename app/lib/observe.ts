/**
 * Makes an API route observable. Wrap a handler at its export:
 *
 *     async function postHandler(req: Request) { ... }
 *     export const POST = withRoute("execute", postHandler);
 *
 * For every request it logs one line in and one line out with the HTTP status and
 * wall-clock ms, and echoes a short trace id back as the `x-trace-id` header so a client
 * report can be matched to a server log. Crucially, a failing route is never silent:
 *   - a thrown error is caught, logged WITH its stack, and returned as a clean
 *     { error, traceId } 500 (so an invalid body or unexpected throw is visible), and
 *   - a handled 4xx/5xx JSON response has its `error` field surfaced into the log too —
 *     no need to touch each route's own try/catch to find out *why* it failed.
 *
 * Streaming responses (the agent route) are left untouched — only their envelope (status
 * + time-to-first-byte) is logged here; mid-stream errors are logged inside that route.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { createLogger } from "./log";

export function withRoute<A extends unknown[]>(
  name: string,
  handler: (req: Request, ...args: A) => Response | Promise<Response>,
): (req: Request, ...args: A) => Promise<Response> {
  return async (req: Request, ...args: A): Promise<Response> => {
    const traceId = randomUUID().slice(0, 8);
    const log = createLogger(name, traceId);
    const method = req.method;
    let path = req.url;
    try {
      path = new URL(req.url).pathname;
    } catch {
      // keep the raw url if it won't parse
    }
    const started = Date.now();
    log.info(`→ ${method} ${path}`);

    try {
      const res = await handler(req, ...args);
      const ms = Date.now() - started;
      try {
        res.headers.set("x-trace-id", traceId);
      } catch {
        // some responses (streams) have immutable headers — fine, skip it
      }

      if (res.status >= 400) {
        let detail: unknown;
        if ((res.headers.get("content-type") ?? "").includes("application/json")) {
          detail = await res
            .clone()
            .json()
            .then((j) => j?.error)
            .catch(() => undefined);
        }
        const level = res.status >= 500 ? "error" : "warn";
        log[level](
          `← ${method} ${path} ${res.status} (${ms}ms)`,
          detail ? { error: detail } : undefined,
        );
      } else {
        log.info(`← ${method} ${path} ${res.status} (${ms}ms)`);
      }
      return res;
    } catch (err) {
      const ms = Date.now() - started;
      log.error(`✖ ${method} ${path} threw (${ms}ms)`, err);
      return Response.json(
        { error: err instanceof Error ? err.message : "Internal error", traceId },
        { status: 500, headers: { "x-trace-id": traceId } },
      );
    }
  };
}
