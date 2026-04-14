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
 * @see {@link ModuleGraph.fromParts} — canonical constructor with sorting
 * @see {@link ModuleGraph.traversal} — deterministic pre-order walk
 * @see {@link ModuleLineage.fromGraph} — root-to-target path resolution
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleGraph extends Schema.Class<ModuleGraph>("ModuleGraph")({
  rootId: ModuleId,
  nodes: Schema.Array(ModuleGraphNode),
  edges: Schema.Array(ModuleGraphEdge)
}) {
  /**
   * Canonical constructor that normalizes child ordering and sorts the graph for stable serialization.
   *
   * @since 0.1.0
   * @category constructors
   */
  static fromParts(options: {
    readonly rootId: ModuleId
    readonly nodes: ReadonlyArray<ModuleGraphNode>
    readonly edges: ReadonlyArray<ModuleGraphEdge>
  }): ModuleGraph {
    return ModuleGraph.make({
      rootId: options.rootId,
      nodes: Arr.sort(Arr.map(options.nodes, normalizeNode), graphNodeOrder),
      edges: Arr.sort(options.edges, graphEdgeOrder)
    })
  }

  /**
   * Walk a {@link ModuleGraph} in deterministic pre-order starting from
   * `rootId`, returning the visited {@link ModuleId} sequence.
   *
   * @since 0.1.0
   * @category combinators
   */
  static traversal(graph: ModuleGraph): ReadonlyArray<ModuleId> {
    return traverseNode(nodeLookup(graph), graph.rootId, Arr.empty<ModuleId>()).order
  }
}

/**
 * Ordered path from the graph root to a specific target module.
 * Used by optimizers to scope parameter updates to a particular
 * lineage branch.
 *
 * @see {@link ModuleLineage.fromGraph} — resolves a lineage from a graph
 * @see {@link ModuleGraphProjection} — carries lineages for all nodes
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleLineage extends Schema.Class<ModuleLineage>("ModuleLineage")({
  targetId: ModuleId,
  path: Schema.Array(ModuleId)
}) {
  /**
   * Resolve the ordered path from graph root to `targetId`, returning
   * `None` if the target is unreachable.
   *
   * @since 0.1.0
   * @category combinators
   */
  static fromGraph(
    graph: ModuleGraph,
    targetId: ModuleId
  ): Option.Option<ModuleLineage> {
    return Option.map(
      findLineagePath(nodeLookup(graph), graph.rootId, targetId, Arr.empty<ModuleId>()),
      (path) => ModuleLineage.make({ targetId, path })
    )
  }
}

const normalizeNode = (node: ModuleGraphNode): ModuleGraphNode =>
  ModuleGraphNode.make({
    moduleId: node.moduleId,
    signature: node.signature,
    subModuleIds: uniqueSortedModuleIds(node.subModuleIds)
  })

/**
 * Pre-computed graph analysis bundling the deterministic traversal order
 * with root-to-node lineages for every node. Produced once by
 * {@link ModuleGraphProjection.fromGraph} and consumed by optimizer seams that need
 * stable iteration and ancestry without re-walking the graph.
 *
 * @see {@link ModuleGraphProjection.fromGraph} — the canonical projection constructor
 * @see {@link ModuleGraph} — the source graph
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleGraphProjection extends Schema.Class<ModuleGraphProjection>("ModuleGraphProjection")({
  rootId: ModuleId,
  traversal: Schema.Array(ModuleId),
  lineages: Schema.Array(ModuleLineage)
}) {
  /**
   * Project a {@link ModuleGraph} into a {@link ModuleGraphProjection}
   * containing the stable traversal order and root-to-node lineages
   * for every discovered node.
   *
   * @since 0.1.0
   * @category combinators
   */
  static fromGraph(graph: ModuleGraph): ModuleGraphProjection {
    return ModuleGraphProjection.make({
      rootId: graph.rootId,
      traversal: ModuleGraph.traversal(graph),
      lineages: graphLineages(graph)
    })
  }
}

const graphLineages = (graph: ModuleGraph): ReadonlyArray<ModuleLineage> =>
  Arr.filterMap(graph.nodes, (node) => ModuleLineage.fromGraph(graph, node.moduleId))
