import { describe, expect, it } from "@effect/vitest"
import { Effect, Either } from "effect"

import { DocsManifestJson } from "@theoria/docs-model"
import * as Schema from "effect/Schema"
import { DocsClient } from "../../app/web/services/DocsClient.js"
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
})
