import { HttpServerResponse } from "@effect/platform"
import { Clock, Effect } from "effect"

import type { Metadata } from "../contracts/envelope.js"
import { RuntimeInfo } from "./config/runtime.js"

/** Envelope metadata for a response to the request that began at `startedAtMs`. */
export const responseMeta = (
  requestId: string,
  startedAtMs: number
): Effect.Effect<Metadata, never, RuntimeInfo> =>
  Effect.gen(function*() {
    const runtimeInfo = yield* RuntimeInfo
    const endedAtMs = yield* Clock.currentTimeMillis

    return { requestId, buildSha: runtimeInfo.buildSha, durationMs: endedAtMs - startedAtMs }
  })

/**
 * A JSON API response. Every API body carries request-specific metadata, so
 * none may be served from a cache.
 */
export const jsonResponse = (
  body: unknown,
  options: { readonly status?: number; readonly headers?: Record<string, string> } = {}
) =>
  HttpServerResponse.json(body, {
    status: options.status,
    headers: { "cache-control": "no-store", ...options.headers }
  })
