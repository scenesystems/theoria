/**
 * Discovery collection combinators.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Option } from "effect"
import type { ModuleGraph } from "../../contracts/ModuleGraph.js"
import { makeModuleGraph, ModuleGraphEdge, ModuleGraphNode } from "../../contracts/ModuleGraph.js"
import type { ModuleId } from "../../contracts/ModuleId.js"
import { CompositionError } from "../../Errors/module.js"
import { canonicalModuleRegistrations, type ModuleRegistration } from "./model.js"
import { ModuleRegistryRef, registrySnapshot } from "./registry.js"

const hasRootRegistration = (
  rootId: ModuleId,
  registrations: ReadonlyArray<ModuleRegistration>
): boolean => Option.isSome(Arr.findFirst(registrations, (registration) => registration.id === rootId))

const registrationNode = (registration: ModuleRegistration): ModuleGraphNode =>
  new ModuleGraphNode({
    moduleId: registration.id,
    signature: registration.signature,
    subModuleIds: registration.subModuleIds
  })

const registrationEdges = (
  registration: ModuleRegistration
): ReadonlyArray<ModuleGraphEdge> =>
  Arr.map(
    registration.subModuleIds,
    (subModuleId) =>
      new ModuleGraphEdge({
        parentId: registration.id,
        childId: subModuleId
      })
  )

/**
 * Projects registration metadata into a module graph rooted at an observed id.
 *
 * @remarks
 * Registrations become nodes in their input order, and each declared child id
 * becomes an edge. The operation checks only that `rootId` is present. It does
 * not verify child endpoints, cycles, duplicate ids, or reachability.
 *
 * @param rootId - Identity that must occur in `registrations`.
 * @param registrations - Registration snapshot used as graph source data.
 * @returns A graph containing all supplied nodes and their declared edges.
 *
 * @since 0.1.0
 * @category combinators
 */
export const registrationsToModuleGraph = (
  rootId: ModuleId,
  registrations: ReadonlyArray<ModuleRegistration>
): Effect.Effect<ModuleGraph, CompositionError> =>
  hasRootRegistration(rootId, registrations)
    ? Effect.succeed(
      makeModuleGraph({
        rootId,
        nodes: Arr.map(registrations, registrationNode),
        edges: Arr.flatMap(registrations, registrationEdges)
      })
    )
    : Effect.fail(
      new CompositionError({
        message: `Discovery root '${rootId}' was not observed in registry snapshot`,
        moduleName: rootId
      })
    )

/**
 * Runs a program and returns registrations written to its local registry.
 *
 * @remarks
 * The program's successful value is discarded. Failure, defects, and
 * interruption propagate without a snapshot. The previous registry value is
 * restored when the scope ends. Registrations made by detached child fibers do
 * not join back into the parent FiberRef.
 *
 * @typeParam A - Successful program value, discarded after execution.
 * @typeParam E - Program failure preserved by discovery.
 * @typeParam R - Services required by the program.
 * @param program - Effect whose module executions should be observed.
 * @returns The successful scope's registrations sorted by module identity.
 *
 * @since 0.1.0
 * @category combinators
 */
export const discoverModules = <A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<ReadonlyArray<ModuleRegistration>, E, R> =>
  Effect.gen(function*() {
    yield* program
    return yield* registrySnapshot
  }).pipe(
    Effect.locally(ModuleRegistryRef, Arr.empty<ModuleRegistration>()),
    Effect.map(canonicalModuleRegistrations)
  )

/**
 * Runs a program and projects its registrations into a module graph.
 *
 * @remarks
 * The program must register `rootId`; otherwise the resulting
 * `CompositionError` identifies the missing root. Other graph invariants are
 * not validated by this projection.
 *
 * @typeParam A - Successful program value, discarded after execution.
 * @typeParam E - Program failure preserved in the result channel.
 * @typeParam R - Services required by the program.
 * @param rootId - Registration to use as `ModuleGraph.rootId`.
 * @param program - Effect whose module executions should be observed.
 * @returns A graph of the registrations present after successful execution.
 *
 * @since 0.1.0
 * @category combinators
 */
export const discoverModuleGraph = <A, E, R>(
  rootId: ModuleId,
  program: Effect.Effect<A, E, R>
): Effect.Effect<ModuleGraph, E | CompositionError, R> =>
  discoverModules(program).pipe(
    Effect.flatMap((registrations) => registrationsToModuleGraph(rootId, registrations))
  )

/**
 * Isolates registry writes while preserving the program result.
 *
 * @remarks
 * Use this when nested execution should not add registrations to an enclosing
 * discovery scope. Program failures and requirements are unchanged.
 *
 * @typeParam A - Successful value returned unchanged.
 * @typeParam E - Failure returned unchanged.
 * @typeParam R - Service requirements returned unchanged.
 * @param program - Effect to execute with an initially empty registry.
 * @returns The original successful value after the local scope is restored.
 *
 * @since 0.1.0
 * @category combinators
 */
export const withDiscoveryScope = <A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  program.pipe(
    Effect.locally(ModuleRegistryRef, Arr.empty<ModuleRegistration>())
  )
