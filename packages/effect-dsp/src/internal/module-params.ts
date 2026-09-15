/**
 * Canonical module-parameter graph traversal.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import { Array as Arr, Boolean, Data, Equivalence, Graph, HashMap, Order } from "effect"
import type { Ref, Schema } from "effect"
import type { DemoContract } from "../contracts/DemoContract.js"
import { type ModuleNode, moduleNodeGraph } from "../contracts/ModuleNode.js"
import type { ModuleParams } from "../contracts/ModuleParams.js"
import type { Module } from "../Module/model.js"

const moduleNodeOrder: Order.Order<ModuleNode> = Order.mapInput(Order.string, (node) => node.name)

const ownerIdentity = Equivalence.strict<ModuleNode["params"]>()

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
  readonly params: Ref.Ref<ModuleParams>
  readonly demoContract: DemoContract
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
  const graph = moduleNodeGraph(children)
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
      (node) => new ModuleParamRef({ name: node.name, params: node.params, demoContract: node.demoContract })
    ),
    new ModuleParamRef({
      name: module.name,
      params: module.params,
      demoContract: module.signature.demoContract
    })
  )
}
