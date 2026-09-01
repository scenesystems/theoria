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
import { makeChainOfThought } from "./runtime.js"
import type { ChainOfThoughtOutputFields } from "./schema.js"

const EMPTY_PREDICT_OPTIONS: PredictOptions = {}

/**
 * Creates a predictor that emits explicit reasoning before its original outputs.
 *
 * @remarks
 * The constructor prepends a required string `reasoning` field to the output
 * fields and appends the corresponding instruction. It uses the same
 * execution, parsing, retry, discovery, and tracing behavior as {@link predict}.
 * Construction fails with `SignatureError` when the supplied signature already
 * owns an output named `reasoning`.
 *
 * @typeParam I - Input fields inferred from `signature`.
 * @typeParam O - Original output fields, retained after `reasoning`.
 * @param name - Module identity passed to {@link predict}.
 * @param signature - Signature to transform; it is not mutated.
 * @param options - Predict parse-policy overrides.
 * @returns The allocated predictor, or `SignatureError` for a `reasoning` collision.
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
  makeChainOfThought({
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
