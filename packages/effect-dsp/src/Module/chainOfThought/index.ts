/**
 * Chain-of-thought module constructor.
 *
 * @since 0.1.0
 */
import type { Effect, Schema } from "effect"
import type { SignatureError } from "../../Errors/signature.js"
import type * as Signature from "../../Signature/index.js"
import type { Module } from "../model.js"
import type { PredictOptions } from "../predict/index.js"
import { ChainOfThoughtRuntime } from "./runtime.js"
import type { ChainOfThoughtOutputFields } from "./schema.js"

const EMPTY_PREDICT_OPTIONS: PredictOptions = {}

/**
 * Create a predictor module that prepends a required `reasoning` field to
 * the output schema, forcing the language model to show its work before
 * producing the final answer. Reuses the canonical `predict` runtime —
 * only the signature and instructions are transformed.
 *
 * @see {@link predict}
 * @see {@link ChainOfThoughtOutputFields}
 *
 * @since 0.1.0
 * @category constructors
 */
export const chainOfThought = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  name: string,
  signature: Signature.Signature<I, O>,
  options: PredictOptions = EMPTY_PREDICT_OPTIONS
): Effect.Effect<Module<I, ChainOfThoughtOutputFields<O>>, SignatureError> =>
  ChainOfThoughtRuntime.allocate({
    name,
    signature,
    predictOptions: options
  })

/**
 * Schema transformation — `ChainOfThoughtOutputFields` type and
 * `toChainOfThoughtSignature` combinator.
 *
 * @since 0.1.0
 */
export * from "./schema.js"
