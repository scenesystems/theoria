/**
 * Validated ownership graphs for module programs.
 *
 * @since 0.1.0
 * @module
 */
import type { Schema } from "effect"
import { Array as Arr, Effect, Ref } from "effect"
import type { CompositionError } from "../../../DspError.js"
import { ComposeGraphOptions, type ComposeOptions, Module } from "../../../Module.js"
import { ModuleParameters } from "../../../ModuleParameters.js"
import type { Signature } from "../../../Signature.js"
import { buildCompositionGraph } from "./graph.js"
import { ComposeForwardOptions, makeComposeForward } from "./runtime.js"

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
 * executable child modules itself because `Module.Node` values do not expose
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
  O extends Schema.Struct.Fields,
  E = never,
  R = never
>(options: ComposeOptions<I, O, E, R>): Effect.Effect<Module<I, O, E, R>, CompositionError> =>
  Effect.gen(function*() {
    const paramsRef = yield* Ref.make(makeInitialParams(options.signature))
    const composition = yield* buildCompositionGraph(
      new ComposeGraphOptions({
        name: options.name,
        signature: options.signature,
        subModules: options.subModules
      })
    )

    return new Module({
      name: options.name,
      signature: options.signature,
      params: paramsRef,
      subModules: composition.subModuleNodesById,
      forward: makeComposeForward(
        new ComposeForwardOptions({
          moduleName: options.name,
          signature: options.signature,
          paramsRef,
          rootChildIds: composition.rootChildIds,
          graph: composition.graph,
          subModuleNodes: composition.subModuleNodesById,
          forward: options.forward
        })
      )
    })
  })
