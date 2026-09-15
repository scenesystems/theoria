/**
 * Serializable module composition records and traversal projections.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Equivalence, Graph, HashMap, Option, Order, Schema, Tuple } from "effect"
import { ModuleId } from "./ModuleId.js"
import { ModuleNodeSignature } from "./ModuleNode.js"

const moduleIdOrder: Order.Order<ModuleId> = Order.mapInput(Order.string, (moduleId: ModuleId) => moduleId)

const uniqueSortedModuleIds = (moduleIds: Iterable<ModuleId>): ModuleGraphNode["subModuleIds"] =>
  Arr.dedupeWith(Arr.sort(moduleIds, moduleIdOrder), Equivalence.string)

const graphNodeOrder: Order.Order<ModuleGraphNode> = Order.mapInput(moduleIdOrder, (node) => node.moduleId)

const graphEdgeOrder: Order.Order<ModuleGraphEdge> = Order.mapInput(
  Order.string,
  (edge) => Arr.join(Arr.make(edge.parentId, "->", edge.childId), "")
)

class NativeModuleGraph extends Data.Class<{
  readonly graph: Graph.DirectedGraph<ModuleId, ModuleId>
  readonly root: Graph.NodeIndex
}> {}

const nativeModuleGraph = (source: ModuleGraph): NativeModuleGraph => {
  const graph = Graph.beginMutation(Graph.directed<ModuleId, ModuleId>())
  const root = Graph.addNode(graph, source.rootId)
  const lookup = HashMap.fromIterable(Arr.map(source.nodes, (node) => Tuple.make(node.moduleId, node)))
  const identities = Arr.dedupe(
    Arr.flatMap(Arr.fromIterable(HashMap.values(lookup)), (node) => Arr.prepend(node.subModuleIds, node.moduleId))
  )
  const indices = Arr.reduce(
    identities,
    HashMap.make(Tuple.make(source.rootId, root)),
    (state, moduleId) =>
      Option.match(HashMap.get(state, moduleId), {
        onSome: () => state,
        onNone: () => HashMap.set(state, moduleId, Graph.addNode(graph, moduleId))
      })
  )
  Arr.forEach(HashMap.values(lookup), (node) => {
    const parent = Option.getOrThrow(HashMap.get(indices, node.moduleId))
    Arr.forEach(node.subModuleIds, (childId) => {
      Graph.addEdge(graph, parent, Option.getOrThrow(HashMap.get(indices, childId)), childId)
    })
  })
  return new NativeModuleGraph({ graph: Graph.endMutation(graph), root })
}

class DiscoveredLineage extends Data.Class<{
  readonly rank: number
  readonly lineage: ModuleLineage
}> {}

const discoveryOrder: Order.Order<DiscoveredLineage> = Order.mapInput(Order.number, (entry) => entry.rank)

// A node's latest already-discovered predecessor is its DFS discovery parent:
// any predecessor discovered later than that parent would have discovered the
// node itself. Fold native DFS output rather than replaying traversal or using
// a shortest-path algorithm. Later back/cross edges cannot replace a lineage.
const nativeLineages = (native: NativeModuleGraph) =>
  Arr.reduce(
    Graph.entries(Graph.dfs(native.graph, { start: Arr.make(native.root) })),
    HashMap.empty<Graph.NodeIndex, DiscoveredLineage>(),
    (discovered, [index, targetId], rank) => {
      const parent = Arr.last(Arr.sort(
        Arr.filterMap(Graph.predecessors(native.graph, index), (predecessor) => HashMap.get(discovered, predecessor)),
        discoveryOrder
      ))
      const path = Arr.append(
        Option.match(parent, {
          onNone: () => Arr.empty<ModuleId>(),
          onSome: (entry) => entry.lineage.path
        }),
        targetId
      )
      return HashMap.set(
        discovered,
        index,
        new DiscoveredLineage({
          rank,
          lineage: new ModuleLineage({ targetId, path })
        })
      )
    }
  )

/**
 * Stores prompt metadata and immediate child identities for one module.
 *
 * @remarks
 * Child order controls traversal unless the node passes through
 * {@link makeModuleGraph}, which sorts and deduplicates it.
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleGraphNode extends Schema.Class<ModuleGraphNode>("ModuleGraphNode")({
  /** Identity used by graph lookup and traversal. */
  moduleId: ModuleId,
  /** Prompt metadata retained for optimizer inspection. */
  signature: ModuleNodeSignature,
  /** Immediate child identities followed by pre-order traversal. */
  subModuleIds: Schema.Array(ModuleId)
}) {}

/**
 * Records a directed parent-to-child relationship independently of node metadata.
 *
 * @remarks
 * Traversal reads `ModuleGraphNode.subModuleIds`; it does not consult this edge
 * list. Consumers can use edges for topology analysis or serialization.
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleGraphEdge extends Schema.Class<ModuleGraphEdge>("ModuleGraphEdge")({
  /** Parent endpoint. */
  parentId: ModuleId,
  /** Child endpoint. */
  childId: ModuleId
}) {}

