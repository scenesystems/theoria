/**
 * Canonical module-parameter graph traversal.
 *
 * @since 0.1.0
 * @category internal
 * @internal
 */
import { Array as Arr, Data, HashMap, Order, Record } from "effect"
import type { Ref, Schema } from "effect"
import type { ModuleNode } from "../contracts/ModuleNode.js"
import type { ModuleParams } from "../contracts/ModuleParams.js"
import type { Module } from "../Module/model.js"

const moduleNodeOrder: Order.Order<ModuleNode> = Order.mapInput(Order.string, (node) => node.name)

const sortedChildNodes = (subModules: ModuleNode["subModules"]): ReadonlyArray<ModuleNode> =>
  Arr.sort(
    Arr.map(Arr.fromIterable(HashMap.toEntries(subModules)), ([, node]) => node),
    moduleNodeOrder
  )

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
export type ModuleParamRef = Readonly<{
  readonly name: string
  readonly params: Ref.Ref<ModuleParams>
}>

class TraversalState extends Data.Class<{
  readonly seen: Record<string, true>
  readonly refs: ReadonlyArray<ModuleParamRef>
}> {}

const visitNode = (node: ModuleNode, state: TraversalState): TraversalState =>
  Record.has(state.seen, node.name)
    ? state
    : Arr.reduce(
      sortedChildNodes(node.subModules),
      new TraversalState({
        seen: Record.set(state.seen, node.name, true),
        refs: [...state.refs, { name: node.name, params: node.params }]
      }),
      (nextState, child) => visitNode(child, nextState)
    )

/**
 * Performs a deterministic depth-first traversal of the module graph,
 * starting from the root module, and returns parameter refs in a stable
 * order that is consistent across repeated calls.
 *
 * Each module is visited at most once (by name), so diamond dependencies
 * in the module graph do not produce duplicate refs.
 *
 * @since 0.1.0
 * @category utils
 * @internal
 */
export const collectModuleParamRefs = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  module: Module<I, O>
): ReadonlyArray<ModuleParamRef> =>
  Arr.reduce(
    sortedChildNodes(module.subModules),
    initialTraversalState(module),
    (state, node) => visitNode(node, state)
  ).refs

const initialTraversalState = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  module: Module<I, O>
): TraversalState =>
  new TraversalState({
    seen: Record.set(Record.empty<string, true>(), module.name, true),
    refs: [{ name: module.name, params: module.params }]
  })
