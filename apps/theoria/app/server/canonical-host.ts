import { HttpServerRequest, Url } from "@effect/platform"
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
 *
 * The hostname is the one the request's URL names (`originalUrl`, the URL of
 * the `Request` the Workers runtime handed over). The `Host` header is not
 * read: at the edge it agrees with the URL, but a local runtime answering on
 * its own address sets it to that address while the URL still names the host
 * asked for.
 */
export const requestIsCanonical: Effect.Effect<boolean, never, HttpServerRequest.HttpServerRequest> = Effect.gen(
  function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const host = yield* canonicalHost
    const url = yield* Effect.option(Url.fromString(request.originalUrl))
    return Option.exists(url, (named) => named.host === host)
  }
)
