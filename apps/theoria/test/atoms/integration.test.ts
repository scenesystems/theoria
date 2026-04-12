import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { EntryExecutionError } from "../../app/contracts/entry-error.js"
import { EntryRegistry } from "../../app/contracts/entry/registry.js"
import { EntryClient } from "../../app/web/services/EntryClient.js"
import { EntryClientTest, makeEntryClientTestLayer } from "../helpers/entry-client.test-layer.js"
import { programPreviewFixture, runDataFixture } from "../helpers/entry-fixtures.js"

const entryRegistry = EntryRegistry.current()

const effectTextRunRequest = Schema.decodeUnknownSync(entryRegistry.descriptorForId("effect-text").runRequestSchema)({
  runToken: "effect-text:test-run",
  draft: {
    entryId: "effect-text",
    seedId: "default",
    input: { customText: "text", viewportWidthPx: 640 },
    controls: {}
  }
})

const effectSearchRunRequest = Schema.decodeUnknownSync(
  entryRegistry.descriptorForId("effect-search").runRequestSchema
)({
  runToken: "effect-search:test-run",
  draft: {
    entryId: "effect-search",
    seedId: "default",
    input: { trialBudget: 12 },
    controls: {}
  }
})

describe("EntryClient Test Layer", () => {
  it.effect("default test layer serves run data", () =>
    Effect.gen(function*() {
      const client = yield* EntryClient
      const result = yield* client.run(effectTextRunRequest)
      expect(result.summary).toBe("test run")
    }).pipe(Effect.provide(EntryClientTest)))

  it.effect("default test layer serves preload data", () =>
    Effect.gen(function*() {
      const client = yield* EntryClient
      const result = yield* client.preload("effect-text")
      expect(result.id).toBe("effect-text")
    }).pipe(Effect.provide(EntryClientTest)))

  it.effect("custom test layer allows per-test fixture injection", () =>
    Effect.gen(function*() {
      const client = yield* EntryClient
      const result = yield* client.run(effectSearchRunRequest)
      expect(result.summary).toBe("custom-effect-search")
    }).pipe(Effect.provide(makeEntryClientTestLayer({
      run: (id) => Effect.succeed(runDataFixture(`custom-${id}`)),
      preload: () => Effect.succeed(programPreviewFixture)
    }))))

  it.effect("custom test layer can return errors", () =>
    Effect.gen(function*() {
      const client = yield* EntryClient
      const result = yield* client.run(effectTextRunRequest).pipe(Effect.either)
      expect(result._tag).toBe("Left")
    }).pipe(Effect.provide(makeEntryClientTestLayer({
      run: () =>
        Effect.fail(
          new EntryExecutionError({ code: "execution-timeout", message: "timeout", retryable: true })
        ),
      preload: () => Effect.succeed(programPreviewFixture)
    }))))
})
