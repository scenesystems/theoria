/**
 * Composition graph construction and validation.
 *
 * @since 0.1.0
 */

/**
 * Decomposition rationale: graph construction, identity validation, cycle detection,
 * and canonical edge/node emission still share one recursion kernel, so they remain
 * co-located until the compose graph surface stabilizes further.
 */
import { Array as Arr, Boolean, Data, Effect, Equivalence, HashMap, Option, Order, Record, Schema, Tuple } from "effect"
import type { Ref } from "effect"
import type { ModuleGraph } from "../../contracts/ModuleGraph.js"
import { makeModuleGraph, ModuleGraphEdge, ModuleGraphNode } from "../../contracts/ModuleGraph.js"
import { ModuleId } from "../../contracts/ModuleId.js"
import { makeModuleNodeSignature, ModuleNode } from "../../contracts/ModuleNode.js"
import type { ModuleParams } from "../../contracts/ModuleParams.js"
import { CompositionError } from "../../Errors/module.js"
import type { Signature } from "../../Signature/model.js"

/**
 * Minimal non-generic projection of a Module for graph declaration.
 *
 * This type captures only the fields needed for composition graph construction
 * without requiring the generic `I/O` type parameters, avoiding variance issues
 * when storing heterogeneous sub-modules.
 *
 * @since 0.1.0
 * @category models
 */
class ComposableSignature extends Data.Class<{
  readonly description: string
  readonly instructions: string
}> {}

export class ComposableModule extends Data.Class<{
  readonly name: string
  readonly signature: ComposableSignature
  readonly params: Ref.Ref<ModuleParams>
  readonly subModules: HashMap.HashMap<ModuleId, ModuleNode>
}> {}

const moduleIdOrder: Order.Order<ModuleId> = Order.mapInput(Order.string, (moduleId: ModuleId) => moduleId)

const moduleIdEquivalence: Equivalence.Equivalence<ModuleId> = Equivalence.string

const moduleIdentity = Equivalence.strict<ComposableModule>()

class AliasedComposableModule extends Data.Class<{
  readonly alias: string
  readonly module: ComposableModule
}> {}

class ResolvedComposableModule extends Data.Class<{
  readonly moduleId: ModuleId
  readonly module: ComposableModule
}> {}

class DeclaredChildNode extends Data.Class<{
  readonly declaredId: ModuleId
  readonly childNode: ModuleNode
}> {}

class ResolvedChildNode extends Data.Class<{
  readonly moduleId: ModuleId
  readonly childNode: ModuleNode
}> {}

const aliasOrder: Order.Order<AliasedComposableModule> = Order.mapInput(
  Order.string,
  (entry) => entry.alias
)

const moduleNodeEntryOrder: Order.Order<DeclaredChildNode> = Order.mapInput(
  moduleIdOrder,
  (entry) => entry.declaredId
)

const uniqueSortedModuleIds = (moduleIds: Iterable<ModuleId>): ModuleGraphNode["subModuleIds"] =>
  Arr.dedupeWith(Arr.sort(Arr.fromIterable(moduleIds), moduleIdOrder), moduleIdEquivalence)

const edgeKey = (parentId: ModuleId, childId: ModuleId): string => Arr.join(Arr.make(parentId, "->", childId), "")

class GraphBuildState extends Data.Class<{
  readonly nodeById: HashMap.HashMap<ModuleId, ModuleGraphNode>
  readonly sourceById: HashMap.HashMap<ModuleId, ComposableModule>
  readonly edgeByKey: HashMap.HashMap<string, ModuleGraphEdge>
}> {}

const emptyGraphBuildState = new GraphBuildState({
  nodeById: HashMap.empty<ModuleId, ModuleGraphNode>(),
  sourceById: HashMap.empty<ModuleId, ComposableModule>(),
  edgeByKey: HashMap.empty<string, ModuleGraphEdge>()
})

const decodeModuleId = (
  moduleName: string,
  owner: string
): Effect.Effect<ModuleId, CompositionError> =>
  Schema.decodeUnknown(ModuleId)(moduleName).pipe(
    Effect.mapError(() =>
      new CompositionError({
        message: Arr.join(Arr.make("Invalid module id '", moduleName, "' in ", owner), ""),
        moduleName
      })
    )
  )

