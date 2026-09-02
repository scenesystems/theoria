/**
 * Predictors with an additional model-generated reasoning field.
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
 * Creates a predictor that requests reasoning text before the original outputs.
 *
 * @remarks
 * The transformed signature prepends a required string field named `reasoning`
 * and asks the model to populate it before the original fields. The field is
 * ordinary model output. The module does not verify that it describes the
 * model's internal reasoning or that it is factually sound.
 *
 * Forward execution otherwise follows {@link predict}, including output-mode
 * selection and text parse retries. Construction fails with `SignatureError`
 * when the supplied signature already has an output named `reasoning`.
 *
 * @typeParam I - Input fields inferred from `signature`.
 * @typeParam O - Original output fields, retained after `reasoning`.
 * @param name - Identity used for discovery and tracing.
 * @param signature - Source contract, which remains unchanged.
 * @param options - Text parse-policy overrides passed to {@link predict}.
 * @returns A predictor with `reasoning` prepended to its output fields.
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
 * Output-field and signature transformations used by {@link chainOfThought}.
 *
 * @since 0.1.0
 */
export * from "./schema.js"
