import { expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Schema } from "effect"
import * as Sampling from "../src/internal/sampling/cpython.js"
import * as MT from "../src/internal/sampling/mersenneTwister.js"
import { fixture } from "./kit/Fixtures.js"

const Payload = Schema.Struct({
  cases: Schema.Array(Schema.Struct({
    seed: Schema.String,
    random: Schema.Array(Schema.Finite),
    bits: Schema.Array(Schema.Struct({ k: Schema.Int, value: Schema.String })),
    below: Schema.Array(Schema.Struct({ n: Schema.String, values: Schema.Array(Schema.String) })),
    integers: Schema.Array(Schema.Struct({ a: Schema.Int, b: Schema.Int, values: Schema.Array(Schema.Int) })),
    choices: Schema.Array(Schema.String),
    shuffles: Schema.Array(Schema.Array(Schema.Int)),
    samples: Schema.Array(Schema.Struct({ n: Schema.Int, k: Schema.Int, value: Schema.Array(Schema.Int) })),
    tail: Schema.Array(Schema.Finite)
  }))
})

it.effect("cpython-random-001: bit-exact mixed operations, seed chunks, twist boundaries and sample branches", () =>
  Effect.gen(function*() {
    const reference = yield* Schema.decodeUnknownEffect(Payload)(
      (yield* fixture("cpython-random-001", "upstream-kernel")).payload
    )
    yield* Effect.forEach(reference.cases, (entry) =>
      Effect.gen(function*() {
        const rng = yield* Sampling.make(BigInt(entry.seed))
        expect(yield* Effect.forEach(entry.random, () => rng.random())).toEqual(entry.random)
        yield* Effect.forEach(entry.bits, (bits) =>
          Effect.gen(function*() {
            expect((yield* rng.getrandbits(bits.k)).toString()).toBe(bits.value)
          }))
        yield* Effect.forEach(entry.below, (below) =>
          Effect.gen(function*() {
            expect(yield* Effect.forEach(below.values, () => rng.randbelow(BigInt(below.n)).pipe(Effect.map(String))))
              .toEqual(below.values)
          }))
        yield* Effect.forEach(entry.integers, (ints) =>
          Effect.gen(function*() {
            expect(yield* Effect.forEach(ints.values, () => rng.randint(ints.a, ints.b))).toEqual(ints.values)
          }))
        expect(yield* Effect.forEach(entry.choices, () => rng.choice(["a", "b", "c", "d", "e"]))).toEqual(entry.choices)
        yield* Effect.forEach(entry.shuffles, (values) =>
          Effect.gen(function*() {
            expect(yield* rng.shuffle(Arr.take(Arr.makeBy(values.length, (i) => i), values.length))).toEqual(values)
          }))
        yield* Effect.forEach(entry.samples, (sample) =>
          Effect.gen(function*() {
            expect(yield* rng.sample(Arr.makeBy(sample.n, (i) => i), sample.k)).toEqual(sample.value)
          }))
        expect(yield* Effect.forEach(entry.tail, () => rng.random())).toEqual(entry.tail)
        const initial = MT.seed(BigInt(entry.seed))
        const saved = Arr.fromIterable(initial.words)
        const first = MT.random(initial)
        expect(first.value).toBe(entry.random[0])
        expect(MT.random(first.state).value).toBe(entry.random[1])
        expect(initial.words).toEqual(saved)
        expect(MT.random(initial)).toEqual(first)
      }))
  }))
