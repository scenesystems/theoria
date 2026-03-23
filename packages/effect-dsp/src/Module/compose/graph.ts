/**
 * Composition graph construction and validation.
 *
 * @since 0.0.0
 */

/**
 * Decomposition rationale: Task 2.8 requires graph construction, identity validation,
 * cycle detection, and canonical edge/node emission to share one recursion kernel.
 *
 * Decomposition plan: split this file into `ids.ts`, `validation.ts`, and `builder.ts`
 * once Task 2.9 lands and compose+CoT graph contracts stabilize.
 */
import { Array as Arr, Data, Effect, HashMap, Option, Order, Record, Schema } from "effect"
import type { Ref } from "effect"
import type { ModuleGraph } from "../../contracts/ModuleGraph.js"
import { makeModuleGraph, ModuleGraphEdge, ModuleGraphNode } from "../../contracts/ModuleGraph.js"
import { ModuleId } from "../../contracts/ModuleId.js"
import { makeModuleNodeSignature, type ModuleNode } from "../../contracts/ModuleNode.js"
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
 * @since 0.0.0
 * @category models
 */
export type ComposableModule = Readonly<{
  readonly name: string
  readonly signature: Readonly<{
    readonly description: string
    readonly instructions: string
  }>
  readonly params: Ref.Ref<ModuleParams>
  readonly subModules: HashMap.HashMap<ModuleId, ModuleNode>
}>

const moduleIdOrder: Order.Order<ModuleId> = Order.mapInput(Order.string, (moduleId: ModuleId) => moduleId)

const aliasOrder: Order.Order<readonly [string, ComposableModule]> = Order.mapInput(
  Order.string,
  ([alias]) => alias
)

const moduleNodeEntryOrder: Order.Order<readonly [ModuleId, ModuleNode]> = Order.mapInput(
  moduleIdOrder,
  ([moduleId]) => moduleId
)

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

const edgeKey = (parentId: ModuleId, childId: ModuleId): string => `${parentId}->${childId}`

type GraphBuildState = Readonly<{
  readonly nodeById: HashMap.HashMap<ModuleId, ModuleGraphNode>
  readonly sourceById: HashMap.HashMap<ModuleId, ComposableModule>
  readonly edgeByKey: HashMap.HashMap<string, ModuleGraphEdge>
}>

const emptyGraphBuildState: GraphBuildState = {
  nodeById: HashMap.empty<ModuleId, ModuleGraphNode>(),
  sourceById: HashMap.empty<ModuleId, ComposableModule>(),
  edgeByKey: HashMap.empty<string, ModuleGraphEdge>()
}

const decodeModuleId = (
  moduleName: string,
  owner: string
): Effect.Effect<ModuleId, CompositionError> =>
  Schema.decodeUnknown(ModuleId)(moduleName).pipe(
    Effect.mapError(() =>
      new CompositionError({
        message: `Invalid module id '${moduleName}' in ${owner}`,
        moduleName
      })
    )
  )

const rootCollisionError = (rootId: ModuleId): CompositionError =>
  new CompositionError({
    message: `Sub-module id '${rootId}' collides with composed module id`,
    moduleName: rootId
  })

const cycleError = (
  stack: ReadonlyArray<ModuleId>,
  moduleId: ModuleId
): CompositionError =>
  new CompositionError({
    message: `Composition cycle detected: ${Arr.join(Arr.append(stack, moduleId), " -> ")}`,
    moduleName: moduleId
  })

const duplicateIdError = (moduleId: ModuleId): CompositionError =>
  new CompositionError({
    message: `Multiple module instances share id '${moduleId}' in the same composition graph`,
    moduleName: moduleId
  })

const declaredIdMismatchError = (
  ownerName: string,
  declaredId: ModuleId,
  actualId: ModuleId
): CompositionError =>
  new CompositionError({
    message: `Sub-module '${ownerName}' declares child id '${declaredId}' but child module resolves to '${actualId}'`,
    moduleName: ownerName
  })

