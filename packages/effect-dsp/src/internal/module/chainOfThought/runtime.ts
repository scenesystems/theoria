/**
 * Chain-of-thought runtime transformation over the canonical predict kernel.
 *
 * @since 0.1.0
 * @category internal
 */
import type { Schema } from "effect"
import { Effect } from "effect"
import type { SignatureError } from "../../../DspError.js"
import type { ChainOfThoughtOutputFields, Module, PredictOptions } from "../../../Module.js"
import type * as Signature from "../../../Signature.js"
import { predict } from "../predict/construct.js"
import { toChainOfThoughtSignature } from "./schema.js"

/**
 * Build chain-of-thought modules by transforming signatures and delegating to `Module.predict`.
 *
 * @since 0.1.0
 * @category internal
 */
export const makeChainOfThought = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly name: string
  readonly signature: Signature.Signature<I, O>
  readonly predictOptions: PredictOptions
}): Effect.Effect<Module<I, ChainOfThoughtOutputFields<O>>, SignatureError> =>
  toChainOfThoughtSignature(options.signature).pipe(
    Effect.flatMap((signature) => predict(options.name, signature, options.predictOptions))
  )
