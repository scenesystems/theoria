/**
 * Serializable DAG of module composition relationships, consumed by
 * optimizers to discover learnable parameter surfaces and traverse
 * them in deterministic order.
 *
 * @since 0.1.0
 */
import { Array as Arr, HashMap, Option, Order, Schema } from "effect"
import { ModuleId } from "./ModuleId.js"
import { ModuleNodeSignature } from "./ModuleNode.js"

const moduleIdOrder: Order.Order<ModuleId> = Order.mapInput(Order.string, (moduleId: ModuleId) => moduleId)

const uniqueSortedModuleIds = (moduleIds: ReadonlyArray<ModuleId>): ReadonlyArray<ModuleId> => {
  const sorted = Arr.sort(moduleIds, moduleIdOrder)

  return Arr.reduce(sorted, Arr.empty<ModuleId>(), (acc, moduleId) =>
    Option.match(Arr.last(acc), {
      onNone: () => Arr.make(moduleId),
      onSome: (last) =>
        last === moduleId
          ? acc
          : Arr.append(acc, moduleId)
    }))
}

const graphNodeOrder: Order.Order<ModuleGraphNode> = Order.mapInput(moduleIdOrder, (node) => node.moduleId)

const graphEdgeOrder: Order.Order<ModuleGraphEdge> = Order.mapInput(
  Order.string,
  (edge) => `${edge.parentId}->${edge.childId}`
)

type TraversalState = Readonly<{
  readonly order: ReadonlyArray<ModuleId>
  readonly visited: ReadonlyArray<ModuleId>
}>

const nodeLookup = (graph: ModuleGraph): HashMap.HashMap<ModuleId, ModuleGraphNode> =>
  Arr.reduce(
    graph.nodes,
    HashMap.empty<ModuleId, ModuleGraphNode>(),
    (lookup, node) => HashMap.set(lookup, node.moduleId, node)
  )

const traverseNode = (
  lookup: HashMap.HashMap<ModuleId, ModuleGraphNode>,
  moduleId: ModuleId,
  visited: ReadonlyArray<ModuleId>
): TraversalState =>
  visited.includes(moduleId)
    ? {
      order: Arr.empty<ModuleId>(),
      visited
    }
    : Option.match(HashMap.get(lookup, moduleId), {
      onNone: () => ({
        order: Arr.make(moduleId),
        visited: Arr.append(visited, moduleId)
      }),
      onSome: (node) => {
        const seed: TraversalState = {
          order: Arr.make(moduleId),
          visited: Arr.append(visited, moduleId)
        }

        return Arr.reduce(node.subModuleIds, seed, (state, childId) => {
          const childState = traverseNode(lookup, childId, state.visited)

          return {
            order: Arr.appendAll(state.order, childState.order),
            visited: childState.visited
          }
        })
      }
    })

const findLineagePath = (
  lookup: HashMap.HashMap<ModuleId, ModuleGraphNode>,
  currentId: ModuleId,
  targetId: ModuleId,
  visited: ReadonlyArray<ModuleId>
): Option.Option<ReadonlyArray<ModuleId>> =>
  visited.includes(currentId)
    ? Option.none()
    : currentId === targetId
    ? Option.some(Arr.append(visited, currentId))
    : Option.match(HashMap.get(lookup, currentId), {
      onNone: () => Option.none(),
      onSome: (node) =>
        Arr.reduce(node.subModuleIds, Option.none<ReadonlyArray<ModuleId>>(), (found, childId) =>
          Option.isSome(found)
            ? found
            : findLineagePath(lookup, childId, targetId, Arr.append(visited, currentId)))
    })