const directSubModuleEntries = (
  subModules: ComposeSubModules
): Effect.Effect<ReadonlyArray<readonly [ModuleId, ComposableModule]>, CompositionError> =>
  Effect.forEach(
    Arr.sort(Record.toEntries(subModules), aliasOrder),
    ([alias, module]) =>
      decodeModuleId(module.name, `compose sub-module alias '${alias}'`).pipe(
        Effect.map((moduleId) => Data.tuple(moduleId, module))
      )
  )

const directSubModuleMap = (
  entries: ReadonlyArray<readonly [ModuleId, ComposableModule]>
): Effect.Effect<HashMap.HashMap<ModuleId, ComposableModule>, CompositionError> =>
  Effect.reduce(
    entries,
    HashMap.empty<ModuleId, ComposableModule>(),
    (current, [moduleId, module]) =>
      Option.match(HashMap.get(current, moduleId), {
        onNone: () => Effect.succeed(HashMap.set(current, moduleId, module)),
        onSome: (existing) =>
          existing === module
            ? Effect.succeed(current)
            : Effect.fail(duplicateIdError(moduleId))
      })
  )

const childNodeEntries = (
  module: ComposableModule
): Effect.Effect<ReadonlyArray<readonly [ModuleId, ModuleNode]>, CompositionError> =>
  Effect.forEach(
    Arr.sort(
      Arr.fromIterable(HashMap.toEntries(module.subModules)),
      moduleNodeEntryOrder
    ),
    ([declaredId, childNode]) =>
      decodeModuleId(childNode.name, `compose sub-module '${module.name}'`).pipe(
        Effect.flatMap((actualId) =>
          declaredId === actualId
            ? Effect.succeed(Data.tuple(actualId, childNode))
            : Effect.fail(declaredIdMismatchError(module.name, declaredId, actualId))
        )
      )
  )

const registerIdentity = (
  state: GraphBuildState,
  moduleId: ModuleId,
  module: ComposableModule
): Effect.Effect<GraphBuildState, CompositionError> =>
  Option.match(HashMap.get(state.sourceById, moduleId), {
    onNone: () =>
      Effect.succeed({
        nodeById: state.nodeById,
        sourceById: HashMap.set(state.sourceById, moduleId, module),
        edgeByKey: state.edgeByKey
      }),
    onSome: (existing) =>
      existing === module
        ? Effect.succeed(state)
        : Effect.fail(duplicateIdError(moduleId))
  })

const addEdges = (
  state: GraphBuildState,
  parentId: ModuleId,
  childIds: ReadonlyArray<ModuleId>
): GraphBuildState => ({
  nodeById: state.nodeById,
  sourceById: state.sourceById,
  edgeByKey: Arr.reduce(childIds, state.edgeByKey, (edgeByKey, childId) =>
    HashMap.set(
      edgeByKey,
      edgeKey(parentId, childId),
      new ModuleGraphEdge({ parentId, childId })
    ))
})

const visitChildNode = (options: {
  readonly childNode: ModuleNode
  readonly rootId: ModuleId
  readonly stack: ReadonlyArray<ModuleId>
  readonly state: GraphBuildState
}): Effect.Effect<GraphBuildState, CompositionError> =>
  Effect.gen(function*() {
    const moduleId = yield* decodeModuleId(options.childNode.name, `composed module '${options.childNode.name}'`)

    if (moduleId === options.rootId) {
      return yield* Effect.fail(rootCollisionError(moduleId))
    }

    if (options.stack.includes(moduleId)) {
      return yield* Effect.fail(cycleError(options.stack, moduleId))
    }

    return yield* Option.match(HashMap.get(options.state.nodeById, moduleId), {
      onSome: () => Effect.succeed(options.state),
      onNone: () =>
        Effect.gen(function*() {
          const childEntries = Arr.sort(
            Arr.fromIterable(HashMap.toEntries(options.childNode.subModules)),
            moduleNodeEntryOrder
          )
          const childIds = uniqueSortedModuleIds(Arr.map(childEntries, ([childId]) => childId))
          const node = new ModuleGraphNode({
            moduleId,
            signature: makeModuleNodeSignature(
              options.childNode.signature.description,
              options.childNode.signature.instructions
            ),
            subModuleIds: childIds
          })
          const withNode: GraphBuildState = {
            nodeById: HashMap.set(options.state.nodeById, moduleId, node),
            sourceById: options.state.sourceById,
            edgeByKey: options.state.edgeByKey
          }
          const withEdges = addEdges(withNode, moduleId, childIds)
          const nextStack = Arr.append(options.stack, moduleId)

          return yield* Effect.reduce(childEntries, withEdges, (state, [, childNode]) =>
            visitChildNode({
              childNode,
              rootId: options.rootId,
              stack: nextStack,
              state
            }))
        })
    })
  })

