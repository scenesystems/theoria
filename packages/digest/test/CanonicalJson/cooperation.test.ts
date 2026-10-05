import { expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Cause,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Number as N,
  Record,
  Ref,
  Schema,
  String as Str,
  Tuple
} from "effect"

import * as CanonicalJson from "@scenesystems/digest/CanonicalJson"
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import * as Digest from "@scenesystems/digest/Digest"
import * as Utf8 from "@scenesystems/digest/Utf8"
import { Base64Url } from "effect/encoding"

const isInterrupted = (exit: Exit.Exit<unknown, unknown>) => Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)

const longText = Str.repeat(65_536)("value")
const workloads = Arr.make(
  Tuple.make("array", Arr.makeBy(4_096, (index) => Arr.make(index, N.sum(index, 0.5)))),
  Tuple.make(
    "record",
    Record.fromEntries(
      Arr.makeBy(
        4_096,
        (index) => Tuple.make(Str.concat("key-", Schema.encodeSync(Schema.FiniteFromString)(index)), index)
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
          Effect.andThen(
            Effect.forever(Effect.sleep("1 millis").pipe(Effect.andThen(Ref.update(ticks, N.increment))))
          )
        )
      )
      yield* Deferred.await(started)
      // Deferred completion can resume this fiber inline in v4. Let the timer
      // fiber register its sleep before measuring traversal cooperation.
      yield* Effect.yieldNow
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
      Effect.forkChild
    )
    yield* Effect.sleep(0)
    yield* Fiber.interrupt(fiber)
    expect(yield* Fiber.await(fiber)).toSatisfy(isInterrupted)
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
      Effect.forkChild
    )
    yield* Effect.sleep(0)
    yield* Fiber.interrupt(fiber)
    expect(yield* Fiber.await(fiber)).toSatisfy(isInterrupted)
    expect(yield* Ref.get(published)).toBe(false)
  }), 30_000)

