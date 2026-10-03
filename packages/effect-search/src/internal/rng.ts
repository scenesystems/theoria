import { Effect, Number as Num, Random, Schema } from "effect"

export class RngState extends Schema.Class<RngState>("@scenesystems/effect-search/internal/rng/RngState")({
  seed: Schema.String
}) {}

export type Rng = Random.Random

export const make = (seed: string | number): Effect.Effect<Rng> => Random.Random.pipe(Random.withSeed(seed))

export const nextFloat = (rng: Rng, low = 0, high = 1) =>
  Random.nextBetween(low, high).pipe(Effect.provideService(Random.Random, rng))

export const nextInt = (rng: Rng, low: number, high: number) =>
  Random.nextIntBetween(low, high).pipe(
    Effect.provideService(Random.Random, rng),
    Effect.map((value) =>
      Num.clamp(value, {
        minimum: low,
        maximum: high
      })
    )
  )

export const nextBoolean = (rng: Rng) => Random.nextBoolean.pipe(Effect.provideService(Random.Random, rng))
