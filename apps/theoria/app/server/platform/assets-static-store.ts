import {
  HttpClient,
  HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
  HttpServerResponse
} from "@effect/platform"
import { Effect, Layer, Option, Predicate, Schema } from "effect"

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
    Predicate.hasProperty(input, "fetch") && Predicate.isFunction(input.fetch),
  { identifier: "AssetsFetcher" }
)
export type AssetsFetcher = typeof AssetsFetcher.Type

const assetsOrigin = "https://assets.local"

/** An `HttpClient` whose transport is the assets binding. */
const assetsClient = (assets: AssetsFetcher): HttpClient.HttpClient =>
  HttpClient.make((request, url, signal) =>
    Effect.tryPromise({
      try: () => assets.fetch(url, { method: request.method, headers: request.headers, signal }),
      catch: (cause) => new HttpClientError.RequestError({ request, reason: "Transport", cause })
    }).pipe(Effect.map((response) => HttpClientResponse.fromWeb(request, response)))
  ).pipe(HttpClient.mapRequest(HttpClientRequest.prependUrl(assetsOrigin)))

const isOk = (response: HttpClientResponse.HttpClientResponse): boolean =>
  response.status >= 200 && response.status < 300

export const make = (assets: AssetsFetcher): typeof StaticStore.Service => {
  const client = assetsClient(assets)
  const okClient = HttpClient.filterStatusOk(client)
  return StaticStore.of({
    text: (pathname) =>
      okClient.get(pathname).pipe(
        Effect.flatMap((response) => response.text),
        Effect.mapError((cause) => new StaticStoreError({ pathname, message: cause.message }))
      ),
    response: (pathname) =>
      client.get(pathname).pipe(
        Effect.map((response) =>
          isOk(response)
            ? Option.some(
              HttpServerResponse.stream(response.stream, { status: response.status, headers: response.headers })
            )
            : Option.none()
        ),
        Effect.catchAll(() => Effect.succeed(Option.none<HttpServerResponse.HttpServerResponse>()))
      )
  })
}

export const layer = (assets: AssetsFetcher): Layer.Layer<StaticStore> => Layer.succeed(StaticStore, make(assets))
