import { Headers, HttpMiddleware, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Effect, Option } from "effect"

import { siteMetadata } from "../contracts/metadata.js"

const canonicalHost = new URL(siteMetadata.siteUrl).host

/**
 * Keeps every hostname other than the canonical site out of search indexes.
 *
 * Staging and pull-request previews serve the same Worker under other
 * hostnames. Directly served assets get the equivalent rule from
 * `public/_headers`; that file never applies to Worker-generated responses,
 * so the HTML shell, API, and sitemap are covered here.
 */
export const indexingPolicy = HttpMiddleware.make((app) =>
  Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const response = yield* app

    return Option.exists(Headers.get(request.headers, "host"), (host) => host === canonicalHost)
      ? response
      : HttpServerResponse.setHeader(response, "x-robots-tag", "noindex")
  })
)
