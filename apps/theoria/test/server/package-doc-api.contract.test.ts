import { HttpServerResponse } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import {
  loadPackageDocsCorpus,
  packageDocsBundle,
  packageDocsCatalog,
  packageNameFromString,
  searchPackageDocs
} from "@theoria/source-proof"
import { Effect, Option, Schema } from "effect"

import {
  PackageDocsBundleEnvelope,
  PackageDocsCatalogEnvelope,
  PackageDocsSearchEnvelope
} from "../../app/contracts/presentation/package-docs.js"
import { PackageDocsLive } from "../../app/server/config/package-docs.js"
import { RuntimeInfoLive } from "../../app/server/config/runtime.js"
import { packageDocsRoute } from "../../app/server/routes/package-docs.js"

class ResponseJsonError extends Schema.TaggedError<ResponseJsonError>()("ResponseJsonError", {
  message: Schema.String
}) {}

const decodeWebJson = <A, I>(
  response: HttpServerResponse.HttpServerResponse,
  schema: Schema.Schema<A, I>
) =>
  Effect.gen(function*() {
    const webResponse = HttpServerResponse.toWeb(response)
    const body = yield* Effect.tryPromise({
      try: () => webResponse.json(),
      catch: (cause) => new ResponseJsonError({ message: String(cause) })
    }).pipe(Effect.orDie)
    const decoded = yield* Schema.decodeUnknown(schema)(body).pipe(Effect.orDie)

    return { decoded, status: webResponse.status }
  })

const provideServer = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provide(PackageDocsLive),
    Effect.provide(RuntimeInfoLive),
    Effect.provide(BunContext.layer)
  )

describe("server/package-doc-api", () => {
  it.effect("keeps catalog, bundle, and bounded search as thin adapter envelopes over the root query engine", () =>
    provideServer(
      Effect.gen(function*() {
        const corpus = yield* loadPackageDocsCorpus()
        const catalogResponse = yield* packageDocsRoute(
          "/api/package-docs/catalog",
          "req-catalog",
          "http://127.0.0.1/api/package-docs/catalog"
        )
        const bundleResponse = yield* packageDocsRoute(
          "/api/package-docs/bundle",
          "req-bundle",
          "http://127.0.0.1/api/package-docs/bundle?package=effect-search"
        )
        const searchResponse = yield* packageDocsRoute(
          "/api/package-docs/search",
          "req-search",
          "http://127.0.0.1/api/package-docs/search?query=study%20snapshot&package=effect-search&limit=5"
        )
        const catalog = yield* decodeWebJson(catalogResponse, PackageDocsCatalogEnvelope)
        const bundle = yield* decodeWebJson(bundleResponse, PackageDocsBundleEnvelope)
        const search = yield* decodeWebJson(searchResponse, PackageDocsSearchEnvelope)
        const expectedBundle = packageDocsBundle(corpus, packageNameFromString("effect-search"))

        expect(catalog.status).toBe(200)
        expect(bundle.status).toBe(200)
        expect(search.status).toBe(200)
        expect(catalog.decoded.ok).toBe(true)
        expect(bundle.decoded.ok).toBe(true)
        expect(search.decoded.ok).toBe(true)

        if (!catalog.decoded.ok || !bundle.decoded.ok || !search.decoded.ok) {
          return
        }

        expect(catalog.decoded.data).toEqual(packageDocsCatalog(corpus))
        expect(Option.isSome(expectedBundle)).toBe(true)

        if (Option.isNone(expectedBundle)) {
          return
        }

        expect(bundle.decoded.data).toEqual(expectedBundle.value)
        expect(search.decoded.data).toEqual(searchPackageDocs(corpus, {
          query: "study snapshot",
          packageId: packageNameFromString("effect-search"),
          limit: 5
        }))
        expect(search.decoded.data.every((entry) => entry.source.path.length > 0)).toBe(true)
      })
    ))

  it.effect("surfaces unknown-package and empty-query failures without inventing app-local retrieval semantics", () =>
    provideServer(
      Effect.gen(function*() {
        const unknownBundleResponse = yield* packageDocsRoute(
          "/api/package-docs/bundle",
          "req-missing",
          "http://127.0.0.1/api/package-docs/bundle?package=unknown-package"
        )
        const emptySearchResponse = yield* packageDocsRoute(
          "/api/package-docs/search",
          "req-empty",
          "http://127.0.0.1/api/package-docs/search?query=%20%20%20"
        )
        const unknownBundle = yield* decodeWebJson(unknownBundleResponse, PackageDocsBundleEnvelope)
        const emptySearch = yield* decodeWebJson(emptySearchResponse, PackageDocsSearchEnvelope)

        expect(unknownBundle.status).toBe(404)
        expect(emptySearch.status).toBe(400)
        expect(unknownBundle.decoded.ok).toBe(false)
        expect(emptySearch.decoded.ok).toBe(false)

        if (unknownBundle.decoded.ok || emptySearch.decoded.ok) {
          return
        }

        expect(unknownBundle.decoded.error.code).toBe("invalid-package-id")
        expect(emptySearch.decoded.error.code).toBe("invalid-query")
      })
    ))
})
