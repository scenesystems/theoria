/**
 * Discovery registration models.
 *
 * @since 0.1.0
 */
import type { Ref } from "effect"
import { Array as Arr, Data, Option, Order } from "effect"
import type { ModuleId } from "../../contracts/ModuleId.js"
import type { ModuleNodeSignature } from "../../contracts/ModuleNode.js"
import type { ModuleParams } from "../../contracts/ModuleParams.js"

const moduleIdOrder: Order.Order<ModuleId> = Order.mapInput(Order.string, (moduleId: ModuleId) => moduleId)

const uniqueSortedModuleIds = (moduleIds: ReadonlyArray<ModuleId>): ReadonlyArray<ModuleId> => {
  const sorted = Arr.sort(moduleIds, moduleIdOrder)

  return Arr.reduce(sorted, Arr.empty<ModuleId>(), (acc, moduleId) =>
    Option.match(Arr.last(acc), {
      onNone: () => Arr.make(moduleId),
      onSome: (last) =>
        last === moduleId
          ? acc
          : Arr.append(acc, moduleId)
    }))
}

export {
  /**
   * Lightweight signature projection used in discovery registrations —
   * carries only `description` and `instructions` without full Schema generics.
   *
   * @since 0.1.0
   * @category models
   */
  ModuleNodeSignature as RegisteredSignature
} from "../../contracts/ModuleNode.js"

/**
 * A fiber-local registration entry recorded when a module executes.
 * Captures the module id, parameter ref, signature projection, and
 * direct child ids.
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleRegistration extends Data.TaggedClass("ModuleRegistration")<{
  readonly id: ModuleId
  readonly params: Ref.Ref<ModuleParams>
  readonly signature: ModuleNodeSignature
  readonly subModuleIds: ReadonlyArray<ModuleId>
}> {}

/**
 * Sort and deduplicate child module ids for deterministic registration
 * payloads.
 *
 * @since 0.1.0
 * @category combinators
 */
export const canonicalSubModuleIds = (subModuleIds: ReadonlyArray<ModuleId>): ReadonlyArray<ModuleId> =>
  uniqueSortedModuleIds(subModuleIds)

const registrationOrder: Order.Order<ModuleRegistration> = Order.mapInput(
  moduleIdOrder,
  (registration) => registration.id
)

const canonicalRegistration = (registration: ModuleRegistration): ModuleRegistration =>
  new ModuleRegistration({
    id: registration.id,
    params: registration.params,
    signature: registration.signature,
    subModuleIds: canonicalSubModuleIds(registration.subModuleIds)
  })

/**
 * Sort and canonicalize a snapshot of module registrations for
 * deterministic output.
 *
 * @since 0.1.0
 * @category combinators
 */
export const canonicalModuleRegistrations = (
  registrations: ReadonlyArray<ModuleRegistration>
): ReadonlyArray<ModuleRegistration> => Arr.sort(Arr.map(registrations, canonicalRegistration), registrationOrder)
