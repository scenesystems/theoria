/**
 * Composition graph construction and validation.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Equivalence, Graph, HashMap, Option, Order, Record, Schema } from "effect"
import type { Ref } from "effect"
import type { Codec } from "../../../Demonstration.js"
import { CompositionError } from "../../../DspError.js"
import { type ComposableModule, type ComposeGraphOptions, Id, Node, nodeGraph, NodeSignature } from "../../../Module.js"
import {
  Edge as ModuleGraphEdge,
  make as makeModuleGraph,
  type ModuleGraph,
  Node as ModuleGraphNode
} from "../../../ModuleGraph.js"
import type { ModuleParameters } from "../../../ModuleParameters.js"

const ownerIdentity = Equivalence.strict<Ref.Ref<ModuleParameters>>()
const contractIdentity = Equivalence.strict<Codec>()
const metadataEquivalent = (left: NodeSignature, right: NodeSignature): boolean =>
  Schema.equivalence(NodeSignature)(left, right)
const declarationEquivalence = Equivalence.array(Equivalence.tuple(
  Equivalence.string,
  Equivalence.struct({ moduleId: Equivalence.string, name: Equivalence.string, params: ownerIdentity })
))
const nodeOrder: Order.Order<Node> = Order.mapInput(Order.string, (node) => node.moduleId)

const sortedDeclarations = (node: Node) =>
  Arr.sort(HashMap.toEntries(node.subModules), Order.tuple(Order.string, Order.empty<Node>()))

const decodeModuleId = (moduleName: string): Effect.Effect<Id, CompositionError> =>
  Schema.decodeUnknown(Id)(moduleName).pipe(
    Effect.mapError(() =>
      new CompositionError({
        message: Arr.join(Arr.make("Invalid module id '", moduleName, "' in composition"), ""),
        moduleName
      })
    )
  )

const duplicateIdError = (moduleId: Id): CompositionError =>
  new CompositionError({
    message: Arr.join(
      Arr.make("Multiple module instances share id '", moduleId, "' in the same composition graph"),
      ""
    ),
    moduleName: moduleId
  })

const validateDeclaredId = (ownerName: string, declaredId: Id, actualId: Id) =>
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

const validateNode = (rootId: Id, node: Node) =>
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

const projectionError = (node: Node, detail: string): CompositionError =>
  new CompositionError({
    message: Arr.join(Arr.make("Module owner '", node.moduleId, "' has inconsistent ", detail), ""),
    moduleName: node.moduleId
  })

// Compare immediate declarations, not recursive wrapper equality. Every wrapper
// is checked through its direct alias or retained native graph edge, including
// alternate projections of a shared child. The first retained projection is
// therefore sufficient for later parameter traversal without dropping owners.
const validateProjection = (canonical: Node, node: Node) =>
  Effect.gen(function*() {
    yield* validateDeclaredId(node.name, node.moduleId, canonical.moduleId)
    yield* Effect.if(metadataEquivalent(canonical.signature, node.signature), {
      onTrue: () => Effect.void,
      onFalse: () => Effect.fail(projectionError(node, "signature metadata"))
    })
    yield* Effect.if(contractIdentity(canonical.demonstrationCodec, node.demonstrationCodec), {
      onTrue: () => Effect.void,
      onFalse: () => Effect.fail(projectionError(node, "demonstration contract"))
    })
    yield* Effect.if(declarationEquivalence(sortedDeclarations(canonical), sortedDeclarations(node)), {
      onTrue: () => Effect.void,
      onFalse: () => Effect.fail(projectionError(node, "child declarations"))
    })
  })

const registerOwner = (owners: HashMap.HashMap<Id, Node>, node: Node) =>
  Option.match(HashMap.get(owners, node.moduleId), {
    onNone: () => Effect.succeed(HashMap.set(owners, node.moduleId, node)),
    onSome: (existing) =>
      Effect.if(ownerIdentity(existing.params, node.params), {
        onTrue: () => Effect.succeed(owners),
        onFalse: () => Effect.fail(duplicateIdError(node.moduleId))
      })
  })

/**
 * Validated graph and live direct children for composed execution.
 * @since 0.1.0
 * @category models
 */
export class CompositionGraph extends Data.Class<{
  readonly rootId: Id
  readonly rootChildIds: ModuleGraphNode["subModuleIds"]
  readonly graph: ModuleGraph
  readonly subModuleNodesById: HashMap.HashMap<Id, Node>
}> {}

const buildSubModuleNode = (module: ComposableModule, moduleId: Id): Node =>
  new Node({
    moduleId,
    name: module.name,
    signature: new NodeSignature({
      description: module.signature.description,
      instructions: module.signature.instructions
    }),
    demonstrationCodec: module.signature.demonstrationCodec,
    params: module.params,
    subModules: module.subModules
  })

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
    const subModuleNodesById = yield* Effect.reduce(directNodes, HashMap.empty<Id, Node>(), registerOwner)
    const live = nodeGraph(Arr.sort(directNodes, nodeOrder))
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
      signature: new NodeSignature({
        description: options.signature.description,
        instructions: options.signature.instructions
      }),
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
