import { Effect, Number as Num, Random, Schema } from "effect"

export class RngState extends Schema.Class<RngState>("effect-search/RngState")({
  seed: Schema.String
}) {}

export type Rng = Random.Random

export const make = <A>(seed: A): Rng => Random.make(seed)

export const nextFloat = (rng: Rng, low = 0, high = 1) => rng.nextRange(low, high)

export const nextInt = (rng: Rng, low: number, high: number) =>
  rng.nextIntBetween(low, Num.increment(high)).pipe(
    Effect.map((value) =>
      Num.clamp(value, {
        minimum: low,
        maximum: high
      })
    )
  )

export const nextBoolean = (rng: Rng) => rng.nextBoolean
