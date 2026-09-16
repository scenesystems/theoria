/**
 * Streaming digest contract tests.
 */

import { describe, expect, it } from "@effect/vitest"
import {
  Array as Arr,
  Boolean as B,
  Deferred,
  Effect,
  Exit,
  FastCheck as fc,
  Fiber,
  Number as N,
  Option,
  Ref,
  Schema,
  Stream,
  String as Str,
  Tuple
} from "effect"
import * as Digest from "../../src/Digest.js"
import * as Utf8 from "../../src/Utf8.js"
import { encodeFixtureUtf8 } from "../helpers/bytes.js"

const ByteChunks = Schema.Array(Schema.Uint8ArrayFromSelf)
const SplitPoints = Schema.Array(Schema.NonNegativeInt)
const SplitDecisions = Schema.Array(Schema.Boolean)
const Partitions = Schema.Array(SplitPoints)

const concatBytes = (chunks: typeof ByteChunks.Type) =>
  Schema.decode(Schema.Uint8Array)(Arr.flatMap(chunks, Arr.fromIterable))

const partitionAt = (text: string, cuts: typeof SplitPoints.Type) => {
  const boundaries = Arr.append(Arr.prepend(cuts, 0), Str.length(text))
  return Arr.map(
    Arr.zip(Arr.dropRight(boundaries, 1), Arr.drop(boundaries, 1)),
    ([start, end]) => Str.slice(start, end)(text)
  )
}

const everyPartition = (text: string) => {
  const boundaries = Arr.makeBy(N.max(0, N.decrement(Str.length(text))), N.increment)
  const choices = Arr.reduce<number, typeof Partitions.Type>(
    boundaries,
    Arr.of(Arr.empty<number>()),
    (cuts, boundary) =>
      Arr.cartesianWith(
        cuts,
        Arr.make(false, true),
        (cut, split) => B.match(split, { onFalse: () => cut, onTrue: () => Arr.append(cut, boundary) })
      )
  )
  return Arr.map(choices, (cuts) => partitionAt(text, cuts))
}

const randomPartition = (text: string, splitAfter: typeof SplitDecisions.Type) =>
  partitionAt(
    text,
    Arr.filter(
      Arr.makeBy(N.max(0, N.decrement(Str.length(text))), N.increment),
      (boundary) => Option.contains(true)(Arr.get(splitAfter, N.decrement(boundary)))
    )
  )

const wellFormedString = fc.fullUnicodeString({ maxLength: 64 })
const randomChunkBoundaries = fc.array(fc.boolean(), { maxLength: 64 })

describe("Digest.hashStream", () => {
  it.effect("matches one-shot hashing for BLAKE3", () =>
    Effect.gen(function*() {
      const chunks = Arr.make(encodeFixtureUtf8("hello "), encodeFixtureUtf8("streaming "), encodeFixtureUtf8("digest"))
      const streamed = yield* Digest.hashStream("blake3-256", Stream.fromIterable(chunks))
      const oneShot = Digest.hash("blake3-256", yield* concatBytes(chunks))
      expect(streamed).toEqual(oneShot)
    }))

  it.effect("matches one-shot hashing for SHA-256", () =>
    Effect.gen(function*() {
      const chunks = Arr.make(encodeFixtureUtf8("hello "), encodeFixtureUtf8("streaming "), encodeFixtureUtf8("digest"))
      const streamed = yield* Digest.hashStream("sha256", Stream.fromIterable(chunks))
      const oneShot = Digest.hash("sha256", yield* concatBytes(chunks))
      expect(streamed).toEqual(oneShot)
    }))

  it.effect("empty stream matches empty-input digest", () =>
    Effect.gen(function*() {
      const streamed = yield* Digest.hashStream("blake3-256", Stream.empty)
      const oneShot = Digest.hash("blake3-256", yield* Schema.decode(Schema.Uint8Array)(Arr.empty()))
      expect(streamed).toEqual(oneShot)
    }))

  it.effect("chunk boundaries do not change digest value", () =>
    Effect.gen(function*() {
      const whole = Arr.fromIterable(encodeFixtureUtf8("boundary-invariant-payload"))
      const splitA = yield* Effect.forEach(Arr.make(Arr.take(whole, 8), Arr.drop(whole, 8)), (bytes) =>
        Schema.decode(Schema.Uint8Array)(bytes))
      const splitB = yield* Effect.forEach(
        Arr.make(
          Arr.take(whole, 1),
          Arr.take(Arr.drop(whole, 1), 4),
          Arr.take(Arr.drop(whole, 5), 8),
          Arr.drop(whole, 13)
        ),
        (bytes) =>
          Schema.decode(Schema.Uint8Array)(bytes)
      )

      const a = yield* Digest.hashStream("sha256", Stream.fromIterable(splitA))
      const b = yield* Digest.hashStream("sha256", Stream.fromIterable(splitB))
      expect(a).toEqual(b)
    }))

  it.effect("chunk order affects digest value", () =>
    Effect.gen(function*() {
      const forward = Arr.make(encodeFixtureUtf8("A"), encodeFixtureUtf8("B"), encodeFixtureUtf8("C"))
      const reverse = Arr.reverse(forward)

      const a = yield* Digest.hashStream("blake3-256", Stream.fromIterable(forward))
      const b = yield* Digest.hashStream("blake3-256", Stream.fromIterable(reverse))
      expect(a).not.toEqual(b)
    }))

  it.effect("re-running the same digest effect yields stable output", () =>
    Effect.gen(function*() {
      const chunks = Arr.make(encodeFixtureUtf8("reuse-"), encodeFixtureUtf8("safe"))
      const program = Digest.hashStream("sha256", Stream.fromIterable(chunks))

      const first = yield* program
      const second = yield* program

      expect(second).toStrictEqual(first)
    }))
})

