/**
 * Non-generic runtime views used for module discovery and graph projection.
 *
 * @since 0.1.0
 */
import type { Ref } from "effect"
import { Array as Arr, Boolean, Data, Equivalence, Graph, HashMap, Option, Order, Schema, Tuple } from "effect"
import type { DemoContract } from "./DemoContract.js"
import type { ModuleId } from "./ModuleId.js"
import type { ModuleParams } from "./ModuleParams.js"

/**
 * Retains prompt metadata without a signature's generic field schemas.
 *
 * @remarks
 * This projection is suitable for discovery and optimizer inspection. It cannot
 * decode module inputs or outputs.
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleNodeSignature extends Schema.Class<ModuleNodeSignature>("ModuleNodeSignature")({
  /** Task description from the owning signature. */
  description: Schema.String,
  /** Default instruction text derived from the owning signature. */
  instructions: Schema.String
}) {}

/**
 * Exposes the mutable parameter and child ownership surface of one module.
 *
 * @remarks
 * The recursive child map contains live nodes and parameter refs. It is a runtime
 * discovery view rather than a serializable graph value.
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleNode extends Data.Class<{
  /** Branded identity used as the node's graph key. */
  readonly moduleId: ModuleId
  /** Public module name retained for diagnostics and parameter persistence. */
  readonly name: string
  /** Prompt metadata without input and output schemas. */
  readonly signature: ModuleNodeSignature
  /** Demonstration operations compiled by the original signature. */
  readonly demoContract: DemoContract
  /** Mutable parameter state owned by this node. */
  readonly params: Ref.Ref<ModuleParams>
  /** Immediate child nodes keyed by their branded identities. */
  readonly subModules: HashMap.HashMap<ModuleId, ModuleNode>
}> {}

/**
 * Retains the supplied live module-node references without copying or validation.
 *
 * @param options - Live node record returned unchanged.
 * @returns The same record by identity.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeModuleNode = (options: ModuleNode): ModuleNode => options

/**
 * Creates prompt metadata for a discovered module node.
 *
 * @param description - Task description from the full signature.
 * @param instructions - Default instruction text from the full signature.
 * @returns A schema-class value containing those strings.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeModuleNodeSignature = (
  description: string,
  instructions: string
): ModuleNodeSignature =>
  new ModuleNodeSignature({
    description,
    instructions
  })

/**
 * Retains each declaration for identity validation after graph normalization.
 * @since 0.4.0
 * @category models
 */
export class ModuleNodeDeclaration extends Data.Class<{
  readonly declaredId: ModuleId
  readonly child: ModuleNode
}> {}

class NormalizationWorklist extends Data.Class<{
  readonly pending: Iterable<ModuleNode>
  readonly expanded: Iterable<ModuleNode>
}> {}

const nodeIdentity = Equivalence.strict<ModuleNode>()
const ownerIdentity = Equivalence.strict<ModuleNode["params"]>()
const declarationOrder: Order.Order<ModuleNodeDeclaration> = Order.mapInput(Order.string, (edge) => edge.declaredId)

/**
 * Materializes recursive live ownership into a native directed graph.
 *
 * The finite worklist expands each wrapper once, retaining all declarations.
 * Nodes share identity through their live parameter Ref, not projected wrapper
 * identity. No parameter state is read or written. Graph algorithms belong to
 * native Graph consumers, not this normalization pass.
 *
 * @since 0.4.0
 * @category constructors
 */
export const moduleNodeGraph = (roots: Iterable<ModuleNode>): Graph.DirectedGraph<ModuleNode, ModuleNodeDeclaration> =>
  Graph.directed<ModuleNode, ModuleNodeDeclaration>((mutable) => {
    const register = (node: ModuleNode) =>
      Option.getOrElse(
        Graph.findNode(mutable, (existing) => ownerIdentity(existing.params, node.params)),
        () => Graph.addNode(mutable, node)
      )
    const initial = Arr.fromIterable(roots)
    Arr.forEach(initial, register)
    Arr.unfold(
      new NormalizationWorklist({ pending: initial, expanded: Arr.empty() }),
      (state) =>
        Option.map(Arr.head(Arr.fromIterable(state.pending)), (node) => {
          const rest = Arr.drop(state.pending, 1)
          return Tuple.make(
            node,
            Boolean.match(Arr.containsWith(nodeIdentity)(state.expanded, node), {
              onTrue: () => new NormalizationWorklist({ pending: rest, expanded: state.expanded }),
              onFalse: () => {
                const source = register(node)
                const declarations = Arr.sort(
                  Arr.map(
                    HashMap.toEntries(node.subModules),
                    ([declaredId, child]) => new ModuleNodeDeclaration({ declaredId, child })
                  ),
                  declarationOrder
                )
                Arr.forEach(declarations, (declaration) => {
                  Graph.addEdge(mutable, source, register(declaration.child), declaration)
                })
                return new NormalizationWorklist({
                  pending: Arr.appendAll(rest, Arr.map(declarations, (declaration) => declaration.child)),
                  expanded: Arr.append(state.expanded, node)
                })
              }
            })
          )
        })
    )
  })
