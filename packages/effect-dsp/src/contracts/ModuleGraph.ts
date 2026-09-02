/**
 * Serializable module composition records and traversal projections.
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
export const stableModuleGraphTraversal = (graph: ModuleGraph): ReadonlyArray<ModuleId> =>
  traverseNode(nodeLookup(graph), graph.rootId, Arr.empty<ModuleId>()).order

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
): Option.Option<ModuleLineage> =>
  Option.map(
    findLineagePath(nodeLookup(graph), graph.rootId, targetId, Arr.empty<ModuleId>()),
    (path) => new ModuleLineage({ targetId, path })
  )

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

const graphLineages = (graph: ModuleGraph): ReadonlyArray<ModuleLineage> =>
  Arr.filterMap(graph.nodes, (node) => moduleGraphLineage(graph, node.moduleId))

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
export const projectModuleGraph = (graph: ModuleGraph): ModuleGraphProjection =>
  new ModuleGraphProjection({
    rootId: graph.rootId,
    traversal: stableModuleGraphTraversal(graph),
    lineages: graphLineages(graph)
  })
