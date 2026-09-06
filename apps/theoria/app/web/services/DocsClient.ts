import { FetchHttpClient, HttpClient, type HttpClientError } from "@effect/platform"
import { Effect, Schema } from "effect"
import * as ParseResult from "effect/ParseResult"

import {
  type DocsApiExportPage,
  DocsApiExportPageJson,
  type DocsApiModuleIndex,
  DocsApiModuleIndexJson,
  DocsDataError,
  type DocsManifest,
  DocsManifestJson,
  type DocsSearchIndex,
  DocsSearchIndexJson,
  type GuidePage,
  GuidePageJson
} from "@theoria/docs-model"

const parseErrorMessage = (error: ParseResult.ParseError): string => ParseResult.TreeFormatter.formatErrorSync(error)

const requestErrorMessage = (error: HttpClientError.HttpClientError): string =>
  error._tag === "ResponseError"
    ? `Documentation data request failed with status ${String(error.response.status)}`
    : error.message

const make = Effect.gen(function*() {
  const http = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)

  const request = <A>(path: string, schema: Schema.Schema<A, string>): Effect.Effect<A, DocsDataError> =>
    http.get(path, { headers: { accept: "application/json" } }).pipe(
      Effect.flatMap((response) => response.text),
      Effect.mapError((error) => new DocsDataError({ path, message: requestErrorMessage(error) })),
      Effect.flatMap((content) =>
        Schema.decode(schema)(content).pipe(
          Effect.mapError((error) => new DocsDataError({ path, message: parseErrorMessage(error) }))
        )
      )
    )

  return {
    manifest: (): Effect.Effect<DocsManifest, DocsDataError> => request("/docs-data/manifest.json", DocsManifestJson),
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
export class DocsClient extends Effect.Service<DocsClient>()("theoria/DocsClient", {
  effect: make,
  dependencies: [FetchHttpClient.layer]
}) {}
