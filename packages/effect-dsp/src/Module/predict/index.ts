/**
 * Leaf predictor module — the fundamental building block for LLM programs.
 *
 * @since 0.0.0
 */
import type { Schema } from "effect"
import { Effect, HashMap, Option, Ref } from "effect"
import type { ModuleId } from "../../contracts/ModuleId.js"
import type { ModuleNode } from "../../contracts/ModuleNode.js"
import { ModuleParams } from "../../contracts/ModuleParams.js"
import type { Signature } from "../../Signature/model.js"
import { Module } from "../model.js"
import { makePredictPolicy, type PredictPolicyOverrides } from "./policy.js"
import { makeForward } from "./runtime.js"

const EMPTY_PREDICT_POLICY_OVERRIDES: PredictPolicyOverrides = {}

/**
 * Optional overrides for parse retry behavior and feedback templates,
 * applied to a single `predict` module.
 *
 * @see {@link PredictPolicyOverrides}
 *
 * @since 0.0.0
 * @category models
 */
export type PredictOptions = Readonly<{
  readonly policy?: PredictPolicyOverrides
}>

const EMPTY_PREDICT_OPTIONS: PredictOptions = {}

const makeInitialParams = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  signature: Signature<I, O>
): ModuleParams =>
  new ModuleParams({
    instructions: signature.instructions,
    demos: []
  })

/**
 * Create a leaf predictor module that sends schema-validated input to a
 * language model and parses the response into schema-validated output.
 * Parse failures are retried according to the module's policy.
 *
 * @see {@link Module}
 * @see {@link PredictOptions}
 *
 * @since 0.0.0
 * @category constructors
 */
export const predict = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  name: string,
  signature: Signature<I, O>,
  options: PredictOptions = EMPTY_PREDICT_OPTIONS
): Effect.Effect<Module<I, O>> =>
  Effect.gen(function*() {
    const policy = makePredictPolicy(
      Option.getOrElse(
        Option.fromNullable(options.policy),
        () => EMPTY_PREDICT_POLICY_OVERRIDES
      )
    )
    const paramsRef = yield* Ref.make(makeInitialParams(signature))

    return new Module({
      name,
      signature,
      params: paramsRef,
      subModules: HashMap.empty<ModuleId, ModuleNode>(),
      forward: makeForward({
        moduleName: name,
        signature,
        inputSchema: signature.inputSchema,
        outputSchema: signature.outputSchema,
        paramsRef,
        policy
      })
    })
  })

/**
 * Parse retry policies, feedback templates, and default constants.
 *
 * @since 0.0.0
 */
export * from "./policy.js"