describe("Digest.hashStringStream", () => {
  it.effect("accepts a pair split at every chunk boundary", () =>
    Effect.gen(function*() {
      const text = "A😀B"
      const oneShot = yield* Digest.hashString("sha256", text)

      yield* Effect.forEach(everyPartition(text), (chunks) =>
        Effect.gen(function*() {
          const streamed = yield* Digest.hashStringStream("sha256", Stream.fromIterable(chunks))
          expect(streamed).toEqual(oneShot)
        }))
    }))

  it.effect("preserves a carried pair across empty chunks and retains an initial U+FEFF", () =>
    Effect.gen(function*() {
      const chunks = Stream.make("", "\ufeffA\ud83d", "", "", "\ude00B", "")
      expect(yield* Digest.hashStringStream("sha256", chunks)).toEqual(yield* Digest.hashString("sha256", "\ufeffA😀B"))
      expect(yield* Digest.hashStringStream("sha256", Stream.make("", ""))).toEqual(
        yield* Digest.hashString("sha256", "")
      )
    }))

  it.effect("interrupts a pending surrogate stream and releases the upstream resource", () =>
    Effect.gen(function*() {
      const waiting = yield* Deferred.make<void>()
      const finalized = yield* Ref.make(false)
      const chunks = Stream.concat(
        Stream.make("x\ud800"),
        Stream.fromEffect(Deferred.succeed(waiting, undefined).pipe(Effect.zipRight(Effect.never)))
      ).pipe(Stream.ensuring(Ref.set(finalized, true)))
      const fiber = yield* Digest.hashStringStream("sha256", chunks).pipe(Effect.fork)
      yield* Deferred.await(waiting)
      expect(Exit.isInterrupted(yield* Fiber.interrupt(fiber))).toBe(true)
      expect(yield* Ref.get(finalized)).toBe(true)
    }))

  it.effect("rejects a leading low surrogate", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        Digest.hashStringStream("blake3-256", Stream.make("ab", "\uDC00c"))
      )

      expect(exit).toStrictEqual(Exit.fail(
        new Utf8.InvalidUnicode({
          kind: "lone-low-surrogate",
          codeUnitIndex: 2
        })
      ))
    }))

  it.effect("rejects a mismatched carried pair", () =>
    Effect.gen(function*() {
      const exit = yield* Effect.exit(
        Digest.hashStringStream("sha256", Stream.make("ab\uD800", "\uD801c"))
      )

      expect(exit).toStrictEqual(Exit.fail(
        new Utf8.InvalidUnicode({
          kind: "lone-high-surrogate",
          codeUnitIndex: 2
        })
      ))
    }))

  it.effect("fails an unresolved final carry", () =>
    Effect.gen(function*() {
      const chunks = Stream.make("ab", "\uD800")
      const expected = Exit.fail(
        new Utf8.InvalidUnicode({
          kind: "lone-high-surrogate",
          codeUnitIndex: 2
        })
      )
      expect(yield* Effect.exit(Digest.hashStringStream("blake3-256", chunks))).toStrictEqual(expected)
    }))

  it.effect("preserves upstream failures", () =>
    Effect.gen(function*() {
      const chunks = Stream.concat(Stream.make("valid"), Stream.fail("stream failed"))
      const result = yield* Effect.either(Digest.hashStringStream("blake3-256", chunks))

      expect(result).toMatchObject({ _tag: "Left", left: "stream failed" })
    }))

  it.effect.prop(
    "well-formed output is partition invariant",
    Tuple.make(wellFormedString, randomChunkBoundaries),
    ([text, splitAfter]) =>
      Effect.gen(function*() {
        const streamed = yield* Digest.hashStringStream(
          "sha256",
          Stream.fromIterable(randomPartition(text, splitAfter))
        )
        const oneShot = yield* Digest.hashString("sha256", text)

        expect(streamed).toEqual(oneShot)
      }),
    { fastCheck: { numRuns: 200, seed: 3629 } }
  )

  it.effect("malformed kind and absolute index are partition invariant", () =>
    Effect.forEach(
      Arr.make(
        {
          text: "a\uD800b",
          expected: new Utf8.InvalidUnicode({ kind: "lone-high-surrogate", codeUnitIndex: 1 })
        },
        {
          text: "a\uDC00b",
          expected: new Utf8.InvalidUnicode({ kind: "lone-low-surrogate", codeUnitIndex: 1 })
        },
        {
          text: "a\uD800\uD801b",
          expected: new Utf8.InvalidUnicode({ kind: "lone-high-surrogate", codeUnitIndex: 1 })
        }
      ),
      ({ expected, text }) =>
        Effect.forEach(everyPartition(text), (chunks) =>
          Effect.gen(function*() {
            const exit = yield* Effect.exit(Digest.hashStringStream("sha256", Stream.fromIterable(chunks)))
            expect(exit).toStrictEqual(Exit.fail(expected))
          }))
    ))
})

describe("stream failure propagation", () => {
  it.effect("hashStream preserves upstream stream errors", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(Digest.hashStream("sha256", Stream.fail("stream failed")))
      expect(result).toMatchObject({ _tag: "Left", left: "stream failed" })
    }))
})
