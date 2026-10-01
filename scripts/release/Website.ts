/**
 * Deploys and verifies the prebuilt Theoria website Worker.
 *
 * @since 0.1.0
 * @module
 */

import {
  Command,
  type CommandExecutor,
  Headers,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  Url
} from "@effect/platform"
import {
  Array as Arr,
  Boolean as Bool,
  Duration,
  Effect,
  Either,
  Match,
  Number as Num,
  Option,
  Schedule,
  Schema,
  String as Str
} from "effect"

/** The website environments that can be promoted by the release program. */
export const Target = Schema.Literal("staging", "production")

const Operation = Schema.Literal("deploy", "verify")

/** A typed failure at the website deployment or verification boundary. */
export class WebsiteReleaseError extends Schema.TaggedError<WebsiteReleaseError>(
  "@theoria/scripts/release/Website/WebsiteReleaseError"
)("WebsiteReleaseError", { operation: Operation, subject: Schema.String, detail: Schema.String }) {
  override get message(): string {
    return Arr.join(Arr.make(this.operation, " ", this.subject, ": ", this.detail), "")
  }
}

const VerifySettings = Schema.Struct({
  attempts: Schema.Number.pipe(Schema.int(), Schema.positive()),
  delaySeconds: Schema.Number.pipe(Schema.nonNegative())
})

const HealthResponse = Schema.Struct({
  meta: Schema.Struct({ buildSha: Schema.String })
})

const Route = Schema.Struct({
  path: Schema.String,
  status: Schema.Number.pipe(Schema.int()),
  mime: Schema.String
})
type Route = typeof Route.Type

const ImaginedPlaceRequest = Schema.Struct({
  scenario: Schema.Literal("unfinished-light"),
  brief: Schema.String,
  acceptNeighbor: Schema.Boolean,
  acceptProgram: Schema.Boolean
})

const ImaginedPlaceEnvelope = Schema.Struct({ ok: Schema.Literal(true) })

const HEALTH_PATH = "/api/health/live"
const IMAGINED_PLACE_PATH = "/api/imagined-place/build"
const HEALTH_TIMEOUT = Duration.seconds(20)
const REQUEST_TIMEOUT = Duration.seconds(60)
const WRANGLER_DIRECTORY = "apps/theoria"
const WRANGLER_EXECUTABLE = "./node_modules/.bin/wrangler"
const WORKER_BUNDLE = ".wrangler-out/worker.js"

const ROUTES = Arr.make(
  Route.make({ path: "/", status: 200, mime: "text/html" }),
  Route.make({ path: "/docs", status: 200, mime: "text/html" }),
  Route.make({ path: "/docs/not-a-package/not-a-page", status: 404, mime: "text/html" }),
  Route.make({ path: "/api/version", status: 200, mime: "application/json" }),
  Route.make({ path: "/sitemap.xml", status: 200, mime: "application/xml" })
)

const IMAGINED_PLACE_ROUTE = Route.make({
  path: IMAGINED_PLACE_PATH,
  status: 200,
  mime: "application/json"
})

const IMAGINED_PLACE_REQUEST = ImaginedPlaceRequest.make({
  scenario: "unfinished-light",
  brief: "A small reading room with one window.",
  acceptNeighbor: true,
  acceptProgram: false
})

const numberText = Schema.encodeSync(Schema.NumberFromString)
const message = (...parts: Arr.NonEmptyReadonlyArray<string>): string => Arr.join(parts, "")
const websiteUrl = (origin: string, path: string): string => Str.concat(origin, path)

const releaseFailure = (
  operation: typeof Operation.Type,
  subject: string,
  detail: string
): WebsiteReleaseError => new WebsiteReleaseError({ operation, subject, detail })

const verifyFailure = (subject: string, detail: string): WebsiteReleaseError =>
  releaseFailure("verify", subject, detail)

const requireCheck = (condition: boolean, subject: string, detail: string) =>
  Effect.unless(verifyFailure(subject, detail), () => condition).pipe(Effect.asVoid)