const rootCollisionError = (rootId: ModuleId): CompositionError =>
  new CompositionError({
    message: Arr.join(Arr.make("Sub-module id '", rootId, "' collides with composed module id"), ""),
    moduleName: rootId
  })

const cycleError = (
  stack: ModuleGraphNode["subModuleIds"],
  moduleId: ModuleId
): CompositionError =>
  new CompositionError({
    message: Arr.join(
      Arr.make("Composition cycle detected: ", Arr.join(Arr.append(stack, moduleId), " -> ")),
      ""
    ),
    moduleName: moduleId
  })

const duplicateIdError = (moduleId: ModuleId): CompositionError =>
  new CompositionError({
    message: Arr.join(
      Arr.make("Multiple module instances share id '", moduleId, "' in the same composition graph"),
      ""
    ),
    moduleName: moduleId
  })

const declaredIdMismatchError = (
  ownerName: string,
  declaredId: ModuleId,
  actualId: ModuleId
): CompositionError =>
  new CompositionError({
    message: Arr.join(
      Arr.make(
        "Sub-module '",
        ownerName,
        "' declares child id '",
        declaredId,
        "' but child module resolves to '",
        actualId,
        "'"
      ),
      ""
    ),
    moduleName: ownerName
  })

const directSubModuleEntries = (
  subModules: ComposeSubModules
): Effect.Effect<Iterable<ResolvedComposableModule>, CompositionError> => {
  const aliasedModules = Arr.map(
    Record.toEntries(subModules),
    (entry) =>
      new AliasedComposableModule({
        alias: Tuple.getFirst(entry),
        module: Tuple.getSecond(entry)
      })
  )

  return Effect.forEach(
    Arr.sort(aliasedModules, aliasOrder),
    (entry) =>
      decodeModuleId(
        entry.module.name,
        Arr.join(Arr.make("compose sub-module alias '", entry.alias, "'"), "")
      ).pipe(
        Effect.map((moduleId) => new ResolvedComposableModule({ moduleId, module: entry.module }))
      )
  )
}

const directSubModuleMap = (
  entries: Iterable<ResolvedComposableModule>
): Effect.Effect<HashMap.HashMap<ModuleId, ComposableModule>, CompositionError> =>
  Effect.reduce(
    entries,
    HashMap.empty<ModuleId, ComposableModule>(),
    (current, entry) =>
      Option.match(HashMap.get(current, entry.moduleId), {
        onNone: () => Effect.succeed(HashMap.set(current, entry.moduleId, entry.module)),
        onSome: (existing) =>
          Boolean.match(moduleIdentity(existing, entry.module), {
            onTrue: () => Effect.succeed(current),
            onFalse: () => Effect.fail(duplicateIdError(entry.moduleId))
          })
      })
  )

const childNodeEntries = (
  module: ComposableModule
): Effect.Effect<Iterable<ResolvedChildNode>, CompositionError> => {
  const declaredChildren = Arr.map(
    HashMap.toEntries(module.subModules),
    (entry) =>
      new DeclaredChildNode({
        declaredId: Tuple.getFirst(entry),
        childNode: Tuple.getSecond(entry)
      })
  )

  return Effect.forEach(
    Arr.sort(declaredChildren, moduleNodeEntryOrder),
    (entry) =>
      decodeModuleId(
        entry.childNode.name,
        Arr.join(Arr.make("compose sub-module '", module.name, "'"), "")
      ).pipe(
        Effect.flatMap((actualId) =>
          Boolean.match(moduleIdEquivalence(entry.declaredId, actualId), {
            onTrue: () => Effect.succeed(new ResolvedChildNode({ moduleId: actualId, childNode: entry.childNode })),
            onFalse: () => Effect.fail(declaredIdMismatchError(module.name, entry.declaredId, actualId))
          })
        )
      )
  )
}

const registerIdentity = (
  state: GraphBuildState,
  moduleId: ModuleId,
  module: ComposableModule
): Effect.Effect<GraphBuildState, CompositionError> =>
  Option.match(HashMap.get(state.sourceById, moduleId), {
    onNone: () =>
      Effect.succeed(
        new GraphBuildState({
          nodeById: state.nodeById,
          sourceById: HashMap.set(state.sourceById, moduleId, module),
          edgeByKey: state.edgeByKey
        })
      ),
    onSome: (existing) =>
      Boolean.match(moduleIdentity(existing, module), {
        onTrue: () => Effect.succeed(state),
        onFalse: () => Effect.fail(duplicateIdError(moduleId))
      })
  })

