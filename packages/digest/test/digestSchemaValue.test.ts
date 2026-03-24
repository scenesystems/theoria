/**
 * digestSchemaValue contract tests.
 *
 * Target-state TDD — this import SHOULD exist once implemented.
 *
 * ### digestSchemaValue(schema, value, algorithm?)
 * - Schema.encode → JCS → hash → base64url → algorithm-tagged string
 * - Default algorithm is BLAKE3-256
 * - Explicit SHA-256 algorithm produces sha256-tagged string
 * - Date fields are encoded to ISO-8601 strings before hashing
 * - Deterministic — same schema + value = same output
 * - Different values produce different output
 * - Fails with parse error for invalid values
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Exit, Schema } from "effect"
import { digestSchemaValue } from "../src/index.js"

const UserEvent = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

const TimestampedEvent = Schema.Struct({
  action: Schema.String,
  createdAt: Schema.DateFromString
})

describe("digestSchemaValue — Schema.encode → JCS → hash pipeline", () => {
  it.effect("produces algorithm-tagged string with default BLAKE3-256", () =>
    Effect.gen(function*() {
      const result = yield* digestSchemaValue(UserEvent, { name: "Alice", age: 30 })
      expect(result).toMatch(/^blake3-256:[A-Za-z0-9_-]{43}$/)
    }))

  it.effect("explicit sha256 produces sha256-tagged string", () =>
    Effect.gen(function*() {
      const result = yield* digestSchemaValue(UserEvent, { name: "Alice", age: 30 }, "sha256")
      expect(result).toMatch(/^sha256:[A-Za-z0-9_-]{43}$/)
    }))

  it.effect("different algorithms produce different output", () =>
    Effect.gen(function*() {
      const b3 = yield* digestSchemaValue(UserEvent, { name: "Alice", age: 30 })
      const sha = yield* digestSchemaValue(UserEvent, { name: "Alice", age: 30 }, "sha256")
      expect(b3).not.toBe(sha)
    }))

  it.effect("is deterministic — same schema + value = same output", () =>
    Effect.gen(function*() {
      const a = yield* digestSchemaValue(UserEvent, { name: "Alice", age: 30 })
      const b = yield* digestSchemaValue(UserEvent, { name: "Alice", age: 30 })
      expect(a).toBe(b)
    }))

  it.effect("different values produce different output", () =>
    Effect.gen(function*() {
      const a = yield* digestSchemaValue(UserEvent, { name: "Alice", age: 30 })
      const b = yield* digestSchemaValue(UserEvent, { name: "Bob", age: 25 })
      expect(a).not.toBe(b)
    }))

  it.effect("Date fields are encoded to ISO strings before hashing", () =>
    Effect.gen(function*() {
      const result = yield* digestSchemaValue(
        TimestampedEvent,
        { action: "login", createdAt: new globalThis.Date("2026-03-21T00:00:00.000Z") }
      )
      expect(result).toMatch(/^blake3-256:[A-Za-z0-9_-]{43}$/)
    }))

  it.effect("fails with parse error for invalid values", () =>
    Effect.gen(function*() {
      const Strict = Schema.Struct({ name: Schema.String, age: Schema.Int })
      const exit = yield* Effect.exit(
        digestSchemaValue(Strict, { name: "Alice", age: 3.14 })
      )
      expect(Exit.isFailure(exit)).toBe(true)
    }))
})
