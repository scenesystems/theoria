/**
 * Validated ownership graphs for module programs.
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
 * Constructs a module with a validated child ownership graph.
 *
 * @remarks
 * Validation traverses the complete declared graph before allocation. Module
 * names become graph identities; object keys in `subModules` are local aliases
 * and do not appear in the graph. Invalid ids, cycles, different direct modules
 * sharing an id, and child-map keys that disagree with child node names fail
 * with `CompositionError`.
 *
 * `forward` registers the root and invokes the callback once. The callback
 * receives decoded input plus graph metadata. It must close over and call any
 * executable child modules itself because `ModuleNode` values do not expose
 * `forward`.
 *
 * @typeParam I - Root signature input fields.
 * @typeParam O - Root signature output fields and callback result.
 * @param options - Root contract, direct child declarations, and execution callback.
 * @returns A module whose child graph has passed composition validation.
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
  /** Root identity used as the graph root, discovery id, and forward span name. */
  readonly name: string
  /** Input and output contract for the callback boundary. */
  readonly signature: Signature<I, O>
  /** Direct children whose nested ownership graphs are included in validation. */
  readonly subModules: ComposeSubModules
  /** Operation invoked once by each root `forward` call. */
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
   * Validates a declared ownership graph without allocating a root module.
   *
   * @since 0.1.0
   * @category constructors
   */
  composeGraph,
  /**
   * Associates caller-local aliases with direct child modules.
   *
   * @since 0.1.0
   * @category type-level
   */
  type ComposeSubModules
} from "./graph.js"

export {
  /**
   * Computes one composite result from decoded input and graph metadata.
   *
   * @since 0.1.0
   * @category type-level
   */
  type ComposeForward,
  /**
   * Exposes decoded input and the composition metadata built at construction.
   *
   * @since 0.1.0
   * @category type-level
   */
  type ComposeForwardContext
} from "./runtime.js"
