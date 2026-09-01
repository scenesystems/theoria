import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Option } from "effect"

import {
  DocsApiExportPageJson,
  DocsApiModuleIndexJson,
  DocsManifestJson
} from "@theoria/docs-model"
import * as Schema from "effect/Schema"
import { DocsClient } from "../../app/web/services/DocsClient.js"
import { docsApiExportPageFixture, docsApiModuleIndexFixture } from "../helpers/docs-api-fixtures.js"
import { docsManifestFixture } from "../helpers/docs-fixtures.js"

const withFetchText = <A, E>(content: string, effect: Effect.Effect<A, E, DocsClient>): Effect.Effect<A, E> => {
  const previousFetch = globalThis.fetch

  return Effect.gen(function*() {
    yield* Effect.sync(() => {
      Reflect.set(globalThis, "fetch", () => Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(content)
      }))
    })
    return yield* effect
  }).pipe(
    Effect.provide(DocsClient.Default),
    Effect.ensuring(Effect.sync(() => {
      Reflect.set(globalThis, "fetch", previousFetch)
    }))
  )
}

describe("documentation browser boundary", () => {
  it.effect("decodes the generated manifest at the browser boundary", () =>
    withFetchText(
      Schema.encodeSync(DocsManifestJson)(docsManifestFixture),
      Effect.gen(function*() {
        const client = yield* DocsClient
        const manifest = yield* client.manifest()
        expect(manifest.revision).toBe(docsManifestFixture.revision)
        expect(manifest.packages[0]?.slug).toBe("effect-search")
      })
    ))

  it.effect("turns malformed payloads into a typed data error", () =>
    withFetchText(
      "{\"schemaVersion\":2}",
      Effect.gen(function*() {
        const client = yield* DocsClient
        const result = yield* Effect.either(client.manifest())
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) expect(result.left._tag).toBe("DocsDataError")
      })
    ))

  it.effect("decodes module indexes and focused exports independently", () => {
    const moduleJson = Schema.encodeSync(DocsApiModuleIndexJson)(docsApiModuleIndexFixture)
    const exportPage = docsApiExportPageFixture(0)
    const exportJson = Schema.encodeSync(DocsApiExportPageJson)(exportPage)
    const previousFetch = globalThis.fetch

    return Effect.gen(function*() {
      yield* Effect.sync(() => {
        Reflect.set(globalThis, "fetch", (input: string | URL | Request) => Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(String(input).includes("api-runStudy") ? exportJson : moduleJson)
        }))
      })
      const client = yield* DocsClient
      const moduleIndex = yield* client.apiModuleIndex("/module.json")
      const summary = Option.getOrThrow(Option.fromNullable(moduleIndex.exports[0]))
      const focusedExport = yield* client.apiExport(summary.asset)

      expect(moduleIndex.exports[0]?.name).toBe("runStudy")
      expect(focusedExport.export.facets[0]?.signatures[0]?.code).toContain("runStudy<A>")
    }).pipe(
      Effect.provide(DocsClient.Default),
      Effect.ensuring(Effect.sync(() => {
        Reflect.set(globalThis, "fetch", previousFetch)
      }))
    )
  })
})
