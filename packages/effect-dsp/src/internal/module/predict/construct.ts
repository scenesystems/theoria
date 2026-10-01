/**
 * Leaf modules that decode language-model output against a signature.
 *
 * @since 0.1.0
 * @module
 */
import type { Schema } from "effect"
import { Array as Arr, Effect, HashMap, Option, Ref } from "effect"
import {
  type Id,
  makePredictPolicy,
  Module,
  type Node,
  type PredictOptions,
  type PredictPolicyOverrides
} from "../../../Module.js"
import { ModuleParameters } from "../../../ModuleParameters.js"
import type { Signature } from "../../../Signature.js"
import { makeForward, RuntimeOptions } from "./runtime.js"

const EMPTY_PREDICT_POLICY_OVERRIDES: PredictPolicyOverrides = {}

const EMPTY_PREDICT_OPTIONS: PredictOptions = {}

const makeInitialParams = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(
  signature: Signature<I, O>
): ModuleParameters =>
  new ModuleParameters({
    instructions: signature.instructions,
    demos: Arr.empty()
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
 * model call. Every model invocation records its terminal call independently of
 * parsing and trace projection; successful trace entries retain only the final
 * invocation's selected usage, preferring early observation over returned usage.
 *
 * @typeParam I - Input fields inferred from the signature.
 * @typeParam O - Output fields inferred from the signature.
 * @param name - Module name. Construction does not validate the `Module.Id`
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
      subModules: HashMap.empty<Id, Node>(),
      forward: makeForward(
        new RuntimeOptions({
          moduleName: name,
          signature,
          inputSchema: signature.inputSchema,
          outputSchema: signature.outputSchema,
          paramsRef,
          policy
        })
      )
    })
  })
