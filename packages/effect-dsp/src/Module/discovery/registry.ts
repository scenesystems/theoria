/**
 * Discovery registry FiberRef lifecycle and canonical dedupe logic.
 *
 * @since 0.1.0
 */
import type { Ref } from "effect"
import { Array as Arr, Effect, FiberRef, HashMap, Option, Schema } from "effect"
import { ModuleId } from "../../contracts/ModuleId.js"
import { ModuleNodeSignature } from "../../contracts/ModuleNode.js"
import type { ModuleParams } from "../../contracts/ModuleParams.js"
import type { CompositionError } from "../../Errors/module.js"
import type { Module } from "../model.js"
import { DiscoveryFailure } from "./errors.js"
import {
  canonicalModuleRegistrations,
  canonicalSubModuleIds,
  ModuleRegistration,
  type RegisteredSignature
} from "./model.js"

/**
 * Fiber-local array of module registrations. Populated during execution
 * by `registerRuntime` and drained by discovery combinators. Scoped via
 * `Effect.locally` for isolation.
 *
 * @since 0.1.0
 * @category refs
 */
export const ModuleRegistryRef: FiberRef.FiberRef<ReadonlyArray<ModuleRegistration>> = FiberRef.unsafeMake<
  ReadonlyArray<ModuleRegistration>
>([])

const decodeModuleId = (moduleName: string): Effect.Effect<ModuleId, CompositionError> =>
  Schema.decodeUnknown(ModuleId)(moduleName).pipe(
    Effect.mapError(() => DiscoveryFailure.invalidModuleId(moduleName))
  )

const signaturesMatch = (
  left: RegisteredSignature,
  right: RegisteredSignature
): boolean =>
  left.description === right.description &&
  left.instructions === right.instructions

const sameSubModuleIds = (
  left: ReadonlyArray<ModuleId>,
  right: ReadonlyArray<ModuleId>
): boolean => left.length === right.length && left.every((moduleId, index) => moduleId === right[index])

const sameRegistration = (
  left: ModuleRegistration,
  right: ModuleRegistration
): boolean =>
  left.params === right.params &&
  signaturesMatch(left.signature, right.signature) &&
  sameSubModuleIds(left.subModuleIds, right.subModuleIds)

const mergeRegistration = (
  registrations: ReadonlyArray<ModuleRegistration>,
  registration: ModuleRegistration
): Effect.Effect<ReadonlyArray<ModuleRegistration>, CompositionError> =>
  Option.match(
    Arr.findFirst(registrations, (candidate) => candidate.id === registration.id),
    {
      onNone: () => Effect.succeed(Arr.append(registrations, registration)),
      onSome: (existing) =>
        sameRegistration(existing, registration)
          ? Effect.succeed(registrations)
          : Effect.fail(DiscoveryFailure.registrationConflict(existing.id))
    }
  )

const moduleSubModuleIds = (module: Module): ReadonlyArray<ModuleId> =>
  canonicalSubModuleIds(Arr.fromIterable(HashMap.keys(module.subModules)))

/**
 * Append a module registration to the fiber-local registry. Detects
 * conflicts when two different modules share the same id.
 *
 * @since 0.1.0
 * @category combinators
 */
export const register = (
  registration: ModuleRegistration
): Effect.Effect<void, CompositionError> =>
  Effect.gen(function*() {
    const existing = yield* FiberRef.get(ModuleRegistryRef)
    const merged = yield* mergeRegistration(existing, registration)

    return yield* FiberRef.set(ModuleRegistryRef, canonicalModuleRegistrations(merged))
  })

/**
 * Register module metadata from within a `forward` execution path.
 * Validates the module name as a `ModuleId` before appending.
 *
 * @since 0.1.0
 * @category combinators
 */
export const registerRuntime = (options: {
  readonly moduleName: string
  readonly params: Ref.Ref<ModuleParams>
  readonly signature: RegisteredSignature
  readonly subModuleIds?: ReadonlyArray<ModuleId>
}): Effect.Effect<void, CompositionError> =>
  Effect.gen(function*() {
    const moduleId = yield* decodeModuleId(options.moduleName)

    return yield* register(
      new ModuleRegistration({
        id: moduleId,
        params: options.params,
        signature: options.signature,
        subModuleIds: canonicalSubModuleIds(options.subModuleIds ?? Arr.empty<ModuleId>())
      })
    )
  })

/**
 * Register a fully constructed `Module` value for discovery.
 *
 * @since 0.1.0
 * @category combinators
 */
export const registerModule = (module: Module): Effect.Effect<void, CompositionError> =>
  registerRuntime({
    moduleName: module.name,
    params: module.params,
    signature: ModuleNodeSignature.make({
      description: module.signature.description,
      instructions: module.signature.instructions
    }),
    subModuleIds: moduleSubModuleIds(module)
  })

/**
 * Read and canonicalize the current registry state.
 *
 * @since 0.1.0
 * @category combinators
 */
export const registrySnapshot: Effect.Effect<ReadonlyArray<ModuleRegistration>> = FiberRef.get(ModuleRegistryRef).pipe(
  Effect.map(canonicalModuleRegistrations)
)
