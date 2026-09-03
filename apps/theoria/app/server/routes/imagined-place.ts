import { type HttpServerError, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Clock, Effect, Either, Match, Option } from "effect"
import * as ParseResult from "effect/ParseResult"

import type { ErrorModel } from "../../contracts/error.js"
import type { PlaceBuild, PlaceBuildEnvelope } from "../../contracts/imagined-place-result.js"
import { PlaceBuildError, PlaceBuildRequest } from "../../contracts/imagined-place.js"
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
 */
export const imaginedPlacePath = "/api/imagined-place/build"

const statusFor = (code: ErrorModel["code"]): number =>
  Match.value(code).pipe(
    Match.when("invalid-request", () => 400),
    Match.when("method-not-allowed", () => 405),
    Match.when("cross-site-request", () => 403),
    Match.orElse(() => 500)
  )

const respond = (envelope: PlaceBuildEnvelope) =>
  HttpServerResponse.json(envelope, {
    status: envelope.ok ? 200 : statusFor(envelope.error.code),
    headers: {
      "cache-control": "no-store",
      ...(!envelope.ok && envelope.error.code === "method-not-allowed" ? { allow: "POST" } : {})
    }
  })

const methodRejection: ErrorModel = {
  code: "method-not-allowed",
  message: "Place builds must use POST.",
  retryable: false
}

const crossSiteRejection: ErrorModel = {
  code: "cross-site-request",
  message: "Cross-site place builds are not allowed.",
  retryable: false
}

const unreadableBody: ErrorModel = {
  code: "invalid-request",
  message: "Place build request body could not be read.",
  retryable: false
}

const accessRejection = (request: HttpServerRequest.HttpServerRequest): Option.Option<ErrorModel> =>
  request.method !== "POST"
    ? Option.some(methodRejection)
    : request.headers["sec-fetch-site"] === "cross-site"
    ? Option.some(crossSiteRejection)
    : Option.none()

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

    const outcome = yield* Option.match(accessRejection(request), {
      onNone: () => build(request),
      onSome: (rejection) => Effect.succeed(Either.left(rejection))
    })

    const endedAtMs = yield* Clock.currentTimeMillis
    const meta = { requestId, buildSha: runtimeInfo.buildSha, durationMs: endedAtMs - startedAtMs }

    return yield* respond(
      Either.match(outcome, {
        onLeft: (error): PlaceBuildEnvelope => ({ ok: false, meta, error }),
        onRight: (data): PlaceBuildEnvelope => ({ ok: true, meta, data })
      })
    )
  })
