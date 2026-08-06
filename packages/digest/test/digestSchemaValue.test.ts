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
import { Array as Arr, Effect, Exit, Fiber, MutableRef, Scheduler, Schema } from "effect"
import {
  CanonicalByteLimitExceeded,
  canonicalJsonBytes,
  digestBytesBase64Url,
  digestSchemaValue,
  digestSchemaValueWithByteLimit,
  InvalidCanonicalByteLimit,
  SchemaValueDigest
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
const MANY_SEGMENT_TEXT = "A😀\n".repeat(65_536)
const BROAD_ENCODING_VALUE = Arr.makeBy(131_072, (index) => index)

const encodingProbe = <A, I>(
  schema: Schema.Schema<A, I, never>,
  completed: MutableRef.MutableRef<boolean>
): Schema.Schema<A, unknown, never> =>
  Schema.transform(Schema.Unknown, schema, {
    strict: false,
    decode: (value) => value,
    encode: (value) => {
      MutableRef.set(completed, true)
      return value
    }
  })

const deepEncodingFixture = (depth: number): readonly [Schema.Schema.AnyNoContext, unknown] => {
  const schema = MutableRef.make<Schema.Schema.AnyNoContext>(Schema.Number)
  const value = MutableRef.make<unknown>(1)
  Arr.forEach(Arr.range(1, depth), () => {
    MutableRef.set(schema, Schema.Array(MutableRef.get(schema)))
    MutableRef.set(value, [MutableRef.get(value)])
  })
  return [MutableRef.get(schema), MutableRef.get(value)]
}

const canonicalByteCountCases: ReadonlyArray<readonly [unknown, number]> = [
  ["A", 3],
  ["é", 4],
  ["€", 5],
  ["😀", 6],
  ["\n", 4],
  ["\u0000", 8],
  ["\\\"", 6],
  ["é😀\n", 10],
  [[0, -1, true, null], 16],
  [{ b: "😀", a: "é" }, 21],
  [{}, 2]
]

const requireNoEnvironment = <A, E>(effect: Effect.Effect<A, E, never>): Effect.Effect<A, E, never> => effect

const scheduledTasksDuring = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<number, E> =>
  Effect.suspend(() => {
    const scheduled = MutableRef.make(0)
    const scheduler = Scheduler.make(
      (task, priority, fiber) => {
        MutableRef.update(scheduled, (count) => count + 1)
        Scheduler.defaultScheduler.scheduleTask(task, priority, fiber)
      },
      () => false
    )
    return Effect.map(Effect.withScheduler(effect, scheduler), () => MutableRef.get(scheduled))
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
          expect(bounded.digest).toBe(existing)
        }), { discard: true })
    }))

  it.effect("matches one-shot output across many canonical segments for both algorithms", () =>
    Effect.gen(function*() {
      const canonicalBytes = yield* canonicalJsonBytes(MANY_SEGMENT_TEXT)

      yield* Effect.forEach(algorithms, (algorithm) =>
        Effect.gen(function*() {
          const oneShot = yield* digestSchemaValue(Schema.String, MANY_SEGMENT_TEXT, algorithm)
          const bounded = yield* digestSchemaValueWithByteLimit(
            Schema.String,
            MANY_SEGMENT_TEXT,
            canonicalBytes.byteLength,
            algorithm
          )

          expect(bounded).toStrictEqual(
            new SchemaValueDigest({ digest: oneShot, canonicalByteLength: canonicalBytes.byteLength })
          )
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

      expect(exact).toStrictEqual(new SchemaValueDigest({ digest: existing, canonicalByteLength: 6 }))
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

      expect(bounded).toStrictEqual(
        new SchemaValueDigest({
          digest: `blake3-256:${base64Url}`,
          canonicalByteLength: canonicalBytes.byteLength
        })
      )
    }))

  it.effect("rejects invalid maxima through a fieldless provider classification", () =>
    Effect.gen(function*() {
      yield* Effect.forEach(
        [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1],
        (maximumBytes) =>
          Effect.gen(function*() {
            const exit = yield* Effect.exit(
              digestSchemaValueWithByteLimit(Schema.String, "value", maximumBytes)
            )
            expect(exit).toStrictEqual(Exit.fail(new InvalidCanonicalByteLimit({})))
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

  it.effect("preserves a typed late canonicalization failure after incremental segment updates", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        digestSchemaValueWithByteLimit(
          Schema.Unknown,
          [MANY_SEGMENT_TEXT, "\uD800"],
          Number.MAX_SAFE_INTEGER,
          "sha256"
        )
      )

      expect(error).toMatchObject({
        _tag: "InvalidUnicode",
        kind: "lone-high-surrogate",
        codeUnitIndex: 0
      })
    }))

  it.effect("is fresh when the same bounded Effect is executed more than once", () => {
    const operation = digestSchemaValueWithByteLimit(
      Schema.String,
      MANY_SEGMENT_TEXT,
      Number.MAX_SAFE_INTEGER,
      "sha256"
    )

    return Effect.gen(function*() {
      const first = yield* operation
      yield* Effect.yieldNow()
      const second = yield* operation

      expect(second).toStrictEqual(first)
    })
  })

  it.effect("admits scheduler progress through a valid successful many-segment digest", () =>
    Effect.gen(function*() {
      const scheduled = yield* scheduledTasksDuring(
        digestSchemaValueWithByteLimit(
          Schema.String,
          MANY_SEGMENT_TEXT,
          Number.MAX_SAFE_INTEGER,
          "blake3-256"
        )
      )

      expect(scheduled).toBeGreaterThan(0)
    }))

  it.live(
    "admits host scheduler progress during valid broad Schema encoding",
    () =>
      Effect.gen(function*() {
        const encodingCompleted = MutableRef.make(false)
        const progressedDuringEncoding = MutableRef.make(false)
        const schema = encodingProbe(Schema.Array(Schema.Number), encodingCompleted)
        const observer = yield* Effect.fork(
          Effect.zipRight(
            Effect.sleep(0),
            Effect.sync(() => {
              if (!MutableRef.get(encodingCompleted)) MutableRef.set(progressedDuringEncoding, true)
            })
          )
        )
        yield* Effect.yieldNow()

        const result = yield* Effect.suspend(() =>
          digestSchemaValueWithByteLimit(schema, BROAD_ENCODING_VALUE, 2 * 1024 * 1024)
        )
        yield* Fiber.join(observer)

        expect(result.canonicalByteLength).toBeGreaterThan(0)
        expect(MutableRef.get(encodingCompleted)).toBe(true)
        expect(MutableRef.get(progressedDuringEncoding)).toBe(true)
      }),
    30_000
  )

  it.live(
    "interrupts valid broad Schema encoding before canonical traversal",
    () =>
      Effect.gen(function*() {
        const encodingCompleted = MutableRef.make(false)
        const schema = encodingProbe(Schema.Array(Schema.Number), encodingCompleted)
        const fiber = yield* Effect.fork(
          Effect.suspend(() => digestSchemaValueWithByteLimit(schema, BROAD_ENCODING_VALUE, 2 * 1024 * 1024))
        )
        yield* Effect.sleep(0)
        const exit = yield* Fiber.interrupt(fiber)

        expect(exit).toSatisfy(Exit.isInterrupted)
        expect(MutableRef.get(encodingCompleted)).toBe(false)
      }),
    30_000
  )

  it.live(
    "admits host scheduler progress and interruption during valid deep Schema encoding",
    () =>
      Effect.gen(function*() {
        const encodingCompleted = MutableRef.make(false)
        const progressedDuringEncoding = MutableRef.make(false)
        const [deepSchema, value] = deepEncodingFixture(16_384)
        const schema = encodingProbe(deepSchema, encodingCompleted)
        const observer = yield* Effect.fork(
          Effect.zipRight(
            Effect.sleep(0),
            Effect.sync(() => {
              if (!MutableRef.get(encodingCompleted)) MutableRef.set(progressedDuringEncoding, true)
            })
          )
        )
        yield* Effect.yieldNow()
        const fiber = yield* Effect.fork(
          Effect.suspend(() => digestSchemaValueWithByteLimit(schema, value, 256 * 1024))
        )
        yield* Fiber.join(observer)
        const exit = yield* Fiber.interrupt(fiber)

        expect(exit).toSatisfy(Exit.isInterrupted)
        expect(MutableRef.get(encodingCompleted)).toBe(false)
        expect(MutableRef.get(progressedDuringEncoding)).toBe(true)
      }),
    30_000
  )

  it.live(
    "remains interruptible after Schema encoding and before digest publication",
    () =>
      Effect.gen(function*() {
        const encodingCompleted = MutableRef.make(false)
        const schema = encodingProbe(Schema.Unknown, encodingCompleted)
        const value = Arr.makeBy(262_144, (index) => [index, index + 0.5])
        const fiber = yield* Effect.fork(
          digestSchemaValueWithByteLimit(schema, value, 32 * 1024 * 1024)
        )
        yield* Effect.iterate(0, {
          while: (turns) => !MutableRef.get(encodingCompleted) && turns < 1_024,
          body: (turns) => Effect.as(Effect.yieldNow(), turns + 1)
        })
        const exit = yield* Fiber.interrupt(fiber)

        expect(MutableRef.get(encodingCompleted)).toBe(true)
        expect(exit).toSatisfy(Exit.isInterrupted)
      }),
    30_000
  )

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

describe("digestSchemaValueWithByteLimit — early bounded canonical identity", () => {
  it.effect("returns the existing tagged digest and exact canonical byte length for both algorithms", () =>
    Effect.gen(function*() {
      const encoded = yield* Schema.encode(JcsSensitiveValue)(jcsSensitiveValue)
      const canonicalBytes = yield* canonicalJsonBytes(encoded)

      yield* Effect.forEach(algorithms, (algorithm) =>
        Effect.gen(function*() {
          const existing = yield* digestSchemaValue(JcsSensitiveValue, jcsSensitiveValue, algorithm)
          const bounded = yield* requireNoEnvironment(
            digestSchemaValueWithByteLimit(
              JcsSensitiveValue,
              jcsSensitiveValue,
              canonicalBytes.byteLength,
              algorithm
            )
          )

          expect(bounded).toStrictEqual(
            new SchemaValueDigest({
              digest: existing,
              canonicalByteLength: canonicalBytes.byteLength
            })
          )
        }), { discard: true })
    }))

  it.effect.each(canonicalByteCountCases)(
    "enforces the exact inclusive boundary across canonical UTF-8 forms %#",
    ([value, canonicalByteLength]) =>
      Effect.gen(function*() {
        const exact = yield* digestSchemaValueWithByteLimit(Schema.Unknown, value, canonicalByteLength)
        const excess = yield* Effect.exit(
          digestSchemaValueWithByteLimit(Schema.Unknown, value, canonicalByteLength - 1)
        )

        expect(exact.canonicalByteLength).toBe(canonicalByteLength)
        expect(excess).toStrictEqual(Exit.fail(new CanonicalByteLimitExceeded({})))
      })
  )

  it.effect("preserves exact bounds and digest parity for long strings and record keys", () =>
    Effect.gen(function*() {
      const text = "😀line\\n\"".repeat(8_192)
      const values: ReadonlyArray<unknown> = [text, { [text]: "value" }]

      yield* Effect.forEach(values, (value) =>
        Effect.gen(function*() {
          const bytes = yield* canonicalJsonBytes(value)
          const existing = yield* digestSchemaValue(Schema.Unknown, value)
          const exact = yield* digestSchemaValueWithByteLimit(Schema.Unknown, value, bytes.byteLength)
          const excess = yield* Effect.exit(
            digestSchemaValueWithByteLimit(Schema.Unknown, value, bytes.byteLength - 1)
          )

          expect(exact).toStrictEqual(
            new SchemaValueDigest({ digest: existing, canonicalByteLength: bytes.byteLength })
          )
          expect(excess).toStrictEqual(Exit.fail(new CanonicalByteLimitExceeded({})))
        }), { discard: true })
    }))

  it.effect("stops before traversing later containers after the first excess byte", () =>
    Effect.gen(function*() {
      const width = 4_096
      const visited = MutableRef.make(0)
      const value = Arr.makeBy(width, (index) =>
        new Proxy({ index, text: "value".repeat(16) }, {
          ownKeys: (target) => {
            MutableRef.increment(visited)
            return Reflect.ownKeys(target)
          }
        }))

      const exit = yield* Effect.exit(digestSchemaValueWithByteLimit(Schema.Unknown, value, 64))

      expect(exit).toStrictEqual(Exit.fail(new CanonicalByteLimitExceeded({})))
      expect(MutableRef.get(visited)).toBeGreaterThan(0)
      expect(MutableRef.get(visited)).toBeLessThan(width)
    }))

  it.effect("uses deterministic machine-order precedence around the excess boundary", () =>
    Effect.gen(function*() {
      const before = yield* Effect.flip(
        digestSchemaValueWithByteLimit(Schema.Unknown, [undefined, "value".repeat(64)], 8)
      )
      const after = yield* Effect.flip(
        digestSchemaValueWithByteLimit(Schema.Unknown, ["value".repeat(64), undefined], 8)
      )
      const key = yield* Effect.flip(
        digestSchemaValueWithByteLimit(Schema.Unknown, { ["\uD800"]: true }, 0)
      )

      expect(before).toMatchObject({ _tag: "UnsupportedValue", reason: "undefined" })
      expect(after).toStrictEqual(new CanonicalByteLimitExceeded({}))
      expect(key).toMatchObject({
        _tag: "InvalidUnicode",
        kind: "lone-high-surrogate",
        codeUnitIndex: 0
      })
    }))
})
