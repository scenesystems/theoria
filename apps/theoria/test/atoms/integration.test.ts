import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { DemoExecutionError } from "../../app/contracts/demo-error.js"
import { DemoClient } from "../../app/web/services/DemoClient.js"
import { DemoClientTest, makeDemoClientTestLayer } from "../helpers/demo-client.test-layer.js"
import { programPreviewFixture, runDataFixture } from "../helpers/demo-fixtures.js"

describe("DemoClient Test Layer", () => {
  it.effect("default test layer serves run data", () =>
    Effect.gen(function*() {
      const client = yield* DemoClient
      const result = yield* client.run("effect-text")
      expect(result.summary).toBe("test run")
    }).pipe(Effect.provide(DemoClientTest)))

  it.effect("default test layer serves preload data", () =>
    Effect.gen(function*() {
      const client = yield* DemoClient
      const result = yield* client.preload("effect-text")
      expect(result.id).toBe("effect-text")
    }).pipe(Effect.provide(DemoClientTest)))

  it.effect("custom test layer allows per-test fixture injection", () =>
    Effect.gen(function*() {
      const layer = makeDemoClientTestLayer({
        run: (id) => Effect.succeed(runDataFixture(`custom-${id}`)),
        preload: () => Effect.succeed(programPreviewFixture)
      })
      const client = yield* Effect.provide(DemoClient, layer)
      const result = yield* client.run("effect-search")
      expect(result.summary).toBe("custom-effect-search")
    }))

  it.effect("custom test layer can return errors", () =>
    Effect.gen(function*() {
      const layer = makeDemoClientTestLayer({
        run: () =>
          Effect.fail(
            new DemoExecutionError({ code: "execution-timeout", message: "timeout", retryable: true })
          ),
        preload: () => Effect.succeed(programPreviewFixture)
      })
      const client = yield* Effect.provide(DemoClient, layer)
      const result = yield* client.run("effect-text").pipe(Effect.either)
      expect(result._tag).toBe("Left")
    }))
})
