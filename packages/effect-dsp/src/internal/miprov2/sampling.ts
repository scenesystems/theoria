/** One CPython stream shared by all phases of a MIPRO compile. @internal */
import { Context, Effect, Option } from "effect"
import * as Sampling from "../sampling/cpython.js"

export const Current = Context.Reference<Option.Option<Sampling.Sampling>>(
  "@scenesystems/effect-dsp/internal/miprov2/sampling/Current",
  { defaultValue: Option.none }
)

export const resolve = (seed: number) =>
  Effect.flatMap(Current, Option.match({ onNone: () => Sampling.make(seed), onSome: Effect.succeed }))
