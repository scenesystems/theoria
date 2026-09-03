import { Headers, HttpServerRequest } from "@effect/platform"
import { Effect, Option } from "effect"

import { siteMetadata } from "../contracts/metadata.js"

const canonicalHost = new URL(siteMetadata.siteUrl).host

/**
 * Whether the current request arrived on the canonical production hostname.
 * Staging and pull-request previews run the same Worker under other hostnames;
 * they must stay out of search indexes and out of analytics.
 */
export const requestIsCanonical: Effect.Effect<boolean, never, HttpServerRequest.HttpServerRequest> = Effect.map(
  HttpServerRequest.HttpServerRequest,
  (request) => Option.exists(Headers.get(request.headers, "host"), (host) => host === canonicalHost)
)
