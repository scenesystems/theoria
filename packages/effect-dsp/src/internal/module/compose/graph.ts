/**
 * Composition graph construction and validation.
 *
 * @since 0.1.0
 */
import {
  Array as Arr,
  Boolean,
  Data,
  Effect,
  Equivalence,
  Graph,
  HashMap,
  Option,
  Order,
  Record,
  Schema,
  Tuple
} from "effect"
import type { Ref } from "effect"
import type { Codec } from "../../../Demonstration.js"
import { CompositionError } from "../../../DspError.js"
import { type ComposableModule, type ComposeGraphOptions, Id, Structure, structure } from "../../../Module.js"
import {
  Edge as ModuleGraphEdge,
  make as makeModuleGraph,
  type ModuleGraph,
  Node as ModuleGraphNode
} from "../../../ModuleGraph.js"
import type { ModuleParameters } from "../../../ModuleParameters.js"
import { Text } from "../../../Signature.js"

const predictorIdentity = Equivalence.strictEqual<Ref.Ref<ModuleParameters>>()
const contractIdentity = Equivalence.strictEqual<Codec>()
const metadataEquivalent = (left: Text, right: Text): boolean => Schema.toEquivalence(Text)(left, right)
const declarationEquivalence = Equivalence.make<ReadonlyArray<readonly [Id, Structure]>>((left, right) =>
  Arr.length(left) === Arr.length(right) &&
  Arr.every(
    Arr.zip(left, right),
    ([[leftId, leftModule], [rightId, rightModule]]) =>
      Equivalence.String(leftId, rightId) &&
      Equivalence.String(leftModule.id, rightModule.id) &&
      Equivalence.String(leftModule.name, rightModule.name) &&
      predictorIdentity(leftModule.parameters, rightModule.parameters)
  )
)
const moduleOrder: Order.Order<Structure> = Order.mapInput(Order.String, (module) => module.id)
const declarationOrder = Order.make<readonly [Id, Structure]>(([left], [right]) => Order.String(left, right))

const sortedDeclarations = (module: Structure) => Arr.sort(HashMap.toEntries(module.subModules), declarationOrder)

