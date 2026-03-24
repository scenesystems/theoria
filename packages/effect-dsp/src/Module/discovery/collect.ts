/**
 * Discovery collection combinators.
 *
 * @since 0.0.0
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
 * Convert a flat array of discovery registrations into a canonical module
 * graph. Fails if the root module id was not observed during execution.
 *
 * @since 0.0.0
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
 * Run a program in a fresh discovery scope and return all module
 * registrations observed during execution. The scope is automatically
 * isolated via `Effect.locally`.
 *
 * @since 0.0.0
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
 * Run a program and project the discovered registrations into a canonical
 * module graph rooted at the given id.
 *
 * @since 0.0.0
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
 * Execute a program in a fresh discovery scope, returning only the
 * program result while discarding registrations.
 *
 * @since 0.0.0
 * @category combinators
 */
export const withDiscoveryScope = <A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  program.pipe(
    Effect.locally(ModuleRegistryRef, Arr.empty<ModuleRegistration>())
  )
