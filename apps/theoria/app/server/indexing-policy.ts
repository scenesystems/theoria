import { HttpMiddleware, HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"

import { requestIsCanonical } from "./canonical-host.js"

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
    const canonical = yield* requestIsCanonical
    const response = yield* app

    return canonical ? response : HttpServerResponse.setHeader(response, "x-robots-tag", "noindex")
  })
)
