import { BunServices } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Array, BigInt, Cause, Chunk, Effect, Exit, Option, Result, Schema } from "effect"
import * as PseudoRandom from "../../src/PseudoRandom.js"
import { CPythonRandomFixture } from "../helpers/fixtures/randomSchemas.js"
import { loadFixture } from "../helpers/fixtures/registry.js"

const reference = Effect.gen(function*() {
  const fixture = yield* Schema.decodeUnknownEffect(CPythonRandomFixture)(yield* loadFixture("cpython-random-001"), {
    onExcessProperty: "error"
  })
  return fixture.payload.cases
}).pipe(Effect.provide(BunServices.layer))

// Array.makeBy yields at least one element; take keeps the empty population empty.
const population = (size: number) => Chunk.fromIterable(Array.take(Array.makeBy(size, (i) => i), size))

// CPython raises ValueError/IndexError for these domains; invalid n would otherwise reject forever.
const invalid = (rng: PseudoRandom.CPython): ReadonlyArray<Effect.Effect<unknown, PseudoRandom.InvalidArgument>> => [
  rng.randbelowValidated(0n),
  rng.randbelowValidated(-3n),
  rng.choiceValidated(Chunk.empty<string>()),
  rng.randintValidated(5, 4),
  rng.randintValidated(0.5, 2),
  rng.getrandbitsValidated(-1),
  rng.getrandbitsValidated(1.5),
  rng.sampleValidated(population(30), 31),
  rng.sampleValidated(population(5), 6),
  rng.sampleValidated(population(5), -1)
]

const trusted = (rng: PseudoRandom.CPython): ReadonlyArray<Effect.Effect<unknown>> => [
  rng.randbelow(0n),
  rng.randbelow(-3n),
  rng.choice(Chunk.empty<string>()),
  rng.randint(5, 4),
  rng.getrandbits(-1),
  rng.sample(population(30), 31)
]

it.effect("validated CPython draws reject out-of-domain arguments without consuming the stream", () =>
  Effect.gen(function*() {
    const entry = Option.getOrThrow(Array.head(yield* reference))
    const rng = yield* PseudoRandom.makeCPython(Option.getOrThrow(BigInt.fromString(entry.seed)))
    const failures = yield* Effect.forEach(invalid(rng), (draw) => Effect.flip(Effect.asVoid(draw)))
    Array.forEach(failures, (failure) => {
      expect(failure).toBeInstanceOf(PseudoRandom.InvalidArgument)
    })
    expect(yield* Effect.forEach(Array.take(entry.random, 3), () => rng.random())).toEqual(Array.take(entry.random, 3))
  }))

it.effect("trusted CPython draws surface a violated precondition as an immediate defect before drawing", () =>
  Effect.gen(function*() {
    const entry = Option.getOrThrow(Array.head(yield* reference))
    const rng = yield* PseudoRandom.makeCPython(Option.getOrThrow(BigInt.fromString(entry.seed)))
    const exits = yield* Effect.forEach(trusted(rng), Effect.exit)
    Array.forEach(exits, (exit) => {
      const defect = Exit.match(exit, {
        onFailure: (cause) =>
          Result.match(Cause.findDefect(cause), { onFailure: () => Option.none(), onSuccess: Option.some }),
        onSuccess: () => Option.none()
      })
      expect(Option.getOrThrow(defect)).toBeInstanceOf(PseudoRandom.InvalidArgument)
    })
    expect(yield* Effect.forEach(Array.take(entry.random, 3), () => rng.random())).toEqual(Array.take(entry.random, 3))
  }))

it.effect("cpython-random-001: validated draws reproduce the CPython stream byte for byte", () =>
  Effect.gen(function*() {
    yield* Effect.forEach(yield* reference, (entry) =>
      Effect.gen(function*() {
        const rng = yield* PseudoRandom.makeCPython(Option.getOrThrow(BigInt.fromString(entry.seed)))
        expect(yield* Effect.forEach(entry.random, () => rng.random())).toEqual(entry.random)
        yield* Effect.forEach(entry.bits, (bits) =>
          Effect.gen(function*() {
            expect(yield* rng.getrandbitsValidated(bits.k)).toBe(Option.getOrThrow(BigInt.fromString(bits.value)))
          }))
        yield* Effect.forEach(entry.below, (below) =>
          Effect.gen(function*() {
            expect(
              yield* Effect.forEach(
                below.values,
                () => rng.randbelowValidated(Option.getOrThrow(BigInt.fromString(below.n)))
              )
            ).toEqual(Array.map(below.values, (value) => Option.getOrThrow(BigInt.fromString(value))))
          }))
        yield* Effect.forEach(entry.integers, (ints) =>
          Effect.gen(function*() {
            expect(yield* Effect.forEach(ints.values, () => rng.randintValidated(ints.a, ints.b))).toEqual(ints.values)
          }))
        expect(yield* Effect.forEach(entry.choices, () => rng.choiceValidated(Chunk.make("a", "b", "c", "d", "e"))))
          .toEqual(entry.choices)
        yield* Effect.forEach(entry.shuffles, (values) =>
          Effect.gen(function*() {
            expect(Array.fromIterable(yield* rng.shuffle(population(values.length)))).toEqual(values)
          }))
        yield* Effect.forEach(entry.samples, (sample) =>
          Effect.gen(function*() {
            expect(Array.fromIterable(yield* rng.sampleValidated(population(sample.n), sample.k))).toEqual(
              sample.value
            )
          }))
        expect(yield* Effect.forEach(entry.tail, () => rng.random())).toEqual(entry.tail)
      }))
  }))

it.effect("a stream constructed from a captured state continues the captured CPython sequence", () =>
  Effect.gen(function*() {
    const entry = Option.getOrThrow(Array.head(yield* reference))
    const rng = yield* PseudoRandom.makeCPython(Option.getOrThrow(BigInt.fromString(entry.seed)))
    yield* Effect.forEach(Array.take(entry.random, 5), () => rng.random())
    const continued = new PseudoRandom.CPython(yield* rng.snapshot)
    expect(yield* Effect.forEach(Array.take(Array.drop(entry.random, 5), 4), () => continued.random())).toEqual(
      Array.take(Array.drop(entry.random, 5), 4)
    )
    expect(yield* Effect.forEach(Array.take(Array.drop(entry.random, 5), 4), () => rng.random())).toEqual(
      Array.take(Array.drop(entry.random, 5), 4)
    )
  }))
