import { Boolean as Bool, Effect, Layer, Match, Option, Predicate, Schema } from "effect"
import { HttpClient, HttpClientError, HttpClientRequest, HttpClientResponse, HttpServerResponse } from "effect/http"
import * as Num from "effect/Number"

import { StaticStore, StaticStoreError } from "../config/static-store.js"

/**
 * `StaticStore` backed by a Cloudflare Workers static-assets binding.
 *
 * The binding is configured in `wrangler.jsonc` (`assets.binding = "ASSETS"`)
 * and exposed to the Worker as `env.ASSETS`. Its `fetch` has the Fetch API
 * signature, so it becomes the transport of an Effect `HttpClient` built with
 * `HttpClient.make`; every asset read is then an ordinary traced client
 * request. Only the URL pathname is meaningful to the binding; the host is a
 * placeholder. With `not_found_handling: "none"` a missing asset is a plain
 * `404` response.
 *
 * The structural `AssetsFetcher` type keeps this module independent of
 * `@cloudflare/workers-types`; the generated `Fetcher` type is assignable.
 */
type Fetch = (
  input: URL,
  init: { readonly method: string; readonly headers: Record<string, string>; readonly signal: AbortSignal }
) => Promise<Response>

export const AssetsFetcher = Schema.declare<{ readonly fetch: Fetch }>(
  (input): input is { readonly fetch: Fetch } =>
    Match.value(input).pipe(
      Match.when(Predicate.hasProperty("fetch"), (candidate) => Predicate.isFunction(candidate.fetch)),
      Match.orElse(() => false)
    ),
  { identifier: "@theoria/app/server/platform/AssetsFetcher" }
)
export type AssetsFetcher = typeof AssetsFetcher.Type

const assetsOrigin = "https://assets.local"

/** An `HttpClient` whose transport is the assets binding. */
const assetsClient = (assets: AssetsFetcher): HttpClient.HttpClient =>
  HttpClient.make((request, url, signal) =>
    Effect.tryPromise({
      try: () => assets.fetch(url, { method: request.method, headers: request.headers, signal }),
      catch: (cause) =>
        new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({
            request,
            cause,
            description: Match.value(cause).pipe(
              Match.when(Predicate.isError, (error) => error.message),
              Match.orElse(String)
            )
          })
        })
    }).pipe(Effect.map((response) => HttpClientResponse.fromWeb(request, response)))
  ).pipe(HttpClient.mapRequest(HttpClientRequest.prependUrl(assetsOrigin)))

/**
 * One status policy for both operations: `404` is absence, every other non-2xx
 * status and every transport failure is the store failing to deliver an asset
 * that may well exist, so it is `Unreadable` and reaches the caller as a 500.
 */
const storeFailure = (pathname: string) => (cause: HttpClientError.HttpClientError): StaticStoreError =>
  Match.value(cause.reason).pipe(
    Match.tag("StatusCodeError", (error) =>
      Bool.match(Num.Equivalence(error.response.status, 404), {
        onTrue: () => new StaticStoreError({ pathname, reason: "NotFound", detail: "" }),
        onFalse: () => new StaticStoreError({ pathname, reason: "Unreadable", detail: error.message })
      })),
    Match.orElse((error) => new StaticStoreError({ pathname, reason: "Unreadable", detail: error.message }))
  )

export const make = (assets: AssetsFetcher): StaticStore["Service"] => {
  const client = assetsClient(assets)
  const okClient = HttpClient.filterStatusOk(client)
  return StaticStore.of({
    text: (pathname) =>
      okClient.get(pathname).pipe(
        Effect.flatMap((response) => response.text),
        Effect.mapError(storeFailure(pathname))
      ),
    response: (pathname) =>
      okClient.get(pathname).pipe(
        Effect.map((response) =>
          Option.some(
            HttpServerResponse.stream(response.stream, { status: response.status, headers: response.headers })
          )
        ),
        Effect.mapError(storeFailure(pathname)),
        Effect.catchIf((error) => error.reason === "NotFound", () => Effect.succeedNone)
      )
  })
}

export const layer = (assets: AssetsFetcher): Layer.Layer<StaticStore> => Layer.succeed(StaticStore, make(assets))
