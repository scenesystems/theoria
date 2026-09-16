/**
 * Canonical module-parameter graph traversal.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import { Array as Arr, Boolean, Data, Equivalence, Graph, HashMap, Order } from "effect"
import type { Ref, Schema } from "effect"
import type { Codec } from "../Demonstration.js"
import { type Module, type Node, nodeGraph } from "../Module.js"
import type { ModuleParameters } from "../ModuleParameters.js"

const moduleNodeOrder: Order.Order<Node> = Order.mapInput(Order.string, (node) => node.name)

const ownerIdentity = Equivalence.strict<Node["params"]>()

/**
 * A reference to a single module's mutable parameters, paired with the
 * module name that owns them.
 *
 * Collected by {@link collectModuleParamRefs} in deterministic traversal
 * order for use by optimizers and serialization.
 *
 * @since 0.1.0
 * @category models
 * @internal
 */
export class ModuleParamRef extends Data.Class<{
  readonly name: string
  readonly params: Ref.Ref<ModuleParameters>
  readonly demonstrationCodec: Codec
}> {}

/**
 * Performs a deterministic depth-first traversal of the module graph,
 * starting from the root module, and returns parameter refs in a stable
 * order that is consistent across repeated calls.
 *
 * Each live parameter owner is visited once, so separate projections in diamond
 * dependencies do not duplicate refs. Distinct owners are never lost by name;
 * composition and persistence validate name collisions before any writes.
 *
 * @since 0.1.0
 * @category utils
 * @internal
 */
export const collectModuleParamRefs = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E,
  R
>(module: Module<I, O, E, R>): Arr.NonEmptyArray<ModuleParamRef> => {
  const children = Arr.sort(Arr.fromIterable(HashMap.values(module.subModules)), moduleNodeOrder)
  const graph = nodeGraph(children)
  const starts = Arr.filterMap(
    children,
    (child) => Graph.findNode(graph, (node) => ownerIdentity(node.params, child.params))
  )
  const descendants = Arr.filter(
    Arr.fromIterable(Graph.values(Graph.dfs(graph, { start: Arr.reverse(starts) }))),
    (node) => Boolean.not(ownerIdentity(node.params, module.params))
  )
  return Arr.prepend(
    Arr.map(
      descendants,
      (node) =>
        new ModuleParamRef({
          name: node.name,
          params: node.params,
          demonstrationCodec: node.demonstrationCodec
        })
    ),
    new ModuleParamRef({
      name: module.name,
      params: module.params,
      demonstrationCodec: module.signature.demonstrationCodec
    })
  )
}