/**
 * Stores a root, node records, and explicit composition edges.
 *
 * @remarks
 * The schema validates field shapes only. It does not enforce endpoint presence,
 * unique node identities, acyclicity, edge consistency, or root membership. Use
 * module composition APIs when those graph invariants are required.
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleGraph extends Schema.Class<ModuleGraph>("ModuleGraph")({
  /** Identity where traversal begins. */
  rootId: ModuleId,
  /** Node records used for lookup; duplicate identities resolve to the last node. */
  nodes: Schema.Array(ModuleGraphNode),
  /** Explicit topology records, independent from node child lists. */
  edges: Schema.Array(ModuleGraphEdge)
}) {}

/**
 * Records the first root-to-target path selected by depth-first traversal.
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleLineage extends Schema.Class<ModuleLineage>("ModuleLineage")({
  /** Requested final identity. */
  targetId: ModuleId,
  /** Root-first identities including both root and target. */
  path: Schema.Array(ModuleId)
}) {}

const normalizeNode = (node: ModuleGraphNode): ModuleGraphNode =>
  new ModuleGraphNode({
    moduleId: node.moduleId,
    signature: node.signature,
    subModuleIds: uniqueSortedModuleIds(node.subModuleIds)
  })

/**
 * Normalizes ordering for a serializable module graph.
 *
 * @remarks
 * Nodes are sorted by identity, child lists are sorted and deduplicated, and
 * edges are sorted by parent and child identity. Duplicate nodes and duplicate
 * edges remain present. The function does not validate graph invariants.
 *
 * @param options - Root identity plus node and edge records to normalize.
 * @returns A new graph with normalized array ordering.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeModuleGraph = (options: ModuleGraph): ModuleGraph =>
  new ModuleGraph({
    rootId: options.rootId,
    nodes: Arr.sort(Arr.map(options.nodes, normalizeNode), graphNodeOrder),
    edges: Arr.sort(options.edges, graphEdgeOrder)
  })

/**
 * Walks child identities in pre-order from the graph root.
 *
 * @remarks
 * Each identity appears at most once, which terminates traversal when cycles are
 * present. Stored child order is preserved. A referenced identity without a node
 * is included but has no descendants.
 *
 * @param graph - Graph whose node child lists define traversal.
 * @returns Visited identities beginning with `rootId`.
 *
 * @since 0.1.0
 * @category combinators
 */
export const stableModuleGraphTraversal = (graph: ModuleGraph): ModuleGraphNode["subModuleIds"] => {
  const native = nativeModuleGraph(graph)
  return Arr.fromIterable(Graph.values(Graph.dfs(native.graph, { start: Arr.make(native.root) })))
}

/**
 * Finds the first root-to-target path in stored child order.
 *
 * @remarks
 * Cycles are skipped. A target is reachable when its identity appears in a child
 * list even if no corresponding node record exists.
 *
 * @param graph - Graph whose node child lists define reachability.
 * @param targetId - Identity to locate from the root.
 * @returns The selected path, or `Option.none()` when no path reaches the target.
 *
 * @since 0.1.0
 * @category combinators
 */
export const moduleGraphLineage = (
  graph: ModuleGraph,
  targetId: ModuleId
): Option.Option<ModuleLineage> => {
  const native = nativeModuleGraph(graph)
  const lineages = nativeLineages(native)
  return Graph.findNode(native.graph, (moduleId) => Equivalence.string(moduleId, targetId)).pipe(
    Option.flatMap((index) => HashMap.get(lineages, index)),
    Option.map((entry) => entry.lineage)
  )
}

/**
 * Stores traversal order and reachable lineages computed from a module graph.
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleGraphProjection extends Schema.Class<ModuleGraphProjection>("ModuleGraphProjection")({
  /** Source graph root identity. */
  rootId: ModuleId,
  /** Pre-order identities returned by {@link stableModuleGraphTraversal}. */
  traversal: Schema.Array(ModuleId),
  /** Reachable paths for source node records, preserving source node order. */
  lineages: Schema.Array(ModuleLineage)
}) {}

/**
 * Computes traversal order and reachable node lineages once.
 *
 * @remarks
 * Lineages are attempted for each node record and unreachable nodes are omitted.
 * Referenced identities missing from `nodes` can appear in `traversal` without a
 * corresponding lineage entry.
 *
 * @param graph - Source graph; no graph invariants are validated.
 * @returns A projection containing traversal and reachable lineages.
 *
 * @since 0.1.0
 * @category combinators
 */
export const projectModuleGraph = (graph: ModuleGraph): ModuleGraphProjection => {
  const native = nativeModuleGraph(graph)
  const discovered = Arr.sort(Arr.fromIterable(HashMap.values(nativeLineages(native))), discoveryOrder)
  const lineages = HashMap.fromIterable(
    Arr.map(discovered, (entry) => Tuple.make(entry.lineage.targetId, entry.lineage))
  )
  return new ModuleGraphProjection({
    rootId: graph.rootId,
    traversal: Arr.map(discovered, (entry) => entry.lineage.targetId),
    lineages: Arr.filterMap(graph.nodes, (node) => HashMap.get(lineages, node.moduleId))
  })
}
