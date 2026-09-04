import { Headers, HttpServerRequest, Url } from "@effect/platform"
import { Effect, Option } from "effect"

import { siteMetadata } from "../contracts/metadata.js"

/** The production hostname; `siteUrl` is a checked constant, so a parse failure is a defect. */
const canonicalHost: Effect.Effect<string> = Effect.map(Url.fromString(siteMetadata.siteUrl), (url) => url.host).pipe(
  Effect.orDie
)

/**
 * Whether the current request arrived on the canonical production hostname.
 * Staging and pull-request previews run the same Worker under other hostnames;
 * they must stay out of search indexes and out of analytics.
 */
export const requestIsCanonical: Effect.Effect<boolean, never, HttpServerRequest.HttpServerRequest> = Effect.gen(
  function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const host = yield* canonicalHost
    return Option.exists(Headers.get(request.headers, "host"), (requestHost) => requestHost === host)
  }
)
