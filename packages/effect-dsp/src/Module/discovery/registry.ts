/**
 * Discovery registry FiberRef lifecycle and canonical dedupe logic.
 *
 * @since 0.1.0
 */
import type { Ref } from "effect"
import { Array as Arr, Effect, FiberRef, HashMap, Option, Schema } from "effect"
import { ModuleId } from "../../contracts/ModuleId.js"
import { makeModuleNodeSignature } from "../../contracts/ModuleNode.js"
import type { ModuleParams } from "../../contracts/ModuleParams.js"
import { CompositionError } from "../../Errors/module.js"
import type { Module } from "../model.js"
import {
  canonicalModuleRegistrations,
  canonicalSubModuleIds,
  ModuleRegistration,
  type RegisteredSignature
} from "./model.js"

/**
 * Stores discovery registrations in the current FiberRef lineage.
 *
 * @remarks
 * The default value is empty. Prefer {@link discoverModules},
 * {@link discoverModuleGraph}, or {@link withDiscoveryScope} over changing this
 * ref directly because those combinators restore the enclosing value.
 *
 * @since 0.1.0
 * @category refs
 */
export const ModuleRegistryRef: FiberRef.FiberRef<ReadonlyArray<ModuleRegistration>> = FiberRef.unsafeMake<
  ReadonlyArray<ModuleRegistration>
>([])

const decodeModuleId = (moduleName: string): Effect.Effect<ModuleId, CompositionError> =>
  Schema.decodeUnknown(ModuleId)(moduleName).pipe(
    Effect.mapError(() =>
      new CompositionError({
        message: `Invalid module id '${moduleName}' for discovery registration`,
        moduleName
      })
    )
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

const registerConflict = (
  left: ModuleRegistration,
  right: ModuleRegistration
): CompositionError =>
  new CompositionError({
    message: `Discovery registration conflict for module id '${left.id}'`,
    moduleName: right.id
  })

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
          : Effect.fail(registerConflict(existing, registration))
    }
  )

const moduleSubModuleIds = (module: Module): ReadonlyArray<ModuleId> =>
  canonicalSubModuleIds(Arr.fromIterable(HashMap.keys(module.subModules)))

/**
 * Adds a registration or verifies an identical registration already exists.
 *
 * @remarks
 * Re-registering an id succeeds only when the parameter ref has the same
 * identity, the signature strings match, and the canonical child ids match. A
 * mismatch fails with `CompositionError` and leaves the registry unchanged.
 *
 * @param registration - Validated registration to merge into the current fiber.
 * @returns Completion after the registry contains the canonical entry.
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
 * Validates a module name and records runtime discovery metadata.
 *
 * @remarks
 * Missing `subModuleIds` becomes an empty array. An invalid name or a conflict
 * with an existing registration fails with `CompositionError` before any model
 * operation that follows this effect.
 *
 * @param options - Runtime identity, live parameters, prompt metadata, and children.
 * @returns Completion after the registration is visible in the current fiber.
 *
 * @since 0.1.0
 * @category combinators
 */
export const registerRuntime = (options: {
  /** Untrusted identity decoded with the public `ModuleId` schema. */
  readonly moduleName: string
  /** Live parameter ref retained in the registration. */
  readonly params: Ref.Ref<ModuleParams>
  /** Signature description and instructions retained for graph projection. */
  readonly signature: RegisteredSignature
  /** Direct children; omission records no children. */
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
 * Records a module and the identities of its direct child nodes.
 *
 * @param module - Module whose live parameter and prompt metadata are retained.
 * @returns Completion after validation and conflict checking.
 *
 * @since 0.1.0
 * @category combinators
 */
export const registerModule = (module: Module): Effect.Effect<void, CompositionError> =>
  registerRuntime({
    moduleName: module.name,
    params: module.params,
    signature: makeModuleNodeSignature(
      module.signature.description,
      module.signature.instructions
    ),
    subModuleIds: moduleSubModuleIds(module)
  })

/**
 * Reads the current registry as new, identity-sorted registration values.
 *
 * @remarks
 * The contained parameter refs remain live and retain their original identity.
 *
 * @since 0.1.0
 * @category combinators
 */
export const registrySnapshot: Effect.Effect<ReadonlyArray<ModuleRegistration>> = FiberRef.get(ModuleRegistryRef).pipe(
  Effect.map(canonicalModuleRegistrations)
)