/**
 * Sub-module declaration map keyed by local alias. Each entry is a
 * `ComposableModule` projection — the alias is discarded after graph
 * construction.
 *
 * @since 0.0.0
 * @category models
 */
export type ComposeSubModules = Readonly<Record<string, ComposableModule>>

/**
 * Validated composition graph output containing the root module id,
 * direct child ids, full module graph, and a map of direct sub-module
 * nodes by id.
 *
 * @since 0.0.0
 * @category models
 */
export class CompositionGraph extends Data.Class<{
  readonly rootId: ModuleId
  readonly rootChildIds: ReadonlyArray<ModuleId>
  readonly graph: ModuleGraph
  readonly subModuleNodesById: HashMap.HashMap<ModuleId, ModuleNode>
}> {}

const buildSubModuleNode = (
  module: ComposableModule,
  moduleId: ModuleId
): ModuleNode => ({
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
 * Build and validate the canonical module graph for a composed module.
 * Detects cycles, duplicate identities, and id mismatches during a
 * single recursive traversal.
 *
 * @since 0.0.0
 * @category constructors
 */
export const buildCompositionGraph = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly name: string
  readonly signature: Signature<I, O>
  readonly subModules: ComposeSubModules
}): Effect.Effect<CompositionGraph, CompositionError> =>
  Effect.gen(function*() {
    const rootId = yield* decodeModuleId(options.name, `compose root '${options.name}'`)
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
      {
        nodeById: HashMap.set(emptyGraphBuildState.nodeById, rootId, rootNode),
        sourceById: emptyGraphBuildState.sourceById,
        edgeByKey: emptyGraphBuildState.edgeByKey
      },
      rootId,
      rootChildIds
    )
    const discovered = yield* Effect.reduce(
      directEntries,
      rootState,
      (state, [moduleId, module]) => {
        const withIdentity = registerIdentity(state, moduleId, module)

        return Effect.flatMap(withIdentity, (identityState) => {
          const childEntries = childNodeEntries(module)

          return Effect.flatMap(childEntries, (children) => {
            const childIds = uniqueSortedModuleIds(Arr.map(children, ([childId]) => childId))
            const graphNode = new ModuleGraphNode({
              moduleId,
              signature: makeModuleNodeSignature(
                module.signature.description,
                module.signature.instructions
              ),
              subModuleIds: childIds
            })
            const withNode: GraphBuildState = {
              nodeById: HashMap.set(identityState.nodeById, moduleId, graphNode),
              sourceById: identityState.sourceById,
              edgeByKey: identityState.edgeByKey
            }
            const withEdges = addEdges(withNode, moduleId, childIds)

            return Effect.reduce(children, withEdges, (childState, [, childNode]) =>
              visitChildNode({
                childNode,
                rootId,
                stack: Arr.make(rootId, moduleId),
                state: childState
              }))
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
 * Build and return only the graph contract from a composition declaration,
 * discarding the sub-module node map.
 *
 * @since 0.0.0
 * @category constructors
 */
export const composeGraph = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly name: string
  readonly signature: Signature<I, O>
  readonly subModules: ComposeSubModules
}): Effect.Effect<ModuleGraph, CompositionError> =>
  buildCompositionGraph(options).pipe(
    Effect.map((result) => result.graph)
  )
