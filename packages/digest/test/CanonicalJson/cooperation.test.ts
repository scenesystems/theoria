import { expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Cause,
  Deferred,
  Effect,
  Exit,
  Fiber,
  MutableRef,
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
// A traversal that yields only once or twice can finish before a real 1 ms
// timer is due even though it yields. Exercise enough values and sliced text
// that traversal yields many times while host timers become due.
const timerText = Str.repeat(16)(longText)
const workloads = Arr.make(
  Tuple.make("array", Arr.makeBy(65_536, (index) => Arr.make(index, N.sum(index, 0.5)))),
  Tuple.make(
    "record",
    Record.fromEntries(
      Arr.makeBy(
        65_536,
        (index) => Tuple.make(Str.concat("key-", Schema.encodeSync(Schema.FiniteFromString)(index)), index)
      )
    )
  ),
  Tuple.make("string", timerText),
  Tuple.make("escaped string", Str.repeat(65_536)("line\n\"\\漢😀")),
  Tuple.make("record key", Record.singleton(timerText, true)),
  // Copied runs are bounded by charged text, so long keys and dense escapes
  // still yield between runs.
  Tuple.make(
    "long-key record",
    Record.fromEntries(
      Arr.makeBy(2_048, (index) => Tuple.make(Str.concat(Str.repeat(1_000)("k"), Str.String(index)), index))
    )
  ),
  Tuple.make("dense escape array", Arr.makeBy(2_048, () => Str.repeat(300)("\n")))
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
      // A pair straddling the slice boundary must move with the slice.
      "😀\n",
      "\"\\/\b\t\n\f\r\u0000\u0001\u001f",
      "\u0020\u007f\u0080\u2028\u2029\ud7ff\ue000",
      "\n",
      "\r",
      "\r\n"
    )
    yield* Effect.forEach(Arr.make(0, 1_019, 1_023, 1_024, 1_025, 32_767, 32_768, 32_769), (length) =>
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
          expect(
            yield* Effect.exit(
              ContentDigest.fromSchemaWithByteLimit(Schema.String, text, N.decrement(bytes.byteLength))
            )
          )
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

it.effect("reports the byte limit crossed by a copied prefix before a later hole", () =>
  Effect.gen(function*() {
    // Array concatenation keeps the hole that Effect's spreading constructors fill.
    const holed = Arr.make<[unknown, ...Array<unknown>]>(1, 2, 3).concat(Arr.allocate(1))
    const expected = Exit.fail(new CanonicalJson.ByteLimitExceeded({}))
    expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(Schema.Unknown, holed, 16)))
      .toStrictEqual(Exit.fail(new CanonicalJson.UnsupportedValue({ reason: "sparse-array" })))
    // `[1,2` already exceeds four bytes; the hole at index 3 is never reached.
    expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(Schema.Unknown, holed, 4)))
      .toStrictEqual(expected)
    expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(Schema.Unknown, Arr.make(1, NaN), 2)))
      .toStrictEqual(expected)
    expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(Schema.Unknown, { a: 1, b: NaN }, 8)))
      .toStrictEqual(expected)
    expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(Schema.Unknown, { a: 1, b: NaN }, 11)))
      .toStrictEqual(Exit.fail(new CanonicalJson.UnsupportedValue({ reason: "nan" })))
  }))

// Every field read before the limit is crossed, and no field after it, exactly
// as when each value is emitted on its own.
const counted = (reads: MutableRef.MutableRef<number>) => ({
  get v(): number {
    MutableRef.update(reads, N.increment)
    return 1
  }
})

const readsBeforeLimit: ReadonlyArray<
  readonly [string, (reads: MutableRef.MutableRef<number>) => unknown, number, number]
> = Arr.make(
  Tuple.make(
    "long keys",
    (reads: MutableRef.MutableRef<number>) =>
      Record.fromEntries(
        Arr.makeBy(50, (index) => Tuple.make(Str.concat(Str.repeat(1_000)("k"), Str.String(index)), counted(reads)))
      ),
    // `{"k…0":{"v":1},"k…1":{"v":1}` fits; the third key prefix crosses the limit before its record opens.
    2_500,
    2
  ),
  Tuple.make(
    "worst-case numbers",
    (reads: MutableRef.MutableRef<number>) =>
      Arr.append(Arr.makeBy(2_000, () => -1.2345678901234567e+308), counted(reads)),
    20_000,
    0
  ),
  Tuple.make(
    "dense escapes",
    (reads: MutableRef.MutableRef<number>) =>
      Arr.flatten(Arr.make(
        Arr.makeBy<unknown>(150, () => Str.repeat(300)("\n")),
        Arr.make(counted(reads)),
        Arr.makeBy<unknown>(50, () => Str.repeat(300)("\n"))
      )),
    70_000,
    0
  )
)

it.effect.each(readsBeforeLimit)(
  "reads no %s field after the byte limit is crossed",
  ([, make, limit, expectedReads]) =>
    Effect.gen(function*() {
      const reads = MutableRef.make(0)
      const value = make(reads)
      expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(Schema.Unknown, value, limit))).toStrictEqual(
        Exit.fail(new CanonicalJson.ByteLimitExceeded({}))
      )
      expect(MutableRef.get(reads)).toBe(expectedReads)
    })
)

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
    expect(yield* Effect.exit(ContentDigest.fromSchemaWithByteLimit(schema, value, N.decrement(bytes.byteLength))))
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
