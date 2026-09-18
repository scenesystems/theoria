/**
 * Compose-forward runtime orchestration.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import { Data, Effect } from "effect"
import type { HashMap, Ref, Schema } from "effect"
import {
  type ComposeForward,
  ComposeForwardContext,
  type Id,
  type Module,
  type Node,
  NodeSignature
} from "../../../Module.js"
import type { ModuleGraph, Node as ModuleGraphNode } from "../../../ModuleGraph.js"
import type { ModuleParameters } from "../../../ModuleParameters.js"
import type { Signature } from "../../../Signature.js"
import { registerRuntime, RuntimeRegistrationOptions } from "../discovery/registry.js"

class ComposeForwardOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E,
  R
> extends Data.Class<{
  readonly moduleName: string
  readonly signature: Signature<I, O>
  readonly paramsRef: Ref.Ref<ModuleParameters>
  readonly rootChildIds: ModuleGraphNode["subModuleIds"]
  readonly graph: ModuleGraph
  readonly subModuleNodes: HashMap.HashMap<Id, Node>
  readonly forward: ComposeForward<I, O, E, R>
}> {}

/**
 * Build a typed `forward` function for a composed module.
 *
 * @since 0.1.0
 * @internal
 */
export const makeComposeForward = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E,
  R
>(options: ComposeForwardOptions<I, O, E, R>): Module<I, O, E, R>["forward"] => {
  return Effect.fn(options.moduleName)((input) =>
    Effect.gen(function*() {
      yield* registerRuntime(
        new RuntimeRegistrationOptions({
          moduleName: options.moduleName,
          params: options.paramsRef,
          signature: new NodeSignature({
            description: options.signature.description,
            instructions: options.signature.instructions
          }),
          subModuleIds: options.rootChildIds
        })
      )

      return yield* options.forward(
        new ComposeForwardContext({
          input,
          subModuleNodes: options.subModuleNodes,
          graph: options.graph
        })
      )
    })
  )
}

export { ComposeForwardOptions }
