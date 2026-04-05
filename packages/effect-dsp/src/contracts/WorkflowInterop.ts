/**
 * LM-only workflow interop projections over the extracted workflow family.
 *
 * These adapters consume the released workflow contracts from
 * `effect-inference/Contracts` without re-exporting ownership of session,
 * routing, evaluation, or score semantics from `effect-dsp/contracts`.
 *
 * @since 0.2.0
 */
import { Array as Arr, HashMap, Option, Order, Schema } from "effect"
import {
  type GraphExecutionManifest,
  GraphExecutionManifestSchema,
  GraphExecutionProjectionSchema,
  WorkflowStateLaneSchema
} from "effect-inference/Contracts"

const workflowNodeOrder: Order.Order<GraphExecutionManifest["nodes"][number]> = Order.mapInput(
  Order.string,
  (node) => node.nodeId
)

const workflowEdgeOrder: Order.Order<GraphExecutionManifest["edges"][number]> = Order.mapInput(
  Order.string,
  (edge) => `${edge.fromNodeId}->${edge.toNodeId}`
)

type TraversalState = Readonly<{
  readonly traversal: ReadonlyArray<string>
  readonly visited: ReadonlyArray<string>
}>

const childLookup = (manifest: GraphExecutionManifest): HashMap.HashMap<string, ReadonlyArray<string>> =>
  Arr.reduce(
    Arr.sort(manifest.edges, workflowEdgeOrder),
    HashMap.empty<string, ReadonlyArray<string>>(),
    (lookup, edge) =>
      HashMap.set(
        lookup,
        edge.fromNodeId,
        Arr.append(Option.getOrElse(HashMap.get(lookup, edge.fromNodeId), () => Arr.empty<string>()), edge.toNodeId)
      )
  )

const traverseNode = (
  lookup: HashMap.HashMap<string, ReadonlyArray<string>>,
  nodeId: string,
  visited: ReadonlyArray<string>
): TraversalState =>
  visited.includes(nodeId)
    ? {
      traversal: Arr.empty<string>(),
      visited
    }
    : (() => {
      const seed: TraversalState = {
        traversal: Arr.make(nodeId),
        visited: Arr.append(visited, nodeId)
      }

      return Arr.reduce(
        Option.getOrElse(HashMap.get(lookup, nodeId), () => Arr.empty<string>()),
        seed,
        (state, childId) => {
          const childState = traverseNode(lookup, childId, state.visited)

          return {
            traversal: Arr.appendAll(state.traversal, childState.traversal),
            visited: childState.visited
          }
        }
      )
    })()

const findLineagePath = (
  lookup: HashMap.HashMap<string, ReadonlyArray<string>>,
  currentId: string,
  targetId: string,
  visited: ReadonlyArray<string>
): Option.Option<ReadonlyArray<string>> =>
  visited.includes(currentId)
    ? Option.none()
    : currentId === targetId
    ? Option.some(Arr.append(visited, currentId))
    : Arr.reduce(
      Option.getOrElse(HashMap.get(lookup, currentId), () => Arr.empty<string>()),
      Option.none<ReadonlyArray<string>>(),
      (found, childId) =>
        Option.isSome(found)
          ? found
          : findLineagePath(lookup, childId, targetId, Arr.append(visited, currentId))
    )

/**
 * Canonical workflow-graph adapter input for LM-only traversal projections.
 *
 * @since 0.2.0
 * @category schemas
 */
export const WorkflowModuleGraphInputSchema = Schema.Struct({
  manifest: GraphExecutionManifestSchema,
  projection: GraphExecutionProjectionSchema
})

/**
 * Workflow-graph adapter input extracted from
 * {@link WorkflowModuleGraphInputSchema}.
 *
 * @since 0.2.0
 * @category type-level
 */
export type WorkflowModuleGraphInput = Schema.Schema.Type<typeof WorkflowModuleGraphInputSchema>

/**
 * Root-to-node lineage projected from a workflow manifest.
 *
 * @since 0.2.0
 * @category models
 */
export class WorkflowNodeLineage extends Schema.Class<WorkflowNodeLineage>("WorkflowNodeLineage")({
  targetNodeId: Schema.String,
  path: Schema.Array(Schema.String)
}) {}

/**
 * Deterministic traversal and lineage surface for workflow graphs consumed by
 * LM-only adapters.
 *
 * @since 0.2.0
 * @category models
 */
export class WorkflowModuleGraphProjection
  extends Schema.Class<WorkflowModuleGraphProjection>("WorkflowModuleGraphProjection")({
    manifestId: Schema.String,
    entryNodeId: Schema.String,
    traversal: Schema.Array(Schema.String),
    lineages: Schema.Array(WorkflowNodeLineage),
    activeStateLanes: Schema.Array(WorkflowStateLaneSchema)
  })
{}

/**
 * Machine-readable ownership record for the non-DSP authorities consumed by
 * workflow interop.
 *
 * @since 0.2.0
 * @category models
 */
export class WorkflowInteropOwnership extends Schema.Class<WorkflowInteropOwnership>("WorkflowInteropOwnership")({
  sessionAndRouting: Schema.Literal("effect-inference"),
  scoreAggregation: Schema.Literal("effect-math"),
  renderEvaluation: Schema.Literal("effect-text"),
  artifactTransport: Schema.Literal("effect-search")
}) {}

/**
 * Singleton ownership record for the workflow interop seam.
 *
 * @since 0.2.0
 * @category constants
 */
export const workflowInteropOwnership = new WorkflowInteropOwnership({
  sessionAndRouting: "effect-inference",
  scoreAggregation: "effect-math",
  renderEvaluation: "effect-text",
  artifactTransport: "effect-search"
})

/**
 * Projects a frozen workflow graph onto the deterministic traversal semantics
 * already used by `ModuleGraphProjection`.
 *
 * @since 0.2.0
 * @category combinators
 */
export const projectWorkflowModuleGraph = (input: WorkflowModuleGraphInput): WorkflowModuleGraphProjection => {
  const lookup = childLookup(input.manifest)

  return new WorkflowModuleGraphProjection({
    manifestId: input.manifest.manifestId,
    entryNodeId: input.projection.entryNodeId,
    traversal: traverseNode(lookup, input.projection.entryNodeId, Arr.empty<string>()).traversal,
    lineages: Arr.filterMap(Arr.sort(input.manifest.nodes, workflowNodeOrder), (node) =>
      Option.map(
        findLineagePath(lookup, input.projection.entryNodeId, node.nodeId, Arr.empty<string>()),
        (path) => new WorkflowNodeLineage({ targetNodeId: node.nodeId, path })
      )),
    activeStateLanes: input.projection.activeStateLanes
  })
}