/**
 * Serializable node in the module composition DAG — carries the module's
 * identity, signature summary, and the IDs of its immediate children.
 *
 * @see {@link ModuleGraphEdge} — explicit parent→child edge
 * @see {@link ModuleGraph} — the full graph containing nodes and edges
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleGraphNode extends Schema.Class<ModuleGraphNode>("ModuleGraphNode")({
  moduleId: ModuleId,
  signature: ModuleNodeSignature,
  subModuleIds: Schema.Array(ModuleId)
}) {}

/**
 * Directed edge from a parent module to one of its composed children.
 * Edges are kept separate from nodes so optimizers can reason about
 * composition topology independently of node metadata.
 *
 * @see {@link ModuleGraphNode} — the node endpoints
 * @see {@link ModuleGraph} — the full graph
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleGraphEdge extends Schema.Class<ModuleGraphEdge>("ModuleGraphEdge")({
  parentId: ModuleId,
  childId: ModuleId
}) {}

/**
 * Complete serializable module composition DAG. Nodes are sorted by
 * {@link ModuleId} and edges by `parentId→childId` to guarantee
 * deterministic serialization regardless of discovery order.
 *
 * @see {@link makeModuleGraph} — canonical constructor with sorting
 * @see {@link stableModuleGraphTraversal} — deterministic pre-order walk
 * @see {@link moduleGraphLineage} — root-to-target path resolution
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleGraph extends Schema.Class<ModuleGraph>("ModuleGraph")({
  rootId: ModuleId,
  nodes: Schema.Array(ModuleGraphNode),
  edges: Schema.Array(ModuleGraphEdge)
}) {}

/**
 * Ordered path from the graph root to a specific target module.
 * Used by optimizers to scope parameter updates to a particular
 * lineage branch.
 *
 * @see {@link moduleGraphLineage} — resolves a lineage from a graph
 * @see {@link ModuleGraphProjection} — carries lineages for all nodes
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleLineage extends Schema.Class<ModuleLineage>("ModuleLineage")({
  targetId: ModuleId,
  path: Schema.Array(ModuleId)
}) {}

const normalizeNode = (node: ModuleGraphNode): ModuleGraphNode =>
  new ModuleGraphNode({
    moduleId: node.moduleId,
    signature: node.signature,
    subModuleIds: uniqueSortedModuleIds(node.subModuleIds)
  })

/**
 * Construct a {@link ModuleGraph} with nodes and edges sorted
 * deterministically by {@link ModuleId}. Deduplicates and sorts
 * child ID lists within each node.
 *
 * @see {@link ModuleGraph}
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeModuleGraph = (options: {
  readonly rootId: ModuleId
  readonly nodes: ReadonlyArray<ModuleGraphNode>
  readonly edges: ReadonlyArray<ModuleGraphEdge>
}): ModuleGraph =>
  new ModuleGraph({
    rootId: options.rootId,
    nodes: Arr.sort(Arr.map(options.nodes, normalizeNode), graphNodeOrder),
    edges: Arr.sort(options.edges, graphEdgeOrder)
  })

/**
 * Walk a {@link ModuleGraph} in deterministic pre-order starting from
 * `rootId`, returning the visited {@link ModuleId} sequence. Guarantees
 * stable ordering across runs for the same graph structure.
 *
 * @see {@link ModuleGraph}
 * @see {@link projectModuleGraph} — bundles traversal with lineage
 *
 * @since 0.1.0
 * @category combinators
 */
export const stableModuleGraphTraversal = (graph: ModuleGraph): ReadonlyArray<ModuleId> =>
  traverseNode(nodeLookup(graph), graph.rootId, Arr.empty<ModuleId>()).order

/**
 * Resolve the ordered path from graph root to `targetId`, returning
 * `None` if the target is unreachable. Used by optimizers to scope
 * parameter updates to a specific composition branch.
 *
 * @see {@link ModuleLineage} — the returned path model
 * @see {@link ModuleGraph}
 *
 * @since 0.1.0
 * @category combinators
 */
export const moduleGraphLineage = (
  graph: ModuleGraph,
  targetId: ModuleId
): Option.Option<ModuleLineage> =>
  Option.map(
    findLineagePath(nodeLookup(graph), graph.rootId, targetId, Arr.empty<ModuleId>()),
    (path) => new ModuleLineage({ targetId, path })
  )

/**
 * Pre-computed graph analysis bundling the deterministic traversal order
 * with root-to-node lineages for every node. Produced once by
 * {@link projectModuleGraph} and consumed by optimizer seams that need
 * stable iteration and ancestry without re-walking the graph.
 *
 * @see {@link projectModuleGraph} — the canonical projection constructor
 * @see {@link ModuleGraph} — the source graph
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleGraphProjection extends Schema.Class<ModuleGraphProjection>("ModuleGraphProjection")({
  rootId: ModuleId,
  traversal: Schema.Array(ModuleId),
  lineages: Schema.Array(ModuleLineage)
}) {}

const graphLineages = (graph: ModuleGraph): ReadonlyArray<ModuleLineage> =>
  Arr.filterMap(graph.nodes, (node) => moduleGraphLineage(graph, node.moduleId))

/**
 * Project a {@link ModuleGraph} into a {@link ModuleGraphProjection}
 * containing the stable traversal order and root-to-node lineages
 * for every discovered node.
 *
 * @see {@link ModuleGraphProjection}
 * @see {@link stableModuleGraphTraversal}
 *
 * @since 0.1.0
 * @category combinators
 */
export const projectModuleGraph = (graph: ModuleGraph): ModuleGraphProjection =>
  new ModuleGraphProjection({
    rootId: graph.rootId,
    traversal: stableModuleGraphTraversal(graph),
    lineages: graphLineages(graph)
  })