const addEdges = (
  state: GraphBuildState,
  parentId: ModuleId,
  childIds: Iterable<ModuleId>
): GraphBuildState =>
  new GraphBuildState({
    nodeById: state.nodeById,
    sourceById: state.sourceById,
    edgeByKey: Arr.reduce(childIds, state.edgeByKey, (edgeByKey, childId) =>
      HashMap.set(
        edgeByKey,
        edgeKey(parentId, childId),
        new ModuleGraphEdge({ parentId, childId })
      ))
  })

class VisitChildNodeOptions extends Data.Class<{
  readonly childNode: ModuleNode
  readonly rootId: ModuleId
  readonly stack: ModuleGraphNode["subModuleIds"]
  readonly state: GraphBuildState
}> {}

const visitChildNode = (options: VisitChildNodeOptions): Effect.Effect<GraphBuildState, CompositionError> =>
  Effect.gen(function*() {
    const moduleId = yield* decodeModuleId(
      options.childNode.name,
      Arr.join(Arr.make("composed module '", options.childNode.name, "'"), "")
    )

    yield* Effect.if(moduleIdEquivalence(moduleId, options.rootId), {
      onTrue: () => Effect.fail(rootCollisionError(moduleId)),
      onFalse: () => Effect.void
    })

    yield* Effect.if(Arr.containsWith(moduleIdEquivalence)(options.stack, moduleId), {
      onTrue: () => Effect.fail(cycleError(options.stack, moduleId)),
      onFalse: () => Effect.void
    })

    return yield* Option.match(HashMap.get(options.state.nodeById, moduleId), {
      onSome: () => Effect.succeed(options.state),
      onNone: () =>
        Effect.gen(function*() {
          const childEntries = Arr.sort(
            Arr.map(
              HashMap.toEntries(options.childNode.subModules),
              (entry) =>
                new DeclaredChildNode({
                  declaredId: Tuple.getFirst(entry),
                  childNode: Tuple.getSecond(entry)
                })
            ),
            moduleNodeEntryOrder
          )
          const childIds = uniqueSortedModuleIds(Arr.map(childEntries, (entry) => entry.declaredId))
          const node = new ModuleGraphNode({
            moduleId,
            signature: makeModuleNodeSignature(
              options.childNode.signature.description,
              options.childNode.signature.instructions
            ),
            subModuleIds: childIds
          })
          const withNode = new GraphBuildState({
            nodeById: HashMap.set(options.state.nodeById, moduleId, node),
            sourceById: options.state.sourceById,
            edgeByKey: options.state.edgeByKey
          })
          const withEdges = addEdges(withNode, moduleId, childIds)
          const nextStack = Arr.append(options.stack, moduleId)

          return yield* Effect.reduce(childEntries, withEdges, (state, entry) =>
            visitChildNode(
              new VisitChildNodeOptions({
                childNode: entry.childNode,
                rootId: options.rootId,
                stack: nextStack,
                state
              })
            ))
        })
    })
  })

/**
 * Declares direct child modules under caller-local aliases.
 *
 * @remarks
 * Graph identities come from each value's `name`. Keys affect deterministic
 * traversal and error context but are not retained in the resulting graph.
 *
 * @since 0.1.0
 * @category models
 */
export type ComposeSubModules = Record.ReadonlyRecord<string, ComposableModule>

/**
 * Validated composition graph output containing the root module id,
 * direct child ids, full module graph, and a map of direct sub-module
 * nodes by id.
 *
 * @since 0.1.0
 * @category models
 */
export class CompositionGraph extends Data.Class<{
  readonly rootId: ModuleId
  readonly rootChildIds: ModuleGraphNode["subModuleIds"]
  readonly graph: ModuleGraph
  readonly subModuleNodesById: HashMap.HashMap<ModuleId, ModuleNode>
}> {}

const buildSubModuleNode = (
  module: ComposableModule,
  moduleId: ModuleId
): ModuleNode =>
  new ModuleNode({
    moduleId,
    name: module.name,
    signature: makeModuleNodeSignature(
      module.signature.description,
      module.signature.instructions
    ),
    params: module.params,
    subModules: module.subModules
  })

