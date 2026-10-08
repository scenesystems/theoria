import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Effect, Match, Number as Num, Option, Random, Schema, SynchronizedRef, Tuple } from "effect"
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

export const isNumPyLegacy = Schema.is(Schema.instanceOf(PseudoRandom.NumPyLegacy))

export const nextFloat = (rng: Rng, low = 0, high = 1): Effect.Effect<number> =>
  Match.value(rng).pipe(
    Match.when(
      isNumPyLegacy,
      (legacy) =>
        legacy.randomSample().pipe(Effect.map((value) => Num.sum(low, Num.multiply(Num.subtract(high, low), value))))
    ),
    Match.orElse((random) => Random.nextBetween(low, high).pipe(Effect.provideService(Random.Random, random)))
  )

export const nextInt = (rng: Rng, low: number, high: number): Effect.Effect<number> =>
  Match.value(rng).pipe(
    Match.when(isNumPyLegacy, (legacy) => nextFloat(legacy, low, Num.increment(high)).pipe(Effect.map(Numeric.floor))),
    Match.orElse((random) =>
      Random.nextIntBetween(low, high).pipe(
        Effect.provideService(Random.Random, random),
        Effect.map((value) =>
          Num.clamp(value, {
            minimum: low,
            maximum: high
          })
        )
      )
    )
  )

export const nextBoolean = (rng: Rng): Effect.Effect<boolean> =>
  Match.value(rng).pipe(
    Match.when(isNumPyLegacy, (legacy) => nextFloat(legacy).pipe(Effect.map(Num.isGreaterThanOrEqualTo(0.5)))),
    Match.orElse((random) => Random.nextBoolean.pipe(Effect.provideService(Random.Random, random)))
  )
