/**
 * Compose-forward runtime orchestration.
 *
 * @since 0.0.0
 * @category internal
 * @internal
 */
import type * as AiError from "@effect/ai/AiError"
import type * as LanguageModel from "@effect/ai/LanguageModel"
import { Effect } from "effect"
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
 * Compose-runtime callback context.
 *
 * @since 0.0.0
 * @category models
 */
export type ComposeForwardContext<
  I extends Schema.Struct.Fields
> = Readonly<{
  readonly input: Schema.Schema.Type<Schema.Struct<I>>
  readonly subModuleNodes: HashMap.HashMap<ModuleId, ModuleNode>
  readonly graph: ModuleGraph
}>

/**
 * Compose-runtime callback contract.
 *
 * @since 0.0.0
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
 * @since 0.0.0
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
