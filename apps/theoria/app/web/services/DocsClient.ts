import { Effect, Schema } from "effect"
import * as ParseResult from "effect/ParseResult"

import {
  type ApiPage,
  ApiPageJson,
  DocsDataError,
  type DocsManifest,
  DocsManifestJson,
  type DocsSearchIndex,
  DocsSearchIndexJson,
  type GuidePage,
  GuidePageJson
} from "@theoria/docs-model"

const parseErrorMessage = (error: ParseResult.ParseError): string => ParseResult.TreeFormatter.formatErrorSync(error)

const fetchText = (path: string) =>
  Effect.tryPromise({
    try: () => fetch(path, { headers: { accept: "application/json" } }),
    catch: (cause) => new DocsDataError({ path, message: String(cause) })
  }).pipe(
    Effect.flatMap((response) =>
      response.ok
        ? Effect.tryPromise({
          try: () => response.text(),
          catch: (cause) => new DocsDataError({ path, message: String(cause) })
        })
        : Effect.fail(
          new DocsDataError({
            path,
            message: `Documentation data request failed with status ${String(response.status)}`
          })
        )
    )
  )

const request = <A>(path: string, schema: Schema.Schema<A, string>) =>
  fetchText(path).pipe(
    Effect.flatMap((content) => Schema.decode(schema)(content)),
    Effect.mapError((error) =>
      error instanceof DocsDataError
        ? error
        : new DocsDataError({ path, message: parseErrorMessage(error) })
    )
  )

export class DocsClient extends Effect.Service<DocsClient>()("theoria/DocsClient", {
  succeed: {
    manifest: (): Effect.Effect<DocsManifest, DocsDataError> => request("/docs-data/manifest.json", DocsManifestJson),
    apiPage: (asset: string): Effect.Effect<ApiPage, DocsDataError> => request(asset, ApiPageJson),
    guidePage: (asset: string): Effect.Effect<GuidePage, DocsDataError> => request(asset, GuidePageJson),
    searchIndex: (asset: string): Effect.Effect<DocsSearchIndex, DocsDataError> => request(asset, DocsSearchIndexJson)
  }
}) {}
