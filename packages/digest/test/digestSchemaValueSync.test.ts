/**
 * Bounded synchronous Schema digest parity and adversarial laws.
 */

import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Schema } from "effect"

import {
  CanonicalByteLimitExceeded,
  CyclicValue,
  digestSchemaValueWithByteLimit,
  digestSchemaValueWithByteLimitSync,
  InvalidCanonicalByteLimit,
  InvalidUnicode,
  SchemaValueDigest
} from "../src/index.js"
import type { DigestAlgorithm } from "../src/index.js"

const JcsSensitive = Schema.Struct({
  metadata: Schema.Struct({ z: Schema.Number, a: Schema.String }),
  values: Schema.Array(Schema.Number),
  escaped: Schema.String,
  astral: Schema.String
})

const jcsSensitive = {
  metadata: { z: 333333333.3333333, a: "first" },
  values: [-0, 1e-7, 1e20],
  escaped: "line\nquote\"",
  astral: "😀"
}

const algorithms: ReadonlyArray<DigestAlgorithm> = ["blake3-256", "sha256"]

const parity = <A, I>(
  schema: Schema.Schema<A, I, never>,
  value: A,
  maximumBytes: number,
  algorithm: DigestAlgorithm = "blake3-256"
) =>
  Effect.gen(function*() {
    const synchronous = digestSchemaValueWithByteLimitSync(schema, value, maximumBytes, algorithm)
    const cooperative = yield* Effect.either(
      digestSchemaValueWithByteLimit(schema, value, maximumBytes, algorithm)
    )

    expect(synchronous).toStrictEqual(cooperative)
    return synchronous
  })

describe("digestSchemaValueWithByteLimitSync", () => {
  it.effect("matches the cooperative API for JCS-sensitive values and both algorithms", () =>
    Effect.forEach(
      algorithms,
      (algorithm) =>
        Effect.gen(function*() {
          const result = yield* parity(JcsSensitive, jcsSensitive, 4_096, algorithm)
          expect(Either.isRight(result)).toBe(true)
        }),
      { discard: true }
    ))

  it.effect("returns ParseError for malformed Schema values without throwing", () =>
    Effect.gen(function*() {
      const Strict = Schema.Struct({ count: Schema.Int })
      const value = { count: 1.5 }

      const synchronous = digestSchemaValueWithByteLimitSync(Strict, value, 64)
      const result = yield* parity(Strict, value, 64)

      expect(Either.isLeft(synchronous) && synchronous.left._tag).toBe("ParseError")
      expect(Either.isLeft(result) && result.left._tag).toBe("ParseError")
    }))

  it.effect("returns CyclicValue for cycles without throwing", () =>
    Effect.gen(function*() {
      const value: Array<unknown> = []
      value[0] = value

      const synchronous = digestSchemaValueWithByteLimitSync(Schema.Unknown, value, 64)
      const result = yield* parity(Schema.Unknown, value, 64)

      expect(synchronous).toStrictEqual(Either.left(new CyclicValue({})))
      expect(result).toStrictEqual(Either.left(new CyclicValue({})))
    }))

  it.effect("returns InvalidUnicode for malformed canonical text without throwing", () =>
    Effect.gen(function*() {
      const value = ["valid", "\uD800"]

      const synchronous = digestSchemaValueWithByteLimitSync(Schema.Unknown, value, 64)
      const result = yield* parity(Schema.Unknown, value, 64)

      expect(synchronous).toStrictEqual(
        Either.left(new InvalidUnicode({ kind: "lone-high-surrogate", codeUnitIndex: 0 }))
      )
      expect(result).toStrictEqual(
        Either.left(new InvalidUnicode({ kind: "lone-high-surrogate", codeUnitIndex: 0 }))
      )
    }))

  it.effect("preserves invalid, exact, and one-byte-over inclusive limit behavior", () =>
    Effect.gen(function*() {
      const invalid = yield* parity(Schema.String, "😀", -1)
      const exact = yield* parity(Schema.String, "😀", 6)
      const excess = yield* parity(Schema.String, "😀", 5)

      expect(invalid).toStrictEqual(Either.left(new InvalidCanonicalByteLimit({})))
      expect(Either.isRight(exact)).toBe(true)
      if (Either.isRight(exact)) {
        expect(exact.right).toBeInstanceOf(SchemaValueDigest)
        expect(exact.right.canonicalByteLength).toBe(6)
      }
      expect(excess).toStrictEqual(Either.left(new CanonicalByteLimitExceeded({})))
    }))

  it.effect("stops before visiting later containers after the first excess byte", () => {
    const width = 4_096
    const visited: Array<number> = []
    const value = Arr.makeBy(width, (index) =>
      new Proxy({ index, text: "value".repeat(16) }, {
        ownKeys: (target) => {
          visited[visited.length] = index
          return Reflect.ownKeys(target)
        }
      }))

    const result = digestSchemaValueWithByteLimitSync(Schema.Unknown, value, 64)

    expect(result).toStrictEqual(Either.left(new CanonicalByteLimitExceeded({})))
    expect(visited.length).toBeGreaterThan(0)
    expect(visited.length).toBeLessThan(width)
    return Effect.void
  })

  it.effect("is stack-safe for deeply nested admitted values", () => {
    const depth = 50_000
    const base: unknown = null
    const value = Arr.reduce(
      Arr.makeBy(depth, (index) => index),
      base,
      (nested) => [nested]
    )
    const result = digestSchemaValueWithByteLimitSync(Schema.Unknown, value, depth * 2 + 4)

    expect(Either.isRight(result)).toBe(true)
    return Effect.void
  })
})
