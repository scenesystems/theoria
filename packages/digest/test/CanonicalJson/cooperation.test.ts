import { expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Deferred,
  Effect,
  Either,
  Encoding,
  Exit,
  Fiber,
  Number as N,
  Record,
  Ref,
  Schema,
  String as Str,
  Tuple
} from "effect"

import * as CanonicalJson from "../../src/CanonicalJson.js"
import * as ContentDigest from "../../src/ContentDigest.js"
import * as Digest from "../../src/Digest.js"
import * as Utf8 from "../../src/Utf8.js"

const longText = Str.repeat(65_536)("value")
const workloads = Arr.make(
  Tuple.make("array", Arr.makeBy(4_096, (index) => Arr.make(index, N.sum(index, 0.5)))),
  Tuple.make(
    "record",
    Record.fromEntries(
      Arr.makeBy(
        4_096,
        (index) => Tuple.make(Str.concat("key-", Schema.encodeSync(Schema.NumberFromString)(index)), index)
      )
    )
  ),
  Tuple.make("string", longText),
  Tuple.make("record key", Record.singleton(longText, true))
)

it.live.each(workloads)(
  "allows host timers to run during a wide %s traversal",
  ([, value]) =>
    Effect.scoped(Effect.gen(function*() {
      const ticks = yield* Ref.make(0)
      const started = yield* Deferred.make<void>()
      yield* Effect.forkScoped(
        Deferred.succeed(started, undefined).pipe(
          Effect.zipRight(
            Effect.forever(Effect.sleep("1 millis").pipe(Effect.zipRight(Ref.update(ticks, N.increment))))
          )
        )
      )
      yield* Deferred.await(started)
      const ticksBefore = yield* Ref.get(ticks)
      const result = yield* CanonicalJson.encodeBytes(value)
      expect(result.byteLength).toBeGreaterThan(0)
      expect(yield* Ref.get(ticks)).toBeGreaterThan(ticksBefore)
    })),
  30_000
)

it.live("interrupts canonical byte traversal without publishing a partial result", () =>
  Effect.gen(function*() {
    const published = yield* Ref.make(false)
    const finalized = yield* Ref.make(false)
    const value = Arr.makeBy(65_536, (index) => Arr.make(index, N.sum(index, 0.5)))
    const fiber = yield* CanonicalJson.encodeBytes(value).pipe(
      Effect.tap(() => Ref.set(published, true)),
      Effect.ensuring(Ref.set(finalized, true)),
      Effect.fork
    )
    yield* Effect.sleep(0)
    expect(yield* Fiber.interrupt(fiber)).toSatisfy(Exit.isInterrupted)
    expect(yield* Ref.get(published)).toBe(false)
    expect(yield* Ref.get(finalized)).toBe(true)
  }), 30_000)

it.live("interrupts bounded hashing without publishing a partial digest", () =>
  Effect.gen(function*() {
    const published = yield* Ref.make(false)
    const fiber = yield* ContentDigest.fromSchemaWithByteLimit(
      Schema.String,
      Str.repeat(128)(longText),
      100_000_000
    ).pipe(
      Effect.tap(() => Ref.set(published, true)),
      Effect.fork
    )
    yield* Effect.sleep(0)
    expect(yield* Fiber.interrupt(fiber)).toSatisfy(Exit.isInterrupted)
    expect(yield* Ref.get(published)).toBe(false)
  }), 30_000)

it.effect("preserves multibyte and escaped text across incremental hash segments", () =>
  Effect.gen(function*() {
    const value = Str.repeat(8_193)("😀é\n")
    // Independently construct the expected JSON text instead of using canonicalize.
    const expectedText = Str.concat(Str.concat("\"", Str.repeat(8_193)("😀é\\n")), "\"")
    const bytes = yield* Utf8.encode(expectedText)
    expect(yield* CanonicalJson.encodeBytes(value)).toStrictEqual(bytes)
    yield* Effect.forEach(Digest.Algorithm.literals, (algorithm) =>
      Effect.gen(function*() {
        const expected = Str.concat(Str.concat(algorithm, ":"), Encoding.encodeBase64Url(Digest.hash(algorithm, bytes)))
        const bounded = yield* ContentDigest.fromSchemaWithByteLimit(Schema.String, value, 65_546, algorithm)
        const synchronous = ContentDigest.fromSchemaWithByteLimitEither(Schema.String, value, 65_546, algorithm)
        expect(ContentDigest.toString(bounded.digest)).toBe(expected)
        expect(bounded.canonicalByteLength).toBe(65_546)
        expect(synchronous).toStrictEqual(Either.right(bounded))
        expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(Schema.String, value, 65_545, algorithm)))
          .toStrictEqual(
            Exit.fail(new CanonicalJson.ByteLimitExceeded({}))
          )
      }))
  }))

it.effect("preserves a surrogate pair spanning a text batch and absolute indices for later faults", () =>
  Effect.gen(function*() {
    const prefix = Str.repeat(1_023)("a")
    const valid = Str.concat(prefix, "😀z")
    const invalid = Str.concat(valid, "\udc00")
    expect(yield* CanonicalJson.encode(valid)).toBe(Str.concat(Str.concat("\"", valid), "\""))
    expect(yield* Effect.exit(CanonicalJson.encode(invalid))).toStrictEqual(
      Exit.fail(new Utf8.InvalidUnicode({ kind: "lone-low-surrogate", codeUnitIndex: 1_026 }))
    )
  }))

it.effect("stops at the byte limit before a later invalid value is traversed", () =>
  Effect.gen(function*() {
    const value = Arr.make(longText, undefined)
    const expected = new CanonicalJson.ByteLimitExceeded({})
    expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(Schema.Unknown, value, 64))).toStrictEqual(
      Exit.fail(expected)
    )
    expect(ContentDigest.fromSchemaWithByteLimitEither(Schema.Unknown, value, 64)).toStrictEqual(Either.left(expected))
  }))

it.effect("one encodeBytes Effect produces the complete result on repeated execution", () =>
  Effect.gen(function*() {
    const operation = CanonicalJson.encodeBytes({ z: Arr.make(3, 2, 1), a: "value" })
    const expected = yield* Utf8.encode("{\"a\":\"value\",\"z\":[3,2,1]}")
    expect(yield* operation).toStrictEqual(expected)
    expect(yield* operation).toStrictEqual(expected)
  }))
