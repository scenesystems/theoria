/**
 * digestSchemaValue contract tests.
 *
 * ### digestSchemaValue(schema, value, algorithm?)
 * - Schema.encode → JCS → hash → base64url → algorithm-tagged string
 * - Default algorithm is BLAKE3-256
 * - Explicit SHA-256 algorithm produces sha256-tagged string
 * - Date fields are encoded to ISO-8601 strings before hashing
 * - Deterministic — same schema + value = same output
 * - Different values produce different output
 * - Fails with parse error for invalid values
 *
 * ### digestSchemaValueWithByteLimit(schema, value, maximumBytes, algorithm?)
 * - Encodes and canonicalizes once, then measures the exact bytes hashed
 * - Exact inclusive bound succeeds
 * - A canonical preimage one byte over the bound fails before hashing
 * - Under-bound output is identical to digestSchemaValue
 */

import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Cause, Effect, Exit, Fiber, MutableRef, Option, Schema } from "effect"
import {
  CanonicalByteLimitExceeded,
  canonicalJsonBytes,
  digestBytesBase64Url,
  digestSchemaValue,
  digestSchemaValueWithByteLimit
} from "../src/index.js"
import type { DigestAlgorithm } from "../src/index.js"

const UserEvent = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

const TimestampedEvent = Schema.Struct({
  action: Schema.String,
  createdAt: Schema.DateFromString
})

const JcsSensitiveValue = Schema.Struct({
  metadata: Schema.Struct({
    z: Schema.Number,
    a: Schema.String
  }),
  values: Schema.Array(Schema.Number),
  escaped: Schema.String,
  astral: Schema.String
})

const jcsSensitiveValue = {
  metadata: { z: 333333333.3333333, a: "first" },
  values: [-0, 1e-7, 1e20],
  escaped: "line\nquote\"",
  astral: "😀"
}

const algorithms: ReadonlyArray<DigestAlgorithm> = ["blake3-256", "sha256"]

const requireNoEnvironment = <A, E>(effect: Effect.Effect<A, E, never>): Effect.Effect<A, E, never> => effect

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
      const createdAt = yield* Schema.decodeUnknown(Schema.DateFromString)("2026-03-21T00:00:00.000Z")
      const result = yield* digestSchemaValue(
        TimestampedEvent,
        { action: "login", createdAt }
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

describe("digestSchemaValueWithByteLimit — exact canonical preimage bound", () => {
  it.effect("matches digestSchemaValue for under-bound JCS-sensitive values and both algorithms", () =>
    Effect.gen(function*() {
      yield* Effect.forEach(algorithms, (algorithm) =>
        Effect.gen(function*() {
          const existing = yield* digestSchemaValue(JcsSensitiveValue, jcsSensitiveValue, algorithm)
          const bounded = yield* digestSchemaValueWithByteLimit(
            JcsSensitiveValue,
            jcsSensitiveValue,
            4_096,
            algorithm
          )
          expect(bounded).toBe(existing)
        }), { discard: true })
    }))

  it.effect("succeeds at the exact inclusive bound and fails when the preimage is bound plus one", () =>
    Effect.gen(function*() {
      const value = "😀"
      const canonicalBytes = yield* canonicalJsonBytes(value)
      expect(canonicalBytes.byteLength).toBe(6)

      const exact = yield* requireNoEnvironment(digestSchemaValueWithByteLimit(Schema.String, value, 6))
      const existing = yield* digestSchemaValue(Schema.String, value)
      const overLimit = yield* Effect.exit(digestSchemaValueWithByteLimit(Schema.String, value, 5))

      expect(exact).toBe(existing)
      expect(overLimit).toStrictEqual(Exit.fail(new CanonicalByteLimitExceeded({})))
    }))

  it.effect("hashes the exact canonical byte sequence measured by the limit", () =>
    Effect.gen(function*() {
      const encoded = yield* Schema.encode(JcsSensitiveValue)(jcsSensitiveValue)
      const canonicalBytes = yield* canonicalJsonBytes(encoded)
      const base64Url = yield* digestBytesBase64Url("blake3-256", canonicalBytes)
      const bounded = yield* digestSchemaValueWithByteLimit(
        JcsSensitiveValue,
        jcsSensitiveValue,
        canonicalBytes.byteLength
      )

      expect(bounded).toBe(`blake3-256:${base64Url}`)
    }))

  it.effect("treats an invalid maximum as a caller defect rather than an excess classification", () =>
    Effect.gen(function*() {
      yield* Effect.forEach(
        [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1],
        (maximumBytes) =>
          Effect.gen(function*() {
            const exit = yield* Effect.exit(
              digestSchemaValueWithByteLimit(Schema.String, "value", maximumBytes)
            )
            const defect = Exit.match(exit, {
              onFailure: Cause.dieOption,
              onSuccess: () => Option.none()
            })

            expect(Option.isSome(defect)).toBe(true)
          }),
        { discard: true }
      )
    }))

  it.effect("encodes once and canonicalizes the encoded value once", () =>
    Effect.gen(function*() {
      const encodeCount = MutableRef.make(0)
      const ownKeysCount = MutableRef.make(0)
      const descriptorCount = MutableRef.make(0)
      const EncodedOnce = Schema.transform(Schema.Unknown, Schema.Unknown, {
        strict: true,
        decode: (value) => value,
        encode: (value) => {
          MutableRef.increment(encodeCount)
          return value
        }
      })
      const target = { z: 1, a: 2 }
      const value = new Proxy(target, {
        ownKeys: (proxied) => {
          MutableRef.increment(ownKeysCount)
          return Reflect.ownKeys(proxied)
        },
        getOwnPropertyDescriptor: (proxied, key) => {
          MutableRef.increment(descriptorCount)
          return Reflect.getOwnPropertyDescriptor(proxied, key)
        }
      })

      yield* digestSchemaValueWithByteLimit(EncodedOnce, value, 64)

      expect(MutableRef.get(encodeCount)).toBe(1)
      expect(MutableRef.get(ownKeysCount)).toBe(1)
      expect(MutableRef.get(descriptorCount)).toBe(2)
    }))

  it.effect("preserves Schema encoding failure precedence before canonicalization", () =>
    Effect.gen(function*() {
      const Strict = Schema.Struct({ value: Schema.Int })
      const error = yield* Effect.flip(
        digestSchemaValueWithByteLimit(Strict, { value: 1.5 }, 0)
      )

      expect(error._tag).toBe("ParseError")
    }))

  it.live(
    "remains interruptible during a wide canonical traversal without publishing a digest",
    () =>
      Effect.gen(function*() {
        const value = Arr.makeBy(262_144, (index) => [index, index + 0.5])
        const schema = Schema.Array(Schema.Array(Schema.Number))
        const fiber = yield* Effect.fork(digestSchemaValueWithByteLimit(schema, value, 32 * 1024 * 1024))
        yield* Effect.sleep(0)
        const exit = yield* Fiber.interrupt(fiber)

        expect(Exit.isInterrupted(exit)).toBe(true)
      }),
    30_000
  )
})
