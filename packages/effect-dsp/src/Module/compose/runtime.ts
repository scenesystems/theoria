/**
 * Compose-forward runtime orchestration.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import type * as AiError from "@effect/ai/AiError"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Data, Effect } from "effect"
import type { Effect as EffectType, HashMap, Ref, Schema } from "effect"
import type { ModuleGraph } from "../../contracts/ModuleGraph.js"
import type { ModuleId } from "../../contracts/ModuleId.js"
import type { ModuleNode } from "../../contracts/ModuleNode.js"
import type { ModuleParams } from "../../contracts/ModuleParams.js"
import type { DspError } from "../../Errors/union.js"
import type { Signature } from "../../Signature/model.js"
import { RegisteredSignature, registerRuntime } from "../discovery/index.js"
import type { Module } from "../model.js"

/**
 * Carries decoded input and validated ownership metadata into a composite callback.
 *
 * @remarks
 * `subModuleNodes` contains direct child parameter and signature views. These
 * views are not executable modules.
 *
 * @typeParam I - Root input fields decoded before the callback is invoked.
 *
 * @since 0.1.0
 * @category models
 */
export class ComposeForwardContext<
  I extends Schema.Struct.Fields
> extends Data.Class<{
  /** Decoded value passed to the composite module's `forward` operation. */
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  /** Live parameter views for direct children, keyed by module identity. */
  readonly subModuleNodes: HashMap.HashMap<ModuleId, ModuleNode>
  /** Full root and descendant ownership graph fixed at construction. */
  readonly graph: ModuleGraph
}> {}

/**
 * Computes a composite module's output from decoded input and graph metadata.
 *
 * @remarks
 * Composition does not decode the returned value or invoke child modules. AI
 * provider and package failures from the callback remain in the Effect channel.
 *
 * @typeParam I - Input fields represented by `context.input`.
 * @typeParam O - Output fields represented by the successful callback value.
 * @param context - Per-call input and construction-time graph metadata.
 * @returns The decoded output value expected by the root signature.
 *
 * @since 0.1.0
 * @category models
 */
export type ComposeForward<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
> = (
  context: ComposeForwardContext<I>
) => EffectType.Effect<
  Schema.Schema.Type<Schema.Struct<O>>,
  AiError.AiError | DspError,
  | LanguageModel.LanguageModel
  | Schema.Schema.Context<Schema.Struct<I>>
  | Schema.Schema.Context<Schema.Struct<O>>
>

/**
 * Build a typed `forward` function for a composed module.
 *
 * @since 0.1.0
 * @internal
 */
export const makeComposeForward = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly paramsRef: Ref.Ref<ModuleParams>
  readonly rootChildIds: ReadonlyArray<ModuleId>
  readonly graph: ModuleGraph
  readonly subModuleNodes: HashMap.HashMap<ModuleId, ModuleNode>
  readonly forward: ComposeForward<I, O>
}): Module<I, O>["forward"] => {
  return Effect.fn(options.moduleName)((input) =>
    Effect.gen(function*() {
      yield* registerRuntime({
        moduleName: options.moduleName,
        params: options.paramsRef,
        signature: new RegisteredSignature({
          description: options.signature.description,
          instructions: options.signature.instructions
        }),
        subModuleIds: options.rootChildIds
      })

      return yield* options.forward({
        input,
        subModuleNodes: options.subModuleNodes,
        graph: options.graph
      })
    })
  )
}
