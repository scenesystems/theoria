import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { ChatPromptFixtureSchema, loadFixture, makeFixtureRegistry } from "./dspy-fixtures/index.js"

const manifestGenerator =
  "\"generator\":{\"script\":\"test\",\"generatorVersion\":\"1\",\"upstream\":\"dspy\",\"upstreamVersion\":\"1\",\"pythonVersion\":\"3\",\"generatedAt\":\"2026-01-01T00:00:00Z\"}"

describe("DSPy fixture registry", () => {
  it.effect("loads and decodes a fixture", () =>
    Effect.gen(function*() {
      const fixture = yield* loadFixture("dspy.chat.qa-basic")
      const decoded = yield* Schema.decodeUnknown(ChatPromptFixtureSchema)(fixture)

      expect(decoded.payload.messages.length).toBeGreaterThan(0)
    }))

  it.effect("fails with the requested name when a fixture is missing", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-dsp-fixtures-" })
      yield* fileSystem.writeFileString(
        `${directory}/manifest.json`,
        `{"schemaVersion":"1.0.0",${manifestGenerator},"fixtures":[]}`
      )
      const registry = makeFixtureRegistry({ rootDirectory: directory })
      const missing = yield* registry.load("dspy.chat.qa-basic").pipe(
        Effect.catchTag("FixtureNotFoundError", (error) => Effect.succeed(error.fixture))
      )

      expect(missing).toBe("dspy.chat.qa-basic")
    }).pipe(Effect.scoped, Effect.provide(BunContext.layer)))

  it.effect("rejects malformed fixture JSON", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "effect-dsp-fixtures-" })
      yield* fileSystem.writeFileString(
        `${directory}/manifest.json`,
        `{"schemaVersion":"1.0.0",${manifestGenerator},"fixtures":[{"name":"dspy.chat.qa-basic","file":"malformed.json"}]}`
      )
      yield* fileSystem.writeFileString(`${directory}/malformed.json`, "{")
      const registry = makeFixtureRegistry({ rootDirectory: directory })
      const malformed = yield* registry.load("dspy.chat.qa-basic").pipe(
        Effect.catchTag("FixtureMalformedJsonError", () => Effect.succeed(true))
      )

      expect(malformed).toBe(true)
    }).pipe(Effect.scoped, Effect.provide(BunContext.layer)))
})
