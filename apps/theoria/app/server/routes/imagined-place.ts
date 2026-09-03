import { type HttpServerError, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Clock, Effect, Either, Match, Option } from "effect"
import * as ParseResult from "effect/ParseResult"

import type { ErrorModel } from "../../contracts/error.js"
import type { PlaceBuild, PlaceBuildEnvelope } from "../../contracts/imagined-place-result.js"
import { PlaceBuildError, PlaceBuildRequest } from "../../contracts/imagined-place.js"
import { PlaceBuildLimiter } from "../config/place-build-limiter.js"
import { RuntimeInfo } from "../config/runtime.js"
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

const statusFor = (code: ErrorModel["code"]): number =>
  Match.value(code).pipe(
    Match.when("invalid-request", () => 400),
    Match.when("method-not-allowed", () => 405),
    Match.when("cross-site-request", () => 403),
    Match.when("rate-limited", () => 429),
    Match.orElse(() => 500)
  )

type Rejection = {
  readonly error: ErrorModel
  readonly headers: Record<string, string>
}

const respond = (envelope: PlaceBuildEnvelope, headers: Record<string, string>) =>
  HttpServerResponse.json(envelope, {
    status: envelope.ok ? 200 : statusFor(envelope.error.code),
    headers: { "cache-control": "no-store", ...headers }
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

const unreadableBody: ErrorModel = {
  code: "invalid-request",
  message: "Place build request body could not be read.",
  retryable: false
}

const accessRejection = (request: HttpServerRequest.HttpServerRequest): Option.Option<Rejection> =>
  request.method !== "POST"
    ? Option.some(methodRejection)
    : request.headers["sec-fetch-site"] === "cross-site"
    ? Option.some(crossSiteRejection)
    : Option.none()

/** Asks the limiter for admission; requests without a client address share one bucket. */
const admission = (request: HttpServerRequest.HttpServerRequest) =>
  Effect.gen(function*() {
    const limiter = yield* PlaceBuildLimiter
    const actor = request.headers[clientAddressHeader] ?? "unknown-client"
    const decision = yield* limiter.admit(actor)
    return decision._tag === "Admitted" ? Option.none() : Option.some(rateLimitRejection(decision.retryAfterSeconds))
  })

const failureModel = (
  error: PlaceBuildError | ParseResult.ParseError | HttpServerError.RequestError
): ErrorModel =>
  Match.value(error).pipe(
    Match.when(Match.instanceOf(PlaceBuildError), (failure): ErrorModel => ({
      code: "execution-failed",
      message: `Place build failed at ${failure.stage}.`,
      retryable: true
    })),
    Match.when(ParseResult.isParseError, (failure): ErrorModel => ({
      code: "invalid-request",
      message: ParseResult.TreeFormatter.formatErrorSync(failure),
      retryable: false
    })),
    Match.orElse(() => unreadableBody)
  )

const decodeBody = HttpServerRequest.schemaBodyJson(PlaceBuildRequest)

/** Reads and validates the body, builds the place, and turns any failure into an error model. */
const build = (
  request: HttpServerRequest.HttpServerRequest
): Effect.Effect<Either.Either<PlaceBuild, ErrorModel>, never, Participants> =>
  decodeBody.pipe(
    Effect.provideService(HttpServerRequest.HttpServerRequest, request),
    Effect.flatMap(buildPlace),
    Effect.mapError(failureModel),
    Effect.either
  )

export const imaginedPlaceRoute = (request: HttpServerRequest.HttpServerRequest, requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const runtimeInfo = yield* RuntimeInfo

    const rejection = yield* Option.match(accessRejection(request), {
      onNone: () => admission(request),
      onSome: (rejected) => Effect.succeed(Option.some(rejected))
    })
    const outcome = yield* Option.match(rejection, {
      onNone: () => build(request).pipe(Effect.map(Either.mapLeft((error): Rejection => ({ error, headers: {} })))),
      onSome: (rejected) => Effect.succeed(Either.left(rejected))
    })

    const endedAtMs = yield* Clock.currentTimeMillis
    const meta = { requestId, buildSha: runtimeInfo.buildSha, durationMs: endedAtMs - startedAtMs }

    return yield* Either.match(outcome, {
      onLeft: ({ error, headers }) => respond({ ok: false, meta, error }, headers),
      onRight: (data) => respond({ ok: true, meta, data }, {})
    })
  })
