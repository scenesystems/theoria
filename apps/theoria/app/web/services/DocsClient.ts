import { BrowserHttpClient } from "@effect/platform-browser"
import { Context, Effect, Layer, Schema } from "effect"
import * as HttpClient from "effect/http/HttpClient"
import type * as HttpClientError from "effect/http/HttpClientError"

import {
  type DocsApiExportPage,
  DocsApiExportPageJson,
  type DocsApiModuleIndex,
  DocsApiModuleIndexJson,
  DocsDataError,
  DocsManifestJson,
  type DocsSearchIndex,
  DocsSearchIndexJson,
  type GuidePage,
  GuidePageJson
} from "@theoria/docs-model"

const parseErrorMessage = (error: Schema.SchemaError): string => error.message

const requestErrorMessage = (error: HttpClientError.HttpClientError): string => error.message

const make = Effect.gen(function*() {
  const http = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)

  const request = <A>(path: string, schema: Schema.Codec<A, string>) =>
    http.get(path, { headers: { accept: "application/json" } }).pipe(
      Effect.flatMap((response) => response.text),
      Effect.mapError((error) => new DocsDataError({ path, message: requestErrorMessage(error) })),
      Effect.flatMap((content) =>
        Schema.decodeEffect(schema)(content).pipe(
          Effect.mapError((error) => new DocsDataError({ path, message: parseErrorMessage(error) }))
        )
      )
    )

  return {
    manifest: request("/docs-data/manifest.json", DocsManifestJson),
    apiModuleIndex: (asset: string): Effect.Effect<DocsApiModuleIndex, DocsDataError> =>
      request(asset, DocsApiModuleIndexJson),
    apiExport: (asset: string): Effect.Effect<DocsApiExportPage, DocsDataError> =>
      request(asset, DocsApiExportPageJson),
    guidePage: (asset: string): Effect.Effect<GuidePage, DocsDataError> => request(asset, GuidePageJson),
    searchIndex: (asset: string): Effect.Effect<DocsSearchIndex, DocsDataError> => request(asset, DocsSearchIndexJson)
  }
})

/**
 * Browser client for the generated documentation data. Requests go through the
 * platform `HttpClient`, so the production layer uses `fetch` while tests
 * provide an in-memory client through `DocsClient.DefaultWithoutDependencies`.
 */
export class DocsClient extends Context.Service<DocsClient, Effect.Success<typeof make>>()(
  "@theoria/app/web/services/DocsClient"
) {
  static readonly DefaultWithoutDependencies = Layer.effect(DocsClient, make)
  static readonly Default = DocsClient.DefaultWithoutDependencies.pipe(Layer.provide(BrowserHttpClient.layerFetch))
}
