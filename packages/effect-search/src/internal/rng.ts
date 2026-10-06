import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Effect, Number as Num, Option, Random, Schema, SynchronizedRef, Tuple } from "effect"
import { InvalidOptimizationConfig, InvalidSamplerConfig } from "../SearchError.js"

export class RngState extends Schema.Class<RngState>("@scenesystems/effect-search/internal/rng/RngState")({
  seed: Schema.String
}) {}

export type Rng = Random.Random | PseudoRandom.NumPyLegacy

/** One lazily initialized stream; snapshots do not advance it. */
export class NumPyStream {
  private readonly state = SynchronizedRef.makeUnsafe(Option.none<PseudoRandom.NumPyLegacy>())
  constructor(private readonly seed: number) {}
  get get(): Effect.Effect<PseudoRandom.NumPyLegacy, InvalidSamplerConfig> {
    return SynchronizedRef.modifyEffect(this.state, (current) =>
      Option.match(current, {
        onSome: (rng) => Effect.succeed(Tuple.make(rng, current)),
        onNone: () =>
          PseudoRandom.makeNumPyLegacy(this.seed).pipe(
            Effect.map((rng) => Tuple.make(rng, Option.some(rng))),
            Effect.mapError((error) => new InvalidSamplerConfig({ sampler: "random", reason: error.message }))
          )
      }))
  }
  get snapshot(): Effect.Effect<Option.Option<PseudoRandom.State>> {
    return SynchronizedRef.get(this.state).pipe(Effect.flatMap(Option.match({
      onNone: () => Effect.succeedNone,
      onSome: (rng) => rng.snapshot.pipe(Effect.asSome)
    })))
  }
  restore(snapshot: Option.Option<PseudoRandom.State>): Effect.Effect<void, InvalidOptimizationConfig> {
    return Option.match(snapshot, {
      onNone: () => SynchronizedRef.set(this.state, Option.none()),
      onSome: (saved) =>
        this.get.pipe(
          Effect.flatMap((rng) => rng.restore(saved)),
          Effect.mapError((error) => new InvalidOptimizationConfig({ reason: error.reason }))
        )
    })
  }
}

export const make = (seed: string | number): Effect.Effect<Rng> => Random.Random.pipe(Random.withSeed(seed))

export const nextFloat = (rng: Rng, low = 0, high = 1) =>
  rng instanceof PseudoRandom.NumPyLegacy
    ? rng.randomSample().pipe(Effect.map((value) => Num.sum(low, Num.multiply(Num.subtract(high, low), value))))
    : Random.nextBetween(low, high).pipe(Effect.provideService(Random.Random, rng))

export const nextInt = (rng: Rng, low: number, high: number) =>
  rng instanceof PseudoRandom.NumPyLegacy
    ? nextFloat(rng, low, Num.increment(high)).pipe(Effect.map(Numeric.floor))
    : Random.nextIntBetween(low, high).pipe(
      Effect.provideService(Random.Random, rng),
      Effect.map((value) =>
        Num.clamp(value, {
          minimum: low,
          maximum: high
        })
      )
    )

export const nextBoolean = (rng: Rng) =>
  rng instanceof PseudoRandom.NumPyLegacy
    ? nextFloat(rng).pipe(Effect.map(Num.isGreaterThanOrEqualTo(0.5)))
    : Random.nextBoolean.pipe(Effect.provideService(Random.Random, rng))
