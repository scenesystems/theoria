/**
 * Chain-of-thought runtime transformation over the canonical predict kernel.
 *
 * @since 0.1.0
 * @category internal
 */
import type { Schema } from "effect"
import { Effect } from "effect"
import type { SignatureError } from "../../Errors/signature.js"
import type * as Signature from "../../Signature/index.js"
import type { Module } from "../model.js"
import { predict, type PredictOptions } from "../predict/index.js"
import { type ChainOfThoughtOutputFields, toChainOfThoughtSignature } from "./schema.js"

/**
 * Build chain-of-thought modules by transforming signatures and delegating to `Module.predict`.
 *
 * @since 0.1.0
 * @category internal
 */
export const ChainOfThoughtRuntime = {
  allocate: <
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
}
