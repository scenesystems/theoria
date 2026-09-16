/** Shared schemas for finite benchmark observations and failures. */
import { Data, Schema } from "effect"

export class UnexpectedVerdict extends Data.TaggedError("UnexpectedVerdict")<{
  readonly name: string
}> {}

export const Sample = Schema.Struct({
  name: Schema.String,
  warmups: Schema.Int,
  samples: Schema.Int
})
