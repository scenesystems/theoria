/**
 * Composition graph construction and validation.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Equivalence, Graph, HashMap, Option, Order, Record, Schema } from "effect"
import type { Ref } from "effect"
import type { DemoContract } from "../../contracts/DemoContract.js"
import type { ModuleGraph } from "../../contracts/ModuleGraph.js"
import { makeModuleGraph, ModuleGraphEdge, ModuleGraphNode } from "../../contracts/ModuleGraph.js"
import { ModuleId } from "../../contracts/ModuleId.js"
import {
  makeModuleNodeSignature,
  ModuleNode,
  moduleNodeGraph,
  ModuleNodeSignature
} from "../../contracts/ModuleNode.js"
import type { ModuleParams } from "../../contracts/ModuleParams.js"
import { CompositionError } from "../../Errors/module.js"
import type { Signature } from "../../Signature/model.js"

class ComposableSignature extends Data.Class<{
  readonly description: string
  readonly instructions: string
  readonly demoContract: DemoContract
}> {}

/**
 * Retains live ownership and signature-compiled demonstration operations.
 * @since 0.1.0
 * @category models
 */
export class ComposableModule extends Data.Class<{
  readonly name: string
  readonly signature: ComposableSignature
  readonly params: Ref.Ref<ModuleParams>
  readonly subModules: HashMap.HashMap<ModuleId, ModuleNode>
}> {}

const ownerIdentity = Equivalence.strict<Ref.Ref<ModuleParams>>()
const contractIdentity = Equivalence.strict<DemoContract>()
const metadataEquivalence = Schema.equivalence(ModuleNodeSignature)
const declarationEquivalence = Equivalence.array(Equivalence.tuple(
  Equivalence.string,
  Equivalence.struct({ moduleId: Equivalence.string, name: Equivalence.string, params: ownerIdentity })
))
const nodeOrder: Order.Order<ModuleNode> = Order.mapInput(Order.string, (node) => node.moduleId)

const sortedDeclarations = (node: ModuleNode) =>
  Arr.sort(HashMap.toEntries(node.subModules), Order.tuple(Order.string, Order.empty<ModuleNode>()))

const decodeModuleId = (moduleName: string): Effect.Effect<ModuleId, CompositionError> =>
  Schema.decodeUnknown(ModuleId)(moduleName).pipe(
    Effect.mapError(() =>
      new CompositionError({
        message: Arr.join(Arr.make("Invalid module id '", moduleName, "' in composition"), ""),
        moduleName
      })
    )
  )

const duplicateIdError = (moduleId: ModuleId): CompositionError =>
  new CompositionError({
    message: Arr.join(
      Arr.make("Multiple module instances share id '", moduleId, "' in the same composition graph"),
      ""
    ),
    moduleName: moduleId
  })

const validateDeclaredId = (ownerName: string, declaredId: ModuleId, actualId: ModuleId) =>
  Effect.if(Equivalence.string(declaredId, actualId), {
    onTrue: () => Effect.void,
    onFalse: () =>
      Effect.fail(
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
      )
  })

const validateNode = (rootId: ModuleId, node: ModuleNode) =>
  Effect.gen(function*() {
    const actualId = yield* decodeModuleId(node.name)
    yield* validateDeclaredId(node.name, node.moduleId, actualId)
    yield* Effect.if(Equivalence.string(actualId, rootId), {
      onTrue: () =>
        Effect.fail(
          new CompositionError({
            message: Arr.join(Arr.make("Sub-module id '", rootId, "' collides with composed module id"), ""),
            moduleName: rootId
          })
        ),
      onFalse: () => Effect.void
    })
  })

const projectionError = (node: ModuleNode, detail: string): CompositionError =>
  new CompositionError({
    message: Arr.join(Arr.make("Module owner '", node.moduleId, "' has inconsistent ", detail), ""),
    moduleName: node.moduleId
  })

// Compare immediate declarations, not recursive wrapper equality. Every wrapper
// is checked through its direct alias or retained native graph edge, including
// alternate projections of a shared child. The first retained projection is
// therefore sufficient for later parameter traversal without dropping owners.
const validateProjection = (canonical: ModuleNode, node: ModuleNode) =>
  Effect.gen(function*() {
    yield* validateDeclaredId(node.name, node.moduleId, canonical.moduleId)
    yield* Effect.if(metadataEquivalence(canonical.signature, node.signature), {
      onTrue: () => Effect.void,
      onFalse: () => Effect.fail(projectionError(node, "signature metadata"))
    })
    yield* Effect.if(contractIdentity(canonical.demoContract, node.demoContract), {
      onTrue: () => Effect.void,
      onFalse: () => Effect.fail(projectionError(node, "demonstration contract"))
    })
    yield* Effect.if(declarationEquivalence(sortedDeclarations(canonical), sortedDeclarations(node)), {
      onTrue: () => Effect.void,
      onFalse: () => Effect.fail(projectionError(node, "child declarations"))
    })
  })

const registerOwner = (owners: HashMap.HashMap<ModuleId, ModuleNode>, node: ModuleNode) =>
  Option.match(HashMap.get(owners, node.moduleId), {
    onNone: () => Effect.succeed(HashMap.set(owners, node.moduleId, node)),
    onSome: (existing) =>
      Effect.if(ownerIdentity(existing.params, node.params), {
        onTrue: () => Effect.succeed(owners),
        onFalse: () => Effect.fail(duplicateIdError(node.moduleId))
      })
  })

