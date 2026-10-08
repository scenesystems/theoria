import { BunServices } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Array, BigInt, Chunk, Effect, Option, Result, Schema } from "effect"
import * as PseudoRandom from "../../src/PseudoRandom.js"
import { CPythonRandomFixture, NumPyRandomFixture } from "../helpers/fixtures/randomSchemas.js"
import { loadFixture } from "../helpers/fixtures/registry.js"

it.effect("cpython-random-001: exact mixed operations, seed chunks, twist boundaries and sample branches", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(CPythonRandomFixture)(
      yield* loadFixture("cpython-random-001"),
      {
        onExcessProperty: "error"
      }
    )
    yield* Effect.forEach(reference.payload.cases, (entry) =>
      Effect.gen(function*() {
        const rng = yield* PseudoRandom.makeCPython(Option.getOrThrow(BigInt.fromString(entry.seed)))
        expect(yield* Effect.forEach(entry.random, () => rng.random())).toEqual(entry.random)
        yield* Effect.forEach(entry.bits, (bits) =>
          Effect.gen(function*() {
            expect(yield* rng.getrandbits(bits.k)).toBe(yield* Schema.decodeEffect(Schema.BigIntFromString)(bits.value))
          }))
        yield* Effect.forEach(entry.below, (below) =>
          Effect.gen(function*() {
            expect(
              yield* Effect.forEach(
                below.values,
                () => rng.randbelow(Option.getOrThrow(BigInt.fromString(below.n)))
              )
            )
              .toEqual(yield* Schema.decodeEffect(Schema.Array(Schema.BigIntFromString))(below.values))
          }))
        yield* Effect.forEach(entry.integers, (ints) =>
          Effect.gen(function*() {
            expect(yield* Effect.forEach(ints.values, () => rng.randint(ints.a, ints.b))).toEqual(ints.values)
          }))
        expect(yield* Effect.forEach(entry.choices, () => rng.choice(Chunk.make("a", "b", "c", "d", "e"))))
          .toEqual(entry.choices)
        yield* Effect.forEach(entry.shuffles, (values) =>
          Effect.gen(function*() {
            expect(
              Array.fromIterable(
                yield* rng.shuffle(Chunk.fromIterable(Array.take(Array.makeBy(values.length, (i) => i), values.length)))
              )
            )
              .toEqual(values)
          }))
        yield* Effect.forEach(entry.samples, (sample) =>
          Effect.gen(function*() {
            expect(
              Array.fromIterable(yield* rng.sample(Chunk.fromIterable(Array.makeBy(sample.n, (i) => i)), sample.k))
            )
              .toEqual(sample.value)
          }))
        const saved = yield* rng.snapshot
        const wire = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.toCodecJson(PseudoRandom.State)))(saved)
        expect(yield* Effect.forEach(entry.tail, () => rng.random())).toEqual(entry.tail)
        yield* rng.restore(
          yield* Schema.decodeEffect(Schema.fromJsonString(Schema.toCodecJson(PseudoRandom.State)))(wire)
        )
        expect(yield* Effect.forEach(entry.tail, () => rng.random())).toEqual(entry.tail)
      }))
  }).pipe(Effect.provide(BunServices.layer)))

it.effect("numpy-random-001: bit-exact legacy integer seeding, batches, uniform and weighted choice", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(NumPyRandomFixture)(yield* loadFixture("numpy-random-001"), {
      onExcessProperty: "error"
    })
    yield* Effect.forEach(reference.payload.cases, (entry) =>
      Effect.gen(function*() {
        const rng = yield* PseudoRandom.makeNumPyLegacy(entry.seed)
        expect(yield* Effect.forEach(entry.random, () => rng.randomSample())).toEqual(entry.random)
        yield* Effect.forEach(entry.batches, (batch) =>
          Effect.gen(function*() {
            expect(Array.fromIterable(yield* rng.rand(batch.size))).toEqual(batch.values)
          }))
        yield* Effect.forEach(entry.uniform, (batch) =>
          Effect.gen(function*() {
            expect(Array.fromIterable(yield* rng.uniform(batch.low, batch.high, batch.values.length))).toEqual(
              batch.values
            )
          }))
        yield* Effect.forEach(entry.choices, (batch) =>
          Effect.gen(function*() {
            expect(
              Array.fromIterable(yield* rng.choice(batch.p.length, Chunk.fromIterable(batch.p), batch.values.length))
            )
              .toEqual(batch.values)
          }))
        const saved = yield* rng.snapshot
        expect(Array.fromIterable(yield* rng.rand(entry.tail.length))).toEqual(entry.tail)
        yield* rng.restore(saved)
        expect(Array.fromIterable(yield* rng.rand(entry.tail.length))).toEqual(entry.tail)

        const normalized = Option.getOrThrow(Array.head(entry.boundaries)).values
        yield* Effect.forEach(entry.boundaries, (boundary) =>
          Effect.gen(function*() {
            const trial = yield* PseudoRandom.makeNumPyLegacy(entry.seed)
            const before = yield* trial.snapshot
            const result = yield* trial.choice(3, Chunk.fromIterable(boundary.p), 200).pipe(Effect.result)
            expect(Result.isSuccess(result)).toBe(boundary.accepted)
            yield* Result.match(result, {
              onSuccess: (values) =>
                Effect.sync(() => {
                  expect(Array.fromIterable(values)).toEqual(boundary.values)
                  expect(Array.fromIterable(values)).toEqual(normalized)
                }),
              onFailure: () =>
                Effect.gen(function*() {
                  expect(yield* trial.snapshot).toEqual(before)
                })
            })
          }))
      }))
    yield* Effect.forEach([-1, 4294967296, 0.5], (seed) =>
      Effect.gen(function*() {
        expect(Result.isFailure(yield* PseudoRandom.makeNumPyLegacy(seed).pipe(Effect.result))).toBe(true)
      }))
  }).pipe(Effect.provide(BunServices.layer)))