it.effect("preserves multibyte and escaped text across incremental hash segments", () =>
  Effect.gen(function*() {
    const value = Str.repeat(8_193)("😀é\n")
    // Construct the expected JSON text independently of CanonicalJson.encode.
    const expectedText = Str.concat(Str.concat("\"", Str.repeat(8_193)("😀é\\n")), "\"")
    const bytes = yield* Utf8.encode(expectedText)
    expect(yield* CanonicalJson.encodeBytes(value)).toStrictEqual(bytes)
    yield* Effect.forEach(Digest.Algorithm.literals, (algorithm) =>
      Effect.gen(function*() {
        const expected = Str.concat(Str.concat(algorithm, ":"), Base64Url.encode(yield* Digest.hash(algorithm, bytes)))
        expect(ContentDigest.toString(yield* ContentDigest.fromSchema(Schema.String, value, algorithm))).toBe(expected)
        const bounded = yield* ContentDigest.fromSchemaWithByteLimit(Schema.String, value, 65_546, algorithm)
        expect(ContentDigest.toString(bounded.digest)).toBe(expected)
        expect(bounded.canonicalByteLength).toBe(65_546)
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

it.effect("matches scalar JSON escaping on both sides of the short-string boundary", () =>
  Effect.gen(function*() {
    const encode = Schema.encodeEffect(Schema.fromJsonString(Schema.String))
    const suffixes = Arr.make(
      "a漢😀\u{10ffff}",
      "\"\\/\b\t\n\f\r\u0000\u0001\u001f",
      "\u0020\u007f\u0080\u2028\u2029\ud7ff\ue000",
      "\n",
      "\r",
      "\r\n"
    )
    yield* Effect.forEach(Arr.make(0, 1_019, 1_023, 1_024, 1_025), (length) =>
      Effect.forEach(suffixes, (suffix) =>
        Effect.gen(function*() {
          const text = Str.concat(Str.repeat(length)("x"), suffix)
          const quoted = yield* encode(text)
          expect(yield* CanonicalJson.encode(text)).toBe(quoted)
          expect(yield* CanonicalJson.encode(Record.singleton(text, text)))
            .toBe(Str.concat(Str.concat(Str.concat("{", quoted), Str.concat(":", quoted)), "}"))
          const bytes = yield* Utf8.encode(quoted)
          const bounded = yield* ContentDigest.fromSchemaWithByteLimit(Schema.String, text, bytes.byteLength)
          expect(bounded.canonicalByteLength).toBe(bytes.byteLength)
          expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(Schema.String, text, bytes.byteLength - 1)))
            .toStrictEqual(Exit.fail(new CanonicalJson.ByteLimitExceeded({})))
        })))
  }))

it.effect("resumes parent collections after sliced keys and nested strings", () =>
  Effect.gen(function*() {
    const key = Str.concat(Str.repeat(1_023)("k"), "😀z")
    const text = Str.concat(Str.repeat(1_024)("v"), "\n漢")
    const value = Record.fromEntries(Arr.make(
      Tuple.make<[string, unknown]>("z", 3),
      Tuple.make<[string, unknown]>(key, Arr.make({ z: "line\n", a: "😀" }, Arr.empty(), { k: text })),
      Tuple.make<[string, unknown]>("a", "first")
    ))
    const quote = Schema.encodeEffect(Schema.fromJsonString(Schema.String))
    const expected = Arr.join(
      Arr.make(
        "{\"a\":\"first\",",
        yield* quote(key),
        ":[{\"a\":\"😀\",\"z\":\"line\\n\"},[],{\"k\":",
        yield* quote(text),
        "}],\"z\":3}"
      ),
      ""
    )
    expect(yield* CanonicalJson.encode(value)).toBe(expected)
    const bytes = yield* Utf8.encode(expected)
    const bounded = yield* ContentDigest.fromSchemaWithByteLimit(Schema.Unknown, value, bytes.byteLength)
    expect(bounded.digest).toStrictEqual(yield* ContentDigest.fromBytes("blake3-256", bytes))
    expect(bounded.canonicalByteLength).toBe(bytes.byteLength)
  }))

it.effect("stops at the byte limit before a later invalid value is traversed", () =>
  Effect.gen(function*() {
    const value = Arr.make(longText, undefined)
    const expected = new CanonicalJson.ByteLimitExceeded({})
    expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(Schema.Unknown, value, 64))).toStrictEqual(
      Exit.fail(expected)
    )
  }))

it.effect("preserves repeated keys and Unicode failures after wide record traversal", () =>
  Effect.gen(function*() {
    const records = Arr.makeBy(257, (index) => Record.singleton(Str.concat("key-", Str.String(index)), index))
    const shared = { constructor: 7, toString: 9 }
    const value = Arr.appendAll(records, Arr.make(shared, shared, { "😀": 11 }))
    // Each record's keys already have canonical order, so scalar JSON encoding
    // is an independent reference here, without a second canonicalizer.
    const schema = Schema.Array(Schema.Record(Schema.String, Schema.Finite))
    const expected = yield* Schema.encodeEffect(Schema.fromJsonString(schema))(value)
    expect(yield* CanonicalJson.encode(value)).toBe(expected)
    const bytes = yield* Utf8.encode(expected)
    const bounded = yield* ContentDigest.fromSchemaWithByteLimit(schema, value, bytes.byteLength)
    expect(bounded.digest).toStrictEqual(yield* ContentDigest.fromBytes("blake3-256", bytes))
    expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(schema, value, bytes.byteLength - 1)))
      .toStrictEqual(Exit.fail(new CanonicalJson.ByteLimitExceeded({})))
    expect(yield* Effect.exit(CanonicalJson.encode(Arr.append(value, { "😀x\udfff": 12 }))))
      .toStrictEqual(Exit.fail(new Utf8.InvalidUnicode({ kind: "lone-low-surrogate", codeUnitIndex: 3 })))
  }))

it.effect("one encodeBytes Effect produces the complete result on repeated execution", () =>
  Effect.gen(function*() {
    const operation = CanonicalJson.encodeBytes({ z: Arr.make(3, 2, 1), a: "value" })
    const expected = yield* Utf8.encode("{\"a\":\"value\",\"z\":[3,2,1]}")
    expect(yield* operation).toStrictEqual(expected)
    expect(yield* operation).toStrictEqual(expected)
  }))