const decodeJson = <A, I>(
  subject: string,
  schema: Schema.Schema<A, I>,
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<A, WebsiteReleaseError> =>
  HttpClientResponse.schemaBodyJson(schema)(response).pipe(
    Effect.mapError((failure) => verifyFailure(subject, failure.message))
  )

const readText = (subject: string, response: HttpClientResponse.HttpClientResponse) =>
  response.text.pipe(Effect.mapError((failure) => verifyFailure(subject, failure.message)))

const withResponse = <A>(
  subject: string,
  request: HttpClientRequest.HttpClientRequest,
  timeout: Duration.Duration,
  use: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<A, WebsiteReleaseError>
): Effect.Effect<A, WebsiteReleaseError, HttpClient.HttpClient> =>
  Effect.scoped(
    Effect.gen(function*() {
      const client = yield* HttpClient.HttpClient
      const response = yield* client.pipe(HttpClient.withScope).execute(request).pipe(
        Effect.mapError((failure) => verifyFailure(subject, failure.message))
      )
      return yield* use(response)
    })
  ).pipe(
    Effect.timeoutFail({
      duration: timeout,
      onTimeout: () => verifyFailure(subject, "HTTP request or response body timed out")
    })
  )

const checkResponse = (route: Route, response: HttpClientResponse.HttpClientResponse, noindex: boolean) =>
  Effect.gen(function*() {
    yield* requireCheck(
      Num.Equivalence(response.status, route.status),
      route.path,
      message("status ", numberText(response.status), ", expected ", numberText(route.status))
    )

    const contentType = Headers.get(response.headers, "content-type")
    yield* requireCheck(
      Option.exists(contentType, Str.startsWith(route.mime)),
      route.path,
      Option.match(contentType, {
        onNone: () => message("content-type is absent, expected '", route.mime, "'"),
        onSome: (value) => message("content-type '", value, "', expected '", route.mime, "'")
      })
    )

    const robots = Headers.get(response.headers, "x-robots-tag")
    const robotsMatch = Bool.match(noindex, {
      onFalse: () => Option.isNone(robots),
      onTrue: () => Option.exists(robots, Str.includes("noindex"))
    })
    const robotsDetail = Bool.match(noindex, {
      onFalse: () =>
        Option.match(robots, {
          onNone: () => "production response unexpectedly failed its indexing policy",
          onSome: (value) => message("production must not send X-Robots-Tag, got '", value, "'")
        }),
      onTrue: () =>
        Option.match(robots, {
          onNone: () => "expected X-Robots-Tag: noindex, header is absent",
          onSome: (value) => message("expected X-Robots-Tag: noindex, got '", value, "'")
        })
    })
    yield* requireCheck(robotsMatch, route.path, robotsDetail)
    yield* Effect.log("Website route verified").pipe(
      Effect.annotateLogs({ path: route.path, status: response.status, contentType })
    )
  })

const checkRoute = (origin: string, route: Route, noindex: boolean) =>
  withResponse(
    route.path,
    HttpClientRequest.get(websiteUrl(origin, route.path)),
    REQUEST_TIMEOUT,
    (response) => checkResponse(route, response, noindex)
  )

const waitForBuild = (origin: string, sha: string, settings: typeof VerifySettings.Type) => {
  const probe = withResponse(
    HEALTH_PATH,
    HttpClientRequest.get(websiteUrl(origin, HEALTH_PATH)),
    HEALTH_TIMEOUT,
    (response) =>
      Effect.gen(function*() {
        yield* requireCheck(
          Num.Equivalence(response.status, 200),
          HEALTH_PATH,
          message("status ", numberText(response.status), ", expected 200")
        )
        const health = yield* decodeJson(HEALTH_PATH, HealthResponse, response)
        yield* requireCheck(
          Str.Equivalence(health.meta.buildSha, sha),
          HEALTH_PATH,
          message("reported build '", health.meta.buildSha, "', waiting for '", sha, "'")
        )
      })
  )
  const pollingSchedule = Schedule.intersect(
    Schedule.recurs(Num.decrement(settings.attempts)),
    Schedule.spaced(Duration.seconds(settings.delaySeconds))
  )

  return probe.pipe(
    Effect.retry(pollingSchedule),
    Effect.mapError((failure) =>
      verifyFailure(
        origin,
        message(
          "did not serve build '",
          sha,
          "' within ",
          numberText(settings.attempts),
          " attempts: ",
          failure.detail
        )
      )
    )
  )
}

const checkImaginedPlace = (origin: string, noindex: boolean) =>
  Effect.gen(function*() {
    const request = yield* HttpClientRequest.post(websiteUrl(origin, IMAGINED_PLACE_PATH)).pipe(
      HttpClientRequest.schemaBodyJson(ImaginedPlaceRequest)(IMAGINED_PLACE_REQUEST),
      Effect.mapError((failure) =>
        verifyFailure(
          IMAGINED_PLACE_PATH,
          Match.value(failure.reason).pipe(
            Match.tag("JsonError", () => "request body JSON encoding failed"),
            Match.tag("SchemaError", ({ error }) => error.message),
            Match.exhaustive
          )
        )
      )
    )
    yield* withResponse(IMAGINED_PLACE_PATH, request, REQUEST_TIMEOUT, (response) =>
      Effect.gen(function*() {
        yield* checkResponse(IMAGINED_PLACE_ROUTE, response, noindex)
        yield* decodeJson(IMAGINED_PLACE_PATH, ImaginedPlaceEnvelope, response).pipe(
          Effect.mapError((failure) =>
            verifyFailure(
              IMAGINED_PLACE_PATH,
              message("response envelope is not ok: ", failure.detail)
            )
          )
        )
      }))
  })

const checkReferencedAsset = (origin: string, noindex: boolean) =>
  withResponse(
    "/",
    HttpClientRequest.get(websiteUrl(origin, "/")),
    HEALTH_TIMEOUT,
    (response) =>
      Effect.gen(function*() {
        const html = yield* readText("/", response)
        const asset = Option.flatMap(Str.match(/\/assets\/[^\x22]*\.js/)(html), Arr.head)
        return yield* Option.match(asset, {
          onNone: () => Effect.fail(verifyFailure("/", "HTML shell references no /assets/*.js bundle")),
          onSome: Effect.succeed
        })
      })
  ).pipe(
    Effect.flatMap((path) =>
      checkRoute(
        origin,
        Route.make({ path, status: 200, mime: "text/javascript" }),
        noindex
      )
    )
  )

/**
 * Deploys the already-built Worker with the repository-pinned Wrangler.
 * Standard output and error are inherited; no build step is run.
 *
 * @since 0.1.0
 * @category release
 */
export const deploy = (
  sha: string,
  target: typeof Target.Type
): Effect.Effect<void, WebsiteReleaseError, CommandExecutor.CommandExecutor> => {
  const environment = Match.value(target).pipe(
    Match.when("staging", () => "staging"),
    Match.when("production", () => ""),
    Match.exhaustive
  )
  const command = Command.make(
    WRANGLER_EXECUTABLE,
    "deploy",
    WORKER_BUNDLE,
    "--no-bundle",
    "--env",
    environment,
    "--var",
    Str.concat("BUILD_SHA:", sha),
    "--tag",
    sha
  ).pipe(
    Command.workingDirectory(WRANGLER_DIRECTORY),
    Command.stdout("inherit"),
    Command.stderr("inherit")
  )

  return Command.exitCode(command).pipe(
    Effect.mapError((failure) => releaseFailure("deploy", target, failure.message)),
    Effect.flatMap((exitCode) =>
      Effect.unless(
        releaseFailure("deploy", target, message("Wrangler exited with code ", numberText(exitCode))),
        () => Num.Equivalence(exitCode, 0)
      )
    ),
    Effect.asVoid
  )
}

/**
 * Waits for the expected build, then verifies routes, media types, indexing
 * policy, the imagined-place request, and a JavaScript asset from the shell.
 *
 * @since 0.1.0
 * @category release
 */
export const verify = (
  origin: string,
  sha: string,
  noindex: boolean,
  attempts: number = 60,
  delaySeconds: number = 10
): Effect.Effect<void, WebsiteReleaseError, HttpClient.HttpClient> =>
  Effect.gen(function*() {
    const settings = yield* Schema.decodeUnknown(VerifySettings)({ attempts, delaySeconds }).pipe(
      Effect.mapError((failure) => verifyFailure(origin, failure.message))
    )
    const normalizedOrigin = Str.replace(/\/$/, "")(origin)
    yield* Url.fromString(normalizedOrigin).pipe(
      Either.mapLeft((failure) => verifyFailure(origin, failure.message))
    )

    yield* waitForBuild(normalizedOrigin, sha, settings)
    yield* Effect.forEach(ROUTES, (route) => checkRoute(normalizedOrigin, route, noindex), { discard: true })
    yield* checkImaginedPlace(normalizedOrigin, noindex)
    yield* checkReferencedAsset(normalizedOrigin, noindex)
    yield* Effect.log("All website deployment checks passed").pipe(
      Effect.annotateLogs({ origin: normalizedOrigin, buildSha: sha })
    )
  })
