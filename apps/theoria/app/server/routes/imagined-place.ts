import { type HttpServerError, HttpServerRequest } from "@effect/platform"
import type { Cipher } from "@scenesystems/seal"
import { Boolean as Bool, Clock, Effect, Either, Equal, Match, Option, Schema } from "effect"
import * as ParseResult from "effect/ParseResult"

import { ErrorModel, httpStatus } from "../../contracts/error.js"
import type { PlaceBuild, PlaceBuildEnvelope } from "../../contracts/imagined-place-result.js"
import type { PlaceBuildError } from "../../contracts/imagined-place.js"
import { PlaceBuildRequest } from "../../contracts/imagined-place.js"
import { jsonResponse, responseMeta } from "../api-response.js"
import { PlaceBuildLimiter, type PlaceBuildLimiterError } from "../config/place-build-limiter.js"
import type { Participants } from "../imagined-place/authority.js"
import { buildPlace } from "../imagined-place/run.js"

/**
 * `POST /api/imagined-place/build`: the home-page demo. The body is a
 * `PlaceBuildRequest`; the response is an envelope around a `PlaceBuild`.
 *
 * Rendering is not served here. The browser draws the place with its own font
 * metrics, and nothing about presentation reaches the server, so a content ID
 * can never depend on a screen. What the server does own is the participants'
 * session keys, which is why signing and sealing stay on this side.
 *
 * The build is the only CPU-bound work the site does, and it is anonymous, so
 * each request first asks the `PlaceBuildLimiter` for admission by client
 * address. A refusal is `429` with `retry-after`; the request body is not read.
 */
export const imaginedPlacePath = "/api/imagined-place/build"

/** Set by Cloudflare on every request; absent only when the app runs outside the edge. */
const clientAddressHeader = "cf-connecting-ip"

const Rejection = Schema.Struct({
  error: ErrorModel,
  headers: Schema.Record({ key: Schema.String, value: Schema.String })
})
type Rejection = typeof Rejection.Type

const respond = (envelope: PlaceBuildEnvelope, headers: Record<string, string>) =>
  jsonResponse(envelope, {
    status: Match.value(envelope).pipe(
      Match.when({ ok: true }, () => 200),
      Match.when({ ok: false }, ({ error }) => httpStatus(error.code)),
      Match.exhaustive
    ),
    headers
  })

const methodRejection: Rejection = {
  error: { code: "method-not-allowed", message: "Place builds must use POST.", retryable: false },
  headers: { allow: "POST" }
}

const crossSiteRejection: Rejection = {
  error: { code: "cross-site-request", message: "Cross-site place builds are not allowed.", retryable: false },
  headers: {}
}

const rateLimitRejection = (retryAfterSeconds: number): Rejection => ({
  error: {
    code: "rate-limited",
    message: `Too many place builds from this address. Try again in ${String(retryAfterSeconds)} seconds.`,
    retryable: true
  },
  headers: { "retry-after": String(retryAfterSeconds) }
})

/** The limiter is a backstop for anonymous CPU work; when it cannot decide, the build is not attempted. */
const undecidedAdmission = (failure: PlaceBuildLimiterError): Rejection => ({
  error: { code: "execution-failed", message: `Place build admission failed: ${failure.detail}`, retryable: true },
  headers: {}
})

const unreadableBody: ErrorModel = {
  code: "invalid-request",
  message: "Place build request body could not be read.",
  retryable: false
}

const accessRejection = (request: HttpServerRequest.HttpServerRequest): Option.Option<Rejection> =>
  Bool.match(Bool.not(Equal.equals(request.method, "POST")), {
    onTrue: () => Option.some(methodRejection),
    onFalse: () =>
      Bool.match(Equal.equals(request.headers["sec-fetch-site"], "cross-site"), {
        onTrue: () => Option.some(crossSiteRejection),
        onFalse: Option.none
      })
  })

/** Asks the limiter for admission; requests without a client address share one bucket. */
const admission = (
  request: HttpServerRequest.HttpServerRequest
): Effect.Effect<Option.Option<Rejection>, never, PlaceBuildLimiter> =>
  Effect.gen(function*() {
    const limiter = yield* PlaceBuildLimiter
    const actor = Option.getOrElse(Option.fromNullable(request.headers[clientAddressHeader]), () => "unknown-client")
    const decision = yield* limiter.admit(actor)
    return Match.value(decision).pipe(
      Match.tag("Admitted", () => Option.none<Rejection>()),
      Match.tag("Refused", ({ retryAfterSeconds }) => Option.some(rateLimitRejection(retryAfterSeconds))),
      Match.exhaustive
    )
  }).pipe(
    Effect.catchTag("PlaceBuildLimiterError", (failure) => Effect.succeedSome(undecidedAdmission(failure)))
  )

const failureModel = (
  error: PlaceBuildError | ParseResult.ParseError | HttpServerError.RequestError
): ErrorModel =>
  Match.value(error).pipe(
    Match.tag("PlaceBuildError", (failure): ErrorModel => ({
      code: "execution-failed",
      message: `Place build failed at ${failure.stage}.`,
      retryable: true
    })),
    Match.tag("ParseError", (failure): ErrorModel => ({
      code: "invalid-request",
      message: ParseResult.TreeFormatter.formatErrorSync(failure),
      retryable: false
    })),
    Match.tag("RequestError", () => unreadableBody),
    Match.exhaustive
  )

const decodeBody = HttpServerRequest.schemaBodyJson(PlaceBuildRequest)

/** Reads and validates the body, builds the place, and turns any failure into an error model. */
const build = (
  request: HttpServerRequest.HttpServerRequest
): Effect.Effect<Either.Either<PlaceBuild, ErrorModel>, never, Participants | Cipher.Cipher> =>
  decodeBody.pipe(
    Effect.provideService(HttpServerRequest.HttpServerRequest, request),
    Effect.flatMap(buildPlace),
    Effect.mapError(failureModel),
    Effect.either
  )

export const imaginedPlaceRoute = (request: HttpServerRequest.HttpServerRequest, requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis

    const rejection = yield* Option.match(accessRejection(request), {
      onNone: () => admission(request),
      onSome: (rejected) => Effect.succeedSome(rejected)
    })
    const outcome = yield* Option.match(rejection, {
      onNone: () => build(request).pipe(Effect.map(Either.mapLeft((error): Rejection => ({ error, headers: {} })))),
      onSome: (rejected) => Effect.succeed(Either.left(rejected))
    })

    const meta = yield* responseMeta(requestId, startedAtMs)

    return yield* Either.match(outcome, {
      onLeft: ({ error, headers }) => respond({ ok: false, meta, error }, headers),
      onRight: (data) => respond({ ok: true, meta, data }, {})
    })
  })
