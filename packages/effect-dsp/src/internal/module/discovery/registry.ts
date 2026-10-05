/**
 * Discovery registry FiberRef lifecycle and canonical dedupe logic.
 *
 * @since 0.1.0
 */
import type { Ref } from "effect"
import {
  Array as Arr,
  Boolean,
  Context,
  Data,
  Effect,
  Equal,
  Equivalence,
  HashMap,
  Option,
  Schema,
  SynchronizedRef
} from "effect"
import { CompositionError } from "../../../DspError.js"
import { Discovered, Id, type Module } from "../../../Module.js"
import type { Node as ModuleGraphNode } from "../../../ModuleGraph.js"
import type { ModuleParameters } from "../../../ModuleParameters.js"
import { Text } from "../../../Signature.js"
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
export const ModuleRegistryRef = Context.Reference<
  Option.Option<SynchronizedRef.SynchronizedRef<HashMap.HashMap<Id, Discovered>>>
>("@scenesystems/effect-dsp/internal/module/discovery/ModuleRegistryRef", {
  defaultValue: Option.none
})

const decodeModuleId = (moduleName: string): Effect.Effect<Id, CompositionError> =>
  Schema.decodeEffect(Id)(moduleName).pipe(
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
  left: Text,
  right: Text
): boolean => Equal.equals(left, right)

const moduleIdEquivalence: Equivalence.Equivalence<Id> = Equivalence.String

const moduleIdListEquivalence = Arr.makeEquivalence(moduleIdEquivalence)

const parametersIdentity = Equivalence.strictEqual<Ref.Ref<ModuleParameters>>()

const sameSubModuleIds = (
  left: ModuleGraphNode["subModuleIds"],
  right: ModuleGraphNode["subModuleIds"]
): boolean => moduleIdListEquivalence(left, right)

const sameRegistration = (
  left: Discovered,
  right: Discovered
): boolean =>
  Boolean.every(Arr.make(
    parametersIdentity(left.parameters, right.parameters),
    signaturesMatch(left.signature, right.signature),
    sameSubModuleIds(left.subModuleIds, right.subModuleIds)
  ))

const registerConflict = (
  left: Discovered,
  right: Discovered
): CompositionError =>
  new CompositionError({
    message: Arr.join(Arr.make("Discovery registration conflict for module id '", left.id, "'"), ""),
    moduleName: right.id
  })

const mergeRegistration = (
  registrations: HashMap.HashMap<Id, Discovered>,
  registration: Discovered
): Effect.Effect<HashMap.HashMap<Id, Discovered>, CompositionError> =>
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
  registration: Discovered
): Effect.Effect<void, CompositionError> =>
  Effect.gen(function*() {
    const collector = yield* Effect.withFiber((fiber) =>
      Option.match(Context.get(fiber.context, ModuleRegistryRef), {
        onSome: Effect.succeed,
        onNone: () =>
          SynchronizedRef.make(HashMap.empty<Id, Discovered>()).pipe(
            Effect.tap((collector) =>
              Effect.sync(() => fiber.setContext(Context.add(fiber.context, ModuleRegistryRef, Option.some(collector))))
            )
          )
      })
    )

    return yield* SynchronizedRef.updateEffect(
      collector,
      (registrations) => mergeRegistration(registrations, registration)
    )
  })

/**
 * Carries module identity and metadata into discovery.
 *
 * @since 0.1.0
 * @category models
 */
export class RuntimeRegistrationOptions extends Data.Class<{
  /** Untrusted identity decoded with the public `Module.Id` schema. */
  readonly moduleName: string
  /** Parameter ref retained in the discovery record. */
  readonly parameters: Ref.Ref<ModuleParameters>
  /** Signature description and instructions retained for graph projection. */
  readonly signature: Text
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
 * @param options - Module identity, parameters, prompt metadata, and sub-modules.
 * @returns Completion after the registration is visible in the current fiber.
 *
 * @since 0.1.0
 * @category combinators
 */
export const registerRuntime = (options: RuntimeRegistrationOptions): Effect.Effect<void, CompositionError> =>
  Effect.gen(function*() {
    const moduleId = yield* decodeModuleId(options.moduleName)
    const subModuleIds = Option.getOrElse(
      Option.fromNullishOr(options.subModuleIds),
      () => Arr.empty<Id>()
    )

    return yield* register(
      new Discovered({
        id: moduleId,
        parameters: options.parameters,
        signature: options.signature,
        subModuleIds: canonicalSubModuleIds(subModuleIds)
      })
    )
  })

/**
 * Records a module and the identities of its direct sub-modules.
 *
 * @param module - Module whose parameter and prompt metadata are retained.
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
      parameters: module.parameters,
      signature: new Text({
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
 * The contained parameter refs retain their original identity.
 *
 * @since 0.1.0
 * @category combinators
 */
export const registrySnapshot = ModuleRegistryRef.pipe(
  Effect.flatMap(Option.match({
    onNone: () => Effect.succeed(HashMap.empty<Id, Discovered>()),
    onSome: SynchronizedRef.get
  })),
  Effect.map(HashMap.values),
  Effect.map(canonicalModuleRegistrations)
)
