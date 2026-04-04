/**
 * Module composition constructors.
 *
 * @since 0.1.0
 */
import type { Schema } from "effect"
import { Effect, Ref } from "effect"
import { ModuleParams } from "../../contracts/ModuleParams.js"
import type { CompositionError } from "../../Errors/module.js"
import type { Signature } from "../../Signature/model.js"
import { Module } from "../model.js"
import { buildCompositionGraph, type ComposeSubModules } from "./graph.js"
import { type ComposeForward, makeComposeForward } from "./runtime.js"

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
 * Construct a composed module from a set of named sub-modules and a
 * user-supplied forward function. Validates the composition graph at
 * construction time — cycles, duplicate ids, and root collisions fail
 * immediately.
 *
 * @see {@link ComposeSubModules}
 * @see {@link ComposeForward}
 * @see {@link ComposeForwardContext}
 *
 * @since 0.1.0
 * @category constructors
 */
export const compose = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly name: string
  readonly signature: Signature<I, O>
  readonly subModules: ComposeSubModules
  readonly forward: ComposeForward<I, O>
}): Effect.Effect<Module<I, O>, CompositionError> =>
  Effect.gen(function*() {
    const paramsRef = yield* Ref.make(makeInitialParams(options.signature))
    const composition = yield* buildCompositionGraph({
      name: options.name,
      signature: options.signature,
      subModules: options.subModules
    })

    return new Module({
      name: options.name,
      signature: options.signature,
      params: paramsRef,
      subModules: composition.subModuleNodesById,
      forward: makeComposeForward({
        moduleName: options.name,
        signature: options.signature,
        paramsRef,
        rootChildIds: composition.rootChildIds,
        graph: composition.graph,
        subModuleNodes: composition.subModuleNodesById,
        forward: options.forward
      })
    })
  })

export {
  /**
   * Build and validate a composition graph from sub-module declarations,
   * returning only the graph contract without constructing a full module.
   *
   * @since 0.1.0
   * @category constructors
   */
  composeGraph,
  /**
   * Sub-module declaration map keyed by local alias, consumed by
   * `compose` and `composeGraph`.
   *
   * @since 0.1.0
   * @category type-level
   */
  type ComposeSubModules
} from "./graph.js"

export {
  /**
   * User-supplied forward function that orchestrates sub-module calls
   * within a composed module.
   *
   * @since 0.1.0
   * @category type-level
   */
  type ComposeForward,
  /**
   * Context object passed to `ComposeForward` — provides the validated
   * input, sub-module node map, and full composition graph.
   *
   * @since 0.1.0
   * @category type-level
   */
  type ComposeForwardContext
} from "./runtime.js"