const decodeModuleId = (moduleName: string): Effect.Effect<Id, CompositionError> =>
  Schema.decodeEffect(Id)(moduleName).pipe(
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

const validateDeclaredId = (moduleName: string, declaredId: Id, actualId: Id) =>
  Boolean.match(Equivalence.String(declaredId, actualId), {
    onTrue: () => Effect.void,
    onFalse: () =>
      Effect.fail(
        new CompositionError({
          message: Arr.join(
            Arr.make(
              "Sub-module '",
              moduleName,
              "' declares child id '",
              declaredId,
              "' but child module resolves to '",
              actualId,
              "'"
            ),
            ""
          ),
          moduleName
        })
      )
  })

const validateModule = (rootId: Id, module: Structure) =>
  Effect.gen(function*() {
    const actualId = yield* decodeModuleId(module.name)
    yield* validateDeclaredId(module.name, module.id, actualId)
    yield* Boolean.match(Equivalence.String(actualId, rootId), {
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

const projectionError = (module: Structure, detail: string): CompositionError =>
  new CompositionError({
    message: Arr.join(Arr.make("Module '", module.id, "' has inconsistent ", detail), ""),
    moduleName: module.id
  })

// Compare immediate declarations, not recursive wrapper equality. Every wrapper
// is checked through its direct alias or retained native graph edge, including
// alternate projections of a shared child. The first retained projection is
// therefore sufficient for later parameter traversal without dropping predictors.
const validateProjection = (canonical: Structure, module: Structure) =>
  Effect.gen(function*() {
    yield* validateDeclaredId(module.name, module.id, canonical.id)
    yield* Boolean.match(metadataEquivalent(canonical.signature, module.signature), {
      onTrue: () => Effect.void,
      onFalse: () => Effect.fail(projectionError(module, "signature metadata"))
    })
    yield* Boolean.match(contractIdentity(canonical.demonstrationCodec, module.demonstrationCodec), {
      onTrue: () => Effect.void,
      onFalse: () => Effect.fail(projectionError(module, "demonstration contract"))
    })
    yield* Boolean.match(declarationEquivalence(sortedDeclarations(canonical), sortedDeclarations(module)), {
      onTrue: () => Effect.void,
      onFalse: () => Effect.fail(projectionError(module, "child declarations"))
    })
  })

const registerModule = (modules: HashMap.HashMap<Id, Structure>, module: Structure) =>
  Option.match(HashMap.get(modules, module.id), {
    onNone: () => Effect.succeed(HashMap.set(modules, module.id, module)),
    onSome: (existing) =>
      Boolean.match(predictorIdentity(existing.parameters, module.parameters), {
        onTrue: () => Effect.succeed(modules),
        onFalse: () => Effect.fail(duplicateIdError(module.id))
      })
  })

/**
 * Validated graph and direct sub-modules for composed execution.
 * @since 0.1.0
 * @category models
 */
export class CompositionGraph extends Data.Class<{
  readonly rootId: Id
  readonly rootChildIds: ModuleGraphNode["subModuleIds"]
  readonly graph: ModuleGraph
  readonly subModulesById: HashMap.HashMap<Id, Structure>
  readonly declarations: Record.ReadonlyRecord<string, Structure>
}> {}

const buildSubModule = (module: ComposableModule, id: Id): Structure =>
  new Structure({
    id,
    name: module.name,
    signature: new Text({
      description: module.signature.description,
      instructions: module.signature.instructions
    }),
    signatureDigest: module.signature.digest,
    demonstrationCodec: module.signature.demonstrationCodec,
    parameters: module.parameters,
    subModules: module.subModules,
    declarations: Option.getOrElse(
      Option.fromUndefinedOr(module.declarations),
      () => Record.fromEntries(HashMap.toEntries(module.subModules))
    ),
    frozen: Option.getOrElse(Option.fromUndefinedOr(module.frozen), () => false),
    boundParameters: Option.getOrElse(Option.fromUndefinedOr(module.boundParameters), () => ({}))
  })

/**
 * Validates all declarations and predictor identities, then native Graph acyclicity.
 * Parameter state is never mutated while constructing or validating topology.
 * @since 0.1.0
 * @category constructors
 */
export const buildCompositionGraph = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  options: ComposeGraphOptions<I, O>
): Effect.Effect<CompositionGraph, CompositionError> =>
  Effect.gen(function*() {
    const rootId = yield* decodeModuleId(options.name)
    const directModules = yield* Effect.forEach(
      Arr.sort(
        Record.toEntries(options.subModules),
        Order.make<readonly [string, ComposableModule]>(([left], [right]) => Order.String(left, right))
      ),
      ([, module]) => decodeModuleId(module.name).pipe(Effect.map((moduleId) => buildSubModule(module, moduleId)))
    )
    yield* Effect.forEach(directModules, (module) => validateModule(rootId, module), { discard: true })
    const subModulesById = yield* Effect.reduce(directModules, () => HashMap.empty<Id, Structure>(), registerModule)
    const program = structure(Arr.sort(directModules, moduleOrder))
    const modules = Arr.fromIterable(Graph.values(Graph.nodes(program)))
    const declarations = Arr.fromIterable(Graph.values(Graph.edges(program)))

    yield* Effect.forEach(directModules, (module) =>
      Effect.gen(function*() {
        const index = Option.getOrThrow(
          Graph.findNode(program, (existing) => predictorIdentity(existing.parameters, module.parameters))
        )
        const canonical = Option.getOrThrow(Graph.getNode(program, index))
        yield* validateProjection(canonical, module)
      }), { discard: true })
    yield* Effect.forEach(declarations, (edge) =>
      Effect.gen(function*() {
        yield* validateModule(rootId, edge.data.module)
        yield* validateDeclaredId(edge.data.module.name, edge.data.name, edge.data.module.id)
        const canonical = Option.getOrThrow(Graph.getNode(program, edge.target))
        yield* validateProjection(canonical, edge.data.module)
      }), { discard: true })
    yield* Effect.reduce(modules, () => subModulesById, registerModule)
    yield* Boolean.match(Graph.isAcyclic(program), {
      onTrue: () => Effect.void,
      onFalse: () => Effect.fail(new CompositionError({ message: "Composition cycle detected", moduleName: rootId }))
    })

    const rootChildIds = Arr.sort(Arr.fromIterable(HashMap.keys(subModulesById)), Order.String)
    const graphNodes = Arr.map(Arr.fromIterable(Graph.entries(Graph.nodes(program))), ([index, module]) =>
      new ModuleGraphNode({
        moduleId: module.id,
        signature: module.signature,
        subModuleIds: Arr.flatMap(Graph.successors(program, index), (child) =>
          Option.toArray(Option.map(Graph.getNode(program, child), (value) =>
            value.id)))
      }))
    const rootNode = new ModuleGraphNode({
      moduleId: rootId,
      signature: new Text({
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
    return new CompositionGraph({
      rootId,
      rootChildIds,
      graph,
      subModulesById,
      declarations: Record.fromEntries(
        Arr.map(Record.toEntries(options.subModules), ([alias, module]) =>
          Tuple.make(alias, buildSubModule(module, Schema.decodeSync(Id)(module.name))))
      )
    })
  })

/**
 * Returns the validated composition graph without allocating root parameters.
 * @since 0.1.0
 * @category constructors
 */
export const composeGraph = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  options: ComposeGraphOptions<I, O>
): Effect.Effect<ModuleGraph, CompositionError> =>
  buildCompositionGraph(options).pipe(Effect.map((result) => result.graph))
