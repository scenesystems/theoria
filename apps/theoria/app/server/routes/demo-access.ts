import type { HttpServerRequest } from "@effect/platform"
import { Effect, Match, Option, Schema } from "effect"

import { ErrorCode } from "../../contracts/error.js"
import { Id } from "../../contracts/id.js"
import { serverReleaseStage } from "../config/release-stage.js"
import { DemoRateLimiter } from "../demos/rate-limiter.js"
import { lookupForReleaseStage } from "../demos/registry.js"

export const DemoEndpoint = Schema.Literal("run", "preload", "stream")

export type DemoEndpoint = typeof DemoEndpoint.Type

export const DemoRouteAccess = Schema.Struct({
  id: Id,
  endpoint: DemoEndpoint
})

export type DemoRouteAccess = typeof DemoRouteAccess.Type

export const DemoAccessRejection = Schema.Struct({
  code: ErrorCode,
  message: Schema.String,
  allow: Schema.optional(Schema.String),
  retryAfterSeconds: Schema.optional(Schema.Number)
})

export type DemoAccessRejection = typeof DemoAccessRejection.Type

const expectedMethod = (endpoint: DemoEndpoint): "GET" | "POST" =>
  Match.value(endpoint).pipe(
    Match.when("run", (): "POST" => "POST"),
    Match.orElse((): "GET" => "GET")
  )

const executesDemo = (endpoint: DemoEndpoint): boolean => endpoint === "run" || endpoint === "stream"

const methodRejection = (endpoint: DemoEndpoint): DemoAccessRejection => {
  const allow = expectedMethod(endpoint)

  return {
    code: "method-not-allowed",
    message: `Demo ${endpoint} requests must use ${allow}.`,
    allow
  }
}

const crossSiteRejection: DemoAccessRejection = {
  code: "cross-site-request",
  message: "Cross-site demo execution is not allowed."
}

const rateLimitRejection = (retryAfterSeconds: number): DemoAccessRejection => ({
  code: "rate-limited",
  message: "Demo request rate limit exceeded.",
  retryAfterSeconds
})

const clientId = (request: HttpServerRequest.HttpServerRequest): string =>
  Option.getOrElse(request.remoteAddress, () => "unknown-client")

export const authorizeDemoRequest = (
  route: DemoRouteAccess,
  request: HttpServerRequest.HttpServerRequest
): Effect.Effect<Option.Option<DemoAccessRejection>, never, DemoRateLimiter> =>
  Effect.gen(function*() {
    if (request.method !== expectedMethod(route.endpoint)) {
      return Option.some(methodRejection(route.endpoint))
    }

    if (executesDemo(route.endpoint) && request.headers["sec-fetch-site"] === "cross-site") {
      return Option.some(crossSiteRejection)
    }

    if (!executesDemo(route.endpoint)) {
      return Option.none()
    }

    const releaseStage = yield* serverReleaseStage
    const definition = lookupForReleaseStage(route.id, releaseStage)

    if (Option.isNone(definition)) {
      return Option.none()
    }

    const result = yield* DemoRateLimiter.pipe(
      Effect.flatMap((limiter) => limiter.check(definition.value.lane, clientId(request)))
    )

    return result.allowed
      ? Option.none()
      : Option.some(rateLimitRejection(result.retryAfterSeconds))
  })
