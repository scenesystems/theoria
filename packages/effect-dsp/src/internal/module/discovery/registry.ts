/**
 * Discovery registry FiberRef lifecycle and canonical dedupe logic.
 *
 * @since 0.1.0
 */
import type { Ref } from "effect"
import {
  Array as Arr,
  Boolean,
  Data,
  Effect,
  Equal,
  Equivalence,
  FiberRef,
  HashMap,
  Option,
  Schema,
  SynchronizedRef
} from "effect"
import { CompositionError } from "../../../DspError.js"
import { Id, type Module, NodeSignature, Registration } from "../../../Module.js"
import type { Node as ModuleGraphNode } from "../../../ModuleGraph.js"
import type { ModuleParameters } from "../../../ModuleParameters.js"
import { canonicalModuleRegistrations, canonicalSubModuleIds } from "./normalization.js"

/**
 * Stores the optional shared collector for the current discovery lineage.
 *
 * @remarks
 * The default is `None`, so no mutable collector is global. Registration
 * outside an explicit discovery scope lazily installs a collector in the
 * current fiber; children forked afterward share it. {@link discoverModules},
 * {@link discoverModuleGraph}, and {@link withDiscoveryScope} each install a
 * fresh `Some<SynchronizedRef<HashMap<...>>>`, which is the concurrent
 * discovery boundary and is restored when that scope ends.
 *
 * @since 0.1.0
 * @category refs
 */
export const ModuleRegistryRef: FiberRef.FiberRef<
  Option.Option<SynchronizedRef.SynchronizedRef<HashMap.HashMap<Id, Registration>>>
> = FiberRef.unsafeMake(Option.none())

const decodeModuleId = (moduleName: string): Effect.Effect<Id, CompositionError> =>
  Schema.decodeUnknown(Id)(moduleName).pipe(
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
  left: NodeSignature,
  right: NodeSignature
): boolean => Equal.equals(left, right)

const moduleIdEquivalence: Equivalence.Equivalence<Id> = Equivalence.string

const moduleIdListEquivalence = Arr.getEquivalence(moduleIdEquivalence)

const paramsIdentity = Equivalence.strict<Ref.Ref<ModuleParameters>>()

const sameSubModuleIds = (
  left: ModuleGraphNode["subModuleIds"],
  right: ModuleGraphNode["subModuleIds"]
): boolean => moduleIdListEquivalence(left, right)

const sameRegistration = (
  left: Registration,
  right: Registration
): boolean =>
  Boolean.every(Arr.make(
    paramsIdentity(left.params, right.params),
    signaturesMatch(left.signature, right.signature),
    sameSubModuleIds(left.subModuleIds, right.subModuleIds)
  ))

const registerConflict = (
  left: Registration,
  right: Registration
): CompositionError =>
  new CompositionError({
    message: Arr.join(Arr.make("Discovery registration conflict for module id '", left.id, "'"), ""),
    moduleName: right.id
  })

const mergeRegistration = (
  registrations: HashMap.HashMap<Id, Registration>,
  registration: Registration
): Effect.Effect<HashMap.HashMap<Id, Registration>, CompositionError> =>
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
  registration: Registration
): Effect.Effect<void, CompositionError> =>
  Effect.gen(function*() {
    const current = yield* FiberRef.get(ModuleRegistryRef)
    const collector = yield* Option.match(current, {
      onNone: () =>
        Effect.gen(function*() {
          const initialized = yield* SynchronizedRef.make(
            HashMap.empty<Id, Registration>()
          )
          yield* FiberRef.set(ModuleRegistryRef, Option.some(initialized))

          return initialized
        }),
      onSome: Effect.succeed
    })

    return yield* SynchronizedRef.updateEffect(
      collector,
      (registrations) => mergeRegistration(registrations, registration)
    )
  })

/**
 * Carries runtime identity and live module metadata into discovery registration.
 *
 * @since 0.1.0
 * @category models
 */
export class RuntimeRegistrationOptions extends Data.Class<{
  /** Untrusted identity decoded with the public `Module.Id` schema. */
  readonly moduleName: string
  /** Live parameter ref retained in the registration. */
  readonly params: Ref.Ref<ModuleParameters>
  /** Signature description and instructions retained for graph projection. */
  readonly signature: NodeSignature
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
      () => Arr.empty<Id>()
    )

    return yield* register(
      new Registration({
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
      signature: new NodeSignature({
        description: module.signature.description,
        instructions: module.signature.instructions
      }),
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
  Effect.flatMap(Option.match({
    onNone: () => Effect.succeed(HashMap.empty<Id, Registration>()),
    onSome: SynchronizedRef.get
  })),
  Effect.map(HashMap.values),
  Effect.map(canonicalModuleRegistrations)
)
