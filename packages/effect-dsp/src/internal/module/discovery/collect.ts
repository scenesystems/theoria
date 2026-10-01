/**
 * Discovery collection combinators.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Equal, HashMap, Option, SynchronizedRef } from "effect"
import { CompositionError } from "../../../DspError.js"
import type { Id, Registration } from "../../../Module.js"
import {
  Edge as ModuleGraphEdge,
  make as makeModuleGraph,
  type ModuleGraph,
  Node as ModuleGraphNode
} from "../../../ModuleGraph.js"
import { ModuleRegistryRef, registrySnapshot } from "./registry.js"

const hasRootRegistration = (
  rootId: Id,
  registrations: Iterable<Registration>
): boolean => Arr.some(Arr.fromIterable(registrations), (registration) => Equal.equals(registration.id, rootId))

const registrationNode = (registration: Registration): ModuleGraphNode =>
  new ModuleGraphNode({
    moduleId: registration.id,
    signature: registration.signature,
    subModuleIds: registration.subModuleIds
  })

const registrationEdges = (
  registration: Registration
): ModuleGraph["edges"] =>
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
  rootId: Id,
  registrations: Iterable<Registration>
): Effect.Effect<ModuleGraph, CompositionError> =>
  Effect.suspend(() => {
    const snapshot = Arr.fromIterable(registrations)
    return Effect.if(hasRootRegistration(rootId, snapshot), {
      onTrue: () =>
        Effect.sync(() =>
          makeModuleGraph({
            rootId,
            nodes: Arr.map(snapshot, registrationNode),
            edges: Arr.flatMap(snapshot, registrationEdges)
          })
        ),
      onFalse: () =>
        Effect.fail(
          new CompositionError({
            message: Arr.join(
              Arr.make("Discovery root '", rootId, "' was not observed in registry snapshot"),
              ""
            ),
            moduleName: rootId
          })
        )
    })
  })

/**
 * Runs a program and returns registrations written to its local registry.
 *
 * @remarks
 * The program's successful value is discarded. Failure, defects, and
 * interruption propagate without a snapshot. A fresh synchronized collector
 * is shared by fibers forked inside this scope, and the previous collector is
 * restored when the scope ends. The final snapshot observes registrations
 * completed before the awaited program completes.
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
) => withDiscoveryScope(program.pipe(Effect.zipRight(registrySnapshot)))

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
  rootId: Id,
  program: Effect.Effect<A, E, R>
) =>
  discoverModules(program).pipe(
    Effect.flatMap((registrations) => registrationsToModuleGraph(rootId, registrations))
  )

/**
 * Isolates registry writes while preserving the program result.
 *
 * @remarks
 * Use this when nested execution should not add registrations to an enclosing
 * discovery scope. The fresh synchronized collector is shared by fibers forked
 * by the program. Program failures and requirements are unchanged, and the
 * enclosing collector is restored after success, failure, or interruption.
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
  Effect.flatMap(
    SynchronizedRef.make(HashMap.empty<Id, Registration>()),
    (collector) =>
      program.pipe(
        Effect.locally(ModuleRegistryRef, Option.some(collector))
      )
  )
