import type { HttpServerRequest } from "@effect/platform"
import { HttpServerResponse } from "@effect/platform"
import { Effect, Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import type * as ParseResult from "effect/ParseResult"

import { ProgramPreviewEnvelope } from "../../contracts/program-preview.js"
import { RunEnvelope } from "../../contracts/run.js"
import { decodeStreamManifest, type StreamManifest } from "../../contracts/stream-manifest.js"
import { execute } from "../demos/executor.js"
import { preload } from "../demos/preload.js"
import { authorizeDemoRequest, type DemoAccessRejection, DemoRouteAccess } from "./demo-access.js"
import { streamResponse } from "./demo-stream.js"

type ResponseEnvelope = {
  readonly ok: boolean
  readonly error?: { readonly code: string }
}

class InvalidDemoRoute extends Schema.TaggedError<InvalidDemoRoute>()(
  "InvalidDemoRoute",
  { pathname: Schema.String }
) {}

const routePattern = /^\/api\/demos\/([^/]+)\/(run|preload|stream)$/u
const requestUrlBase = "http://127.0.0.1"

const requestPathname = (request: HttpServerRequest.HttpServerRequest): string =>
  new URL(request.url, requestUrlBase).pathname

const rawRoute = (pathname: string): Option.Option<{ readonly id: string; readonly endpoint: string }> =>
  Option.fromNullable(routePattern.exec(pathname)).pipe(
    Option.flatMap((matches) =>
      Option.zipWith(
        Arr.get(matches, 1),
        Arr.get(matches, 2),
        (id, endpoint) => ({ id, endpoint })
      )
    )
  )

const decodeRoute = (
  pathname: string
): Effect.Effect<DemoRouteAccess, InvalidDemoRoute | ParseResult.ParseError> =>
  Option.match(rawRoute(pathname), {
    onNone: () => Effect.fail(new InvalidDemoRoute({ pathname })),
    onSome: (route) => Schema.decodeUnknown(DemoRouteAccess)(route)
  })

const statusFromEnvelope = (envelope: ResponseEnvelope): number =>
  Match.value(envelope.error?.code).pipe(
    Match.when(undefined, () => 200),
    Match.when("invalid-demo-id", () => 404),
    Match.when("route-not-found", () => 404),
    Match.when("method-not-allowed", () => 405),
    Match.when("cross-site-request", () => 403),
    Match.when("rate-limited", () => 429),
    Match.orElse(() => 500)
  )

const jsonResponse = (body: ResponseEnvelope, rejection?: DemoAccessRejection) =>
  HttpServerResponse.json(body, {
    status: statusFromEnvelope(body),
    headers: {
      "cache-control": "no-store",
      ...Option.match(Option.fromNullable(rejection?.allow), {
        onNone: () => ({}),
        onSome: (allow) => ({ allow })
      }),
      ...Option.match(Option.fromNullable(rejection?.retryAfterSeconds), {
        onNone: () => ({}),
        onSome: (retryAfterSeconds) => ({ "retry-after": String(retryAfterSeconds) })
      })
    }
  })

const failureEnvelope = (requestId: string) => ({
  ok: false,
  meta: { requestId, buildSha: "unknown", durationMs: 0 },
  error: {
    code: "route-not-found",
    message: "Demo route must be /api/demos/:id/run, /api/demos/:id/preload, or /api/demos/:id/stream.",
    retryable: false
  }
})

const rejectionEnvelope = (requestId: string, rejection: DemoAccessRejection) => ({
  ok: false,
  meta: { requestId, buildSha: "unknown", durationMs: 0 },
  error: {
    code: rejection.code,
    message: rejection.message,
    retryable: rejection.code === "rate-limited"
  }
})

const executionFailureEnvelope = (requestId: string) => ({
  ok: false,
  meta: { requestId, buildSha: "unknown", durationMs: 0 },
  error: {
    code: "execution-failed",
    message: "Demo execution failed.",
    retryable: true
  }
})

const parseManifest = (rawUrl: string): StreamManifest | null => {
  const raw = new URL(rawUrl, requestUrlBase).searchParams.get("manifest")

  return raw !== null && raw.trim().length > 0
    ? Option.getOrElse(decodeStreamManifest(raw.trim()), () => null)
    : null
}

const dispatch = (route: DemoRouteAccess, requestId: string, rawUrl: string) =>
  Match.value(route.endpoint).pipe(
    Match.when("stream", () => streamResponse(route.id, requestId, parseManifest(rawUrl))),
    Match.when("run", () =>
      execute(route.id, requestId).pipe(
        Effect.flatMap((envelope) => Schema.decodeUnknown(RunEnvelope)(envelope)),
        Effect.flatMap(jsonResponse)
      )),
    Match.orElse(() =>
      preload(route.id, requestId).pipe(
        Effect.flatMap((envelope) => Schema.decodeUnknown(ProgramPreviewEnvelope)(envelope)),
        Effect.flatMap(jsonResponse)
      )
    )
  )

export const demoRoute = (request: HttpServerRequest.HttpServerRequest, requestId: string) => {
  const pathname = requestPathname(request)

  return decodeRoute(pathname).pipe(
    Effect.flatMap((route) =>
      authorizeDemoRequest(route, request).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => dispatch(route, requestId, request.url),
            onSome: (rejection) => jsonResponse(rejectionEnvelope(requestId, rejection), rejection)
          })
        )
      )
    ),
    Effect.catchAll((error) =>
      error instanceof InvalidDemoRoute
        ? jsonResponse(failureEnvelope(requestId))
        : Effect.logError("theoria demo route failed").pipe(
          Effect.annotateLogs("pathname", pathname),
          Effect.annotateLogs("requestId", requestId),
          Effect.zipRight(jsonResponse(executionFailureEnvelope(requestId)))
        )
    )
  )
}
