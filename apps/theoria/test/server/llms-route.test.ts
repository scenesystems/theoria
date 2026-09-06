import { HttpServerResponse } from "@effect/platform"
import { describe, expect, it } from "@effect/vitest"
import { Data, Effect, Exit, Layer } from "effect"

import { DocsManifestError, DocsManifestStore } from "../../app/server/config/docs-manifest-store.js"
import { textContentType } from "../../app/server/config/static-store.js"
import { llmsTxtRoute } from "../../app/server/routes/llms.js"
import { docsManifestFixture } from "../helpers/docs-fixtures.js"

const manifestError = new DocsManifestError({ message: "manifest.json is not in the static store" })

const FailingManifest = Layer.succeed(DocsManifestStore, DocsManifestStore.of({ manifest: Effect.fail(manifestError) }))
const FixtureManifest = Layer.succeed(
  DocsManifestStore,
  DocsManifestStore.of({ manifest: Effect.succeed(docsManifestFixture) })
)

/** The response body could not be read as text. */
class UnreadableBody extends Data.TaggedError("UnreadableBody")<{ readonly cause: unknown }> {}

const responseText = (response: HttpServerResponse.HttpServerResponse) =>
  Effect.tryPromise({
    try: () => HttpServerResponse.toWeb(response).text(),
    catch: (cause) => new UnreadableBody({ cause })
  })

describe("server/routes/llms", () => {
  it.effect("fails with the manifest store's DocsManifestError instead of serving a partial file", () =>
    Effect.gen(function*() {
      const exit = yield* llmsTxtRoute.pipe(Effect.provide(FailingManifest), Effect.exit)
      expect(exit).toStrictEqual(Exit.fail(manifestError))
    }))

  it.effect("renders the manifest's packages as plain text with the site's text content type", () =>
    Effect.gen(function*() {
      const response = yield* llmsTxtRoute.pipe(Effect.provide(FixtureManifest))
      expect(response.status).toBe(200)
      expect(response.headers["content-type"]).toBe(textContentType)

      const body = yield* responseText(response)
      expect(body.startsWith("# Theoria\n")).toBe(true)
      expect(body).toContain(
        `- [@scenesystems/effect-search 1.2.3](https://raw.githubusercontent.com/scenesystems/theoria/${docsManifestFixture.revision}/packages/effect-search/README.md): Effect-native optimization studies.`
      )
    }))
})
