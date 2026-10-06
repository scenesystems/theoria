/** One CPython stream shared by all phases of a MIPRO compile. @internal */
import * as PseudoRandom from "@scenesystems/effect-math/PseudoRandom"
import { Context, Effect, Option } from "effect"

export const Current = Context.Reference<Option.Option<PseudoRandom.CPython>>(
  "@scenesystems/effect-dsp/internal/miprov2/sampling/Current",
  { defaultValue: Option.none }
)

export const resolve = (seed: number) =>
  Effect.flatMap(Current, Option.match({ onNone: () => PseudoRandom.makeCPython(seed), onSome: Effect.succeed }))
