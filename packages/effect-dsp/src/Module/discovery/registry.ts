/**
 * Discovery registry FiberRef lifecycle and canonical dedupe logic.
 *
 * @since 0.1.0
 */
import type { Ref } from "effect"
import { Array as Arr, Boolean, Data, Effect, Equal, Equivalence, FiberRef, HashMap, Option, Schema } from "effect"
import type { ModuleGraphNode } from "../../contracts/ModuleGraph.js"
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
export const ModuleRegistryRef: FiberRef.FiberRef<
  HashMap.HashMap<ModuleId, ModuleRegistration>
> = FiberRef.unsafeMake(HashMap.empty())

const decodeModuleId = (moduleName: string): Effect.Effect<ModuleId, CompositionError> =>
  Schema.decodeUnknown(ModuleId)(moduleName).pipe(
    Effect.mapError(() =>
      new CompositionError({
        message: Arr.join(
          Arr.make("Invalid module id '", moduleName, "' for discovery registration"),
          ""
        ),
        moduleName
      })
    )
  )

const signaturesMatch = (
  left: RegisteredSignature,
  right: RegisteredSignature
): boolean => Equal.equals(left, right)

const moduleIdEquivalence: Equivalence.Equivalence<ModuleId> = Equivalence.string

const moduleIdListEquivalence = Arr.getEquivalence(moduleIdEquivalence)

const paramsIdentity = Equivalence.strict<Ref.Ref<ModuleParams>>()

const sameSubModuleIds = (
  left: ModuleGraphNode["subModuleIds"],
  right: ModuleGraphNode["subModuleIds"]
): boolean => moduleIdListEquivalence(left, right)

const sameRegistration = (
  left: ModuleRegistration,
  right: ModuleRegistration
): boolean =>
  Boolean.every(Arr.make(
    paramsIdentity(left.params, right.params),
    signaturesMatch(left.signature, right.signature),
    sameSubModuleIds(left.subModuleIds, right.subModuleIds)
  ))

const registerConflict = (
  left: ModuleRegistration,
  right: ModuleRegistration
): CompositionError =>
  new CompositionError({
    message: Arr.join(Arr.make("Discovery registration conflict for module id '", left.id, "'"), ""),
    moduleName: right.id
  })

const mergeRegistration = (
  registrations: HashMap.HashMap<ModuleId, ModuleRegistration>,
  registration: ModuleRegistration
): Effect.Effect<HashMap.HashMap<ModuleId, ModuleRegistration>, CompositionError> =>
  Option.match(
    HashMap.get(registrations, registration.id),
    {
      onNone: () => Effect.succeed(HashMap.set(registrations, registration.id, registration)),
      onSome: (existing) =>
        Boolean.match(sameRegistration(existing, registration), {
          onTrue: () => Effect.succeed(registrations),
          onFalse: () => Effect.fail(registerConflict(existing, registration))
        })
    }
  )

const moduleSubModuleIds = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E,
  R
>(module: Module<I, O, E, R>): ModuleGraphNode["subModuleIds"] =>
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

    return yield* FiberRef.set(ModuleRegistryRef, merged)
  })

/**
 * Carries runtime identity and live module metadata into discovery registration.
 *
 * @since 0.1.0
 * @category models
 */
export class RuntimeRegistrationOptions extends Data.Class<{
  /** Untrusted identity decoded with the public `ModuleId` schema. */
  readonly moduleName: string
  /** Live parameter ref retained in the registration. */
  readonly params: Ref.Ref<ModuleParams>
  /** Signature description and instructions retained for graph projection. */
  readonly signature: RegisteredSignature
  /** Direct children; omission records no children. */
  readonly subModuleIds?: ModuleGraphNode["subModuleIds"]
}> {}

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
export const registerRuntime = (options: RuntimeRegistrationOptions): Effect.Effect<void, CompositionError> =>
  Effect.gen(function*() {
    const moduleId = yield* decodeModuleId(options.moduleName)
    const subModuleIds = Option.getOrElse(
      Option.fromNullable(options.subModuleIds),
      () => Arr.empty<ModuleId>()
    )

    return yield* register(
      new ModuleRegistration({
        id: moduleId,
        params: options.params,
        signature: options.signature,
        subModuleIds: canonicalSubModuleIds(subModuleIds)
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
export const registerModule = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  E,
  R
>(module: Module<I, O, E, R>): Effect.Effect<void, CompositionError> =>
  registerRuntime(
    new RuntimeRegistrationOptions({
      moduleName: module.name,
      params: module.params,
      signature: makeModuleNodeSignature(
        module.signature.description,
        module.signature.instructions
      ),
      subModuleIds: moduleSubModuleIds(module)
    })
  )

/**
 * Reads the current registry as new, identity-sorted registration values.
 *
 * @remarks
 * The contained parameter refs remain live and retain their original identity.
 *
 * @since 0.1.0
 * @category combinators
 */
export const registrySnapshot = FiberRef.get(ModuleRegistryRef).pipe(
  Effect.map(HashMap.values),
  Effect.map(canonicalModuleRegistrations)
)
