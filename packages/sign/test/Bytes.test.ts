import { describe, expect, it } from "@effect/vitest"
import * as Bytes from "@scenesystems/sign/Bytes"
import * as Verification from "@scenesystems/sign/Verification"
import {
  Array as Arr,
  Cause,
  Context,
  Deferred,
  Effect,
  Equivalence,
  Exit,
  Fiber,
  Ref,
  Schema,
  Stream,
  Tuple
} from "effect"

const byteChunks = Schema.Array(
  Schema.Array(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 255 })))
    .check(Schema.isMaxLength(32))
).check(Schema.isMaxLength(16))

describe("Bytes.fromString", () => {
  it.effect("preserves Unicode scalars, BOM, combining marks, and NUL without normalization", () =>
    Effect.gen(function*() {
      expect(Arr.fromIterable(yield* Bytes.fromString("Aé🔑e\u0301\0"))).toEqual(
        Arr.make(0x41, 0xc3, 0xa9, 0xf0, 0x9f, 0x94, 0x91, 0x65, 0xcc, 0x81, 0x00)
      )
      expect(Arr.fromIterable(yield* Bytes.fromString("\ufeffA"))).toEqual(
        Arr.make(0xef, 0xbb, 0xbf, 0x41)
      )
      expect(Arr.fromIterable(yield* Bytes.fromString("🔑"))).toEqual(
        Arr.make(0xf0, 0x9f, 0x94, 0x91)
      )
      expect(Arr.fromIterable(yield* Bytes.fromString(""))).toEqual(Arr.empty())
    }))

  it.effect("replaces lone UTF-16 surrogates and returns a fresh byte array", () =>
    Effect.gen(function*() {
      expect(Arr.fromIterable(yield* Bytes.fromString("\ud800"))).toEqual(
        Arr.make(0xef, 0xbf, 0xbd)
      )
      expect(Arr.fromIterable(yield* Bytes.fromString("\udc00"))).toEqual(
        Arr.make(0xef, 0xbf, 0xbd)
      )

      const encoding = Bytes.fromString("fresh")
      const first = yield* encoding
      first[0] = 0
      const second = yield* encoding
      expect(Equivalence.strictEqual<Uint8Array>()(first, second)).toBe(false)
      expect(second[0]).toBe(0x66)
    }))
})

describe("Bytes.collect", () => {
  it.effect.prop("buffers schema-generated chunks up to the inclusive limit", {
    chunks: byteChunks
  }, ({ chunks }) =>
    Effect.gen(function*() {
      const bytes = yield* Bytes.collect(Stream.fromIterable(Arr.map(chunks, (chunk) => new Uint8Array(chunk))))
      expect(Arr.fromIterable(bytes)).toEqual(Arr.flatten(chunks))
    }))

  it.effect("accepts exactly 8192 bytes and rejects one byte over", () =>
    Effect.gen(function*() {
      expect((yield* Bytes.collect(Stream.make(new Uint8Array(8_192)))).length).toBe(8_192)
      expect(yield* Effect.flip(Bytes.collect(Stream.make(new Uint8Array(8_193)))))
        .toEqual(new Verification.InvalidInput({}))
    }))

  it.effect("counts across chunks, resets on replay, and stops pulling after exceeding the limit", () =>
    Effect.gen(function*() {
      const complete = Bytes.collect(Stream.make(new Uint8Array(8191), new Uint8Array(1)))
      expect((yield* complete).length).toBe(8192)
      expect((yield* complete).length).toBe(8192)
      const traversed = yield* Ref.make(false)
      const finalized = yield* Ref.make(false)
      const stream = Stream.make(new Uint8Array(8191), new Uint8Array(2)).pipe(
        Stream.concat(Stream.fromEffect(Ref.set(traversed, true).pipe(Effect.as(new Uint8Array())))),
        Stream.ensuring(Ref.set(finalized, true))
      )
      expect(yield* Effect.flip(Bytes.collect(stream))).toEqual(new Verification.InvalidInput({}))
      expect(yield* Ref.get(traversed)).toBe(false)
      expect(yield* Ref.get(finalized)).toBe(true)
    }))

  it.effect("preserves service requirements and releases pending input on interruption", () =>
    Effect.gen(function*() {
      class Input extends Context.Service<Input, Uint8Array>()("test/Bytes/Input") {}
      const input = new Uint8Array(Arr.make(3, 9, 2))
      const operation = Bytes.collect(Stream.fromEffect(Input))
      expect(yield* operation.pipe(Effect.provideService(Input, input))).toEqual(input)
      const started = yield* Deferred.make<void>()
      const released = yield* Ref.make(false)
      const pending = Stream.fromEffect(Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never)))
        .pipe(Stream.ensuring(Ref.set(released, true)))
      const fiber = yield* Bytes.collect(pending).pipe(Effect.forkChild)
      yield* Deferred.await(started)
      yield* Fiber.interrupt(fiber)
      expect(Exit.match(yield* Fiber.await(fiber), { onSuccess: () => false, onFailure: Cause.hasInterruptsOnly }))
        .toBe(true)
      expect(yield* Ref.get(released)).toBe(true)
    }))

  it.effect("preserves upstream errors and scope finalization", () =>
    Effect.gen(function*() {
      const finalized = yield* Ref.make(false)
      const failure = new Verification.Unavailable({})
      const stream = Stream.make(new Uint8Array()).pipe(
        Stream.concat(Stream.fail(failure)),
        Stream.ensuring(Ref.set(finalized, true))
      )
      expect(yield* Effect.flip(Bytes.collect(stream))).toBe(failure)
      expect(yield* Ref.get(finalized)).toBe(true)
    }))
})

describe("Bytes.equal", () => {
  it.effect("compares contents and lengths in both directions, including empty and single-bit differences", () =>
    Effect.forEach(
      Arr.make(
        Tuple.make(Arr.make(1, 2, 3), Arr.make(1, 2, 3), true),
        Tuple.make(Arr.make(1, 2, 3), Arr.make(1, 2, 4), false),
        Tuple.make(Arr.make(1, 2, 3), Arr.make(0, 2, 3), false),
        Tuple.make(Arr.make(1, 2, 3), Arr.make(1, 2), false),
        Tuple.make(Arr.empty<number>(), Arr.empty<number>(), true),
        Tuple.make(Arr.empty<number>(), Arr.of(0), false),
        Tuple.make(Arr.of(0xff), Arr.of(0xfe), false)
      ),
      ([left, right, expected]) =>
        Effect.gen(function*() {
          const a = new Uint8Array(left)
          const b = new Uint8Array(right)
          expect(Bytes.equal(a, b)).toBe(expected)
          expect(Bytes.equal(b, a)).toBe(expected)
        })
    ))
})
