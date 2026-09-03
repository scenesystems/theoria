import { HttpServerResponse } from "@effect/platform"
import { Effect, Layer, Option } from "effect"

import { StaticStore, StaticStoreError } from "../config/static-store.js"

/**
 * `StaticStore` backed by a Cloudflare Workers static-assets binding.
 *
 * The binding is configured in `wrangler.jsonc` (`assets.binding = "ASSETS"`)
 * and exposed to the Worker as `env.ASSETS`. Only the URL pathname is
 * meaningful to the binding; the host is a placeholder. With
 * `not_found_handling: "none"` a missing asset is a plain `404` response.
 *
 * The structural `AssetsFetcher` type keeps this module independent of
 * `@cloudflare/workers-types`; the generated `Fetcher` type is assignable.
 */
export type AssetsFetcher = {
  readonly fetch: (input: Request) => Promise<Response>
}

const assetsOrigin = "https://assets.local"

const assetRequest = (pathname: string): Request => new Request(new URL(pathname, assetsOrigin), { method: "GET" })

const fetchAsset = (assets: AssetsFetcher, pathname: string) =>
  Effect.tryPromise({
    try: () => assets.fetch(assetRequest(pathname)),
    catch: (cause) => new StaticStoreError({ pathname, message: String(cause) })
  })

export const make = (assets: AssetsFetcher) =>
  StaticStore.of({
    text: (pathname) =>
      fetchAsset(assets, pathname).pipe(
        Effect.flatMap((response) =>
          response.ok
            ? Effect.tryPromise({
              try: () => response.text(),
              catch: (cause) => new StaticStoreError({ pathname, message: String(cause) })
            })
            : Effect.fail(
              new StaticStoreError({ pathname, message: `Asset responded with status ${String(response.status)}.` })
            )
        )
      ),
    response: (pathname) =>
      fetchAsset(assets, pathname).pipe(
        Effect.map((response) => response.ok ? Option.some(HttpServerResponse.fromWeb(response)) : Option.none()),
        Effect.catchAll(() => Effect.succeed(Option.none<HttpServerResponse.HttpServerResponse>()))
      )
  })

export const layer = (assets: AssetsFetcher): Layer.Layer<StaticStore> => Layer.succeed(StaticStore, make(assets))