/**
 * Declares direct modules under caller-local aliases, not graph identities.
 * @since 0.1.0
 * @category models
 */
export type ComposeSubModules = Record.ReadonlyRecord<string, ComposableModule>

/**
 * Validated graph and live direct children for composed execution.
 * @since 0.1.0
 * @category models
 */
export class CompositionGraph extends Data.Class<{
  readonly rootId: ModuleId
  readonly rootChildIds: ModuleGraphNode["subModuleIds"]
  readonly graph: ModuleGraph
  readonly subModuleNodesById: HashMap.HashMap<ModuleId, ModuleNode>
}> {}

const buildSubModuleNode = (module: ComposableModule, moduleId: ModuleId): ModuleNode =>
  new ModuleNode({
    moduleId,
    name: module.name,
    signature: makeModuleNodeSignature(module.signature.description, module.signature.instructions),
    demoContract: module.signature.demoContract,
    params: module.params,
    subModules: module.subModules
  })

/**
 * Declares root metadata and direct live owners for composition validation.
 * @since 0.1.0
 * @category models
 */
export class ComposeGraphOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields> extends Data.Class<{
  readonly name: string
  readonly signature: Signature<I, O>
  readonly subModules: ComposeSubModules
}> {}

/**
 * Validates all declarations and owner identities, then native Graph acyclicity.
 * Parameter state is never mutated while constructing or validating topology.
 * @since 0.1.0
 * @category constructors
 */
export const buildCompositionGraph = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  options: ComposeGraphOptions<I, O>
): Effect.Effect<CompositionGraph, CompositionError> =>
  Effect.gen(function*() {
    const rootId = yield* decodeModuleId(options.name)
    const directNodes = yield* Effect.forEach(
      Arr.sort(Record.toEntries(options.subModules), Order.tuple(Order.string, Order.empty<ComposableModule>())),
      ([, module]) => decodeModuleId(module.name).pipe(Effect.map((moduleId) => buildSubModuleNode(module, moduleId)))
    )
    yield* Effect.forEach(directNodes, (node) => validateNode(rootId, node), { discard: true })
    const subModuleNodesById = yield* Effect.reduce(directNodes, HashMap.empty<ModuleId, ModuleNode>(), registerOwner)
    const live = moduleNodeGraph(Arr.sort(directNodes, nodeOrder))
    const nodes = Arr.fromIterable(Graph.values(Graph.nodes(live)))
    const declarations = Arr.fromIterable(Graph.values(Graph.edges(live)))

    yield* Effect.forEach(directNodes, (node) =>
      Effect.gen(function*() {
        const index = yield* Graph.findNode(live, (existing) => ownerIdentity(existing.params, node.params)).pipe(
          Effect.orDie
        )
        const canonical = yield* Graph.getNode(live, index).pipe(Effect.orDie)
        yield* validateProjection(canonical, node)
      }), { discard: true })
    yield* Effect.forEach(declarations, (edge) =>
      Effect.gen(function*() {
        yield* validateNode(rootId, edge.data.child)
        yield* validateDeclaredId(edge.data.child.name, edge.data.declaredId, edge.data.child.moduleId)
        const canonical = yield* Graph.getNode(live, edge.target).pipe(Effect.orDie)
        yield* validateProjection(canonical, edge.data.child)
      }), { discard: true })
    yield* Effect.reduce(nodes, subModuleNodesById, registerOwner)
    yield* Effect.if(Graph.isAcyclic(live), {
      onTrue: () => Effect.void,
      onFalse: () => Effect.fail(new CompositionError({ message: "Composition cycle detected", moduleName: rootId }))
    })

    const rootChildIds = Arr.sort(Arr.fromIterable(HashMap.keys(subModuleNodesById)), Order.string)
    const graphNodes = Arr.map(Arr.fromIterable(Graph.entries(Graph.nodes(live))), ([index, node]) =>
      new ModuleGraphNode({
        moduleId: node.moduleId,
        signature: node.signature,
        subModuleIds: Arr.filterMap(Graph.successors(live, index), (child) =>
          Option.map(Graph.getNode(live, child), (value) =>
            value.moduleId))
      }))
    const rootNode = new ModuleGraphNode({
      moduleId: rootId,
      signature: makeModuleNodeSignature(options.signature.description, options.signature.instructions),
      subModuleIds: rootChildIds
    })
    const allNodes = Arr.prepend(graphNodes, rootNode)
    const graph = makeModuleGraph({
      rootId,
      nodes: allNodes,
      edges: Arr.dedupe(Arr.flatMap(allNodes, (node) =>
        Arr.map(node.subModuleIds, (childId) =>
          new ModuleGraphEdge({ parentId: node.moduleId, childId }))))
    })
    return new CompositionGraph({ rootId, rootChildIds, graph, subModuleNodesById })
  })

/**
 * Returns the validated ownership graph without allocating root parameters.
 * @since 0.1.0
 * @category constructors
 */
export const composeGraph = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  options: ComposeGraphOptions<I, O>
): Effect.Effect<ModuleGraph, CompositionError> =>
  buildCompositionGraph(options).pipe(Effect.map((result) => result.graph))
