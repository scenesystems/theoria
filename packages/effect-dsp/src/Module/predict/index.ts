/**
 * Leaf modules that decode language-model output against a signature.
 *
 * @since 0.1.0
 * @module
 */
import type { Schema } from "effect"
import { Data, Effect, HashMap, Option, Ref } from "effect"
import type { ModuleId } from "../../contracts/ModuleId.js"
import type { ModuleNode } from "../../contracts/ModuleNode.js"
import { ModuleParams } from "../../contracts/ModuleParams.js"
import type { Signature } from "../../Signature/model.js"
import { Module } from "../model.js"
import { makePredictPolicy, type PredictPolicyOverrides } from "./policy.js"
import { makeForward } from "./runtime.js"

const EMPTY_PREDICT_POLICY_OVERRIDES: PredictPolicyOverrides = {}

/**
 * Configures text-output parsing for one predictor.
 *
 * @since 0.1.0
 * @category models
 */
export class PredictOptions extends Data.Class<{
  /** Overrides merged with {@link DEFAULT_PREDICT_POLICY}. */
  readonly policy?: PredictPolicyOverrides
}> {}

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
 * Allocates a leaf module whose `forward` operation invokes `LanguageModel`.
 *
 * @remarks
 * Initial parameters use the signature instructions, no demonstrations,
 * automatic output selection, and no generation overrides. Construction only
 * allocates the parameter `Ref`.
 *
 * Each `forward` call snapshots the current parameters before model execution.
 * Structured output delegates Schema decoding to the provider. Text output
 * parses field markers and retries parse failures according to the resolved
 * policy, adding the preceding diagnostics to the next prompt. Provider errors
 * are not retried by the parse policy. Discovery registration occurs before the
 * model call; trace and usage records are appended only after a successful call
 * and trace projection.
 *
 * @typeParam I - Input fields inferred from the signature.
 * @typeParam O - Output fields inferred from the signature.
 * @param name - Module name. Construction does not validate the `ModuleId`
 *   pattern; an invalid name fails during discovery registration on `forward`.
 * @param signature - Input/output contract and initial instructions.
 * @param options - Per-module text-parse policy overrides.
 * @returns A module with an independent parameter `Ref` and no child nodes.
 *
 * @since 0.1.0
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
 * @since 0.1.0
 */
export * from "./policy.js"