/**
 * Declares the root metadata used to validate a composition graph.
 *
 * @since 0.1.0
 * @category models
 */
export class ComposeGraphOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
> extends Data.Class<{
  readonly name: string
  readonly signature: Signature<I, O>
  readonly subModules: ComposeSubModules
}> {}

/**
 * Build and validate the canonical module graph for a composed module.
 * Detects cycles, duplicate identities, and id mismatches during a
 * single recursive traversal.
 *
 * @since 0.1.0
 * @category constructors
 */
export const buildCompositionGraph = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: ComposeGraphOptions<I, O>): Effect.Effect<CompositionGraph, CompositionError> =>
  Effect.gen(function*() {
    const rootId = yield* decodeModuleId(
      options.name,
      Arr.join(Arr.make("compose root '", options.name, "'"), "")
    )
    const directEntries = yield* directSubModuleEntries(options.subModules)
    const directMap = yield* directSubModuleMap(directEntries)
    const rootChildIds = uniqueSortedModuleIds(Arr.fromIterable(HashMap.keys(directMap)))
    const rootNode = new ModuleGraphNode({
      moduleId: rootId,
      signature: makeModuleNodeSignature(
        options.signature.description,
        options.signature.instructions
      ),
      subModuleIds: rootChildIds
    })
    const rootState = addEdges(
      new GraphBuildState({
        nodeById: HashMap.set(emptyGraphBuildState.nodeById, rootId, rootNode),
        sourceById: emptyGraphBuildState.sourceById,
        edgeByKey: emptyGraphBuildState.edgeByKey
      }),
      rootId,
      rootChildIds
    )
    const discovered = yield* Effect.reduce(
      directEntries,
      rootState,
      (state, entry) => {
        const withIdentity = registerIdentity(state, entry.moduleId, entry.module)

        return Effect.flatMap(withIdentity, (identityState) => {
          const childEntries = childNodeEntries(entry.module)

          return Effect.flatMap(childEntries, (children) => {
            const childIds = uniqueSortedModuleIds(Arr.map(Arr.fromIterable(children), (child) => child.moduleId))
            const graphNode = new ModuleGraphNode({
              moduleId: entry.moduleId,
              signature: makeModuleNodeSignature(
                entry.module.signature.description,
                entry.module.signature.instructions
              ),
              subModuleIds: childIds
            })
            const withNode = new GraphBuildState({
              nodeById: HashMap.set(identityState.nodeById, entry.moduleId, graphNode),
              sourceById: identityState.sourceById,
              edgeByKey: identityState.edgeByKey
            })
            const withEdges = addEdges(withNode, entry.moduleId, childIds)

            return Effect.reduce(children, withEdges, (childState, child) =>
              visitChildNode(
                new VisitChildNodeOptions({
                  childNode: child.childNode,
                  rootId,
                  stack: Arr.make(rootId, entry.moduleId),
                  state: childState
                })
              ))
          })
        })
      }
    )
    const graph = makeModuleGraph({
      rootId,
      nodes: Arr.fromIterable(HashMap.values(discovered.nodeById)),
      edges: Arr.fromIterable(HashMap.values(discovered.edgeByKey))
    })
    const subModuleNodesById = HashMap.reduce(
      directMap,
      HashMap.empty<ModuleId, ModuleNode>(),
      (acc, module, moduleId) => HashMap.set(acc, moduleId, buildSubModuleNode(module, moduleId))
    )

    return new CompositionGraph({
      rootId,
      rootChildIds,
      graph,
      subModuleNodesById
    })
  })

/**
 * Validates a module ownership declaration and returns its graph value.
 *
 * @remarks
 * This performs the same graph traversal as {@link compose}, but does not
 * allocate root parameters or a `forward` operation. A `CompositionError`
 * reports invalid module ids, cycles, direct identity collisions, or declared
 * child ids that disagree with their node names.
 *
 * @typeParam I - Input fields used only for the root signature metadata.
 * @typeParam O - Output fields used only for the root signature metadata.
 * @param options - Root identity, signature metadata, and direct children.
 * @returns The validated root and descendant ownership graph.
 *
 * @since 0.1.0
 * @category constructors
 */
export const composeGraph = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: ComposeGraphOptions<I, O>): Effect.Effect<ModuleGraph, CompositionError> =>
  buildCompositionGraph(options).pipe(
    Effect.map((result) => result.graph)
  )
