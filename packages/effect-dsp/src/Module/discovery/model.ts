/**
 * Discovery registration models.
 *
 * @since 0.1.0
 */
import type { Ref } from "effect"
import { Array as Arr, Data, Equivalence, Order } from "effect"
import type { ModuleGraphNode } from "../../contracts/ModuleGraph.js"
import type { ModuleId } from "../../contracts/ModuleId.js"
import type { ModuleNodeSignature } from "../../contracts/ModuleNode.js"
import type { ModuleParams } from "../../contracts/ModuleParams.js"

const moduleIdOrder: Order.Order<ModuleId> = Order.mapInput(Order.string, (moduleId: ModuleId) => moduleId)

const moduleIdEquivalence: Equivalence.Equivalence<ModuleId> = Equivalence.string

const uniqueSortedModuleIds = (moduleIds: Iterable<ModuleId>): ModuleGraphNode["subModuleIds"] =>
  Arr.dedupeWith(Arr.sort(Arr.fromIterable(moduleIds), moduleIdOrder), moduleIdEquivalence)

export { ModuleNodeSignature as RegisteredSignature } from "../../contracts/ModuleNode.js"

/**
 * Records one executed module for runtime discovery.
 *
 * @remarks
 * The parameter ref remains live. Child ids describe declared ownership rather
 * than proving that each child executed in the same discovery scope.
 *
 * @since 0.1.0
 * @category models
 */
export class ModuleRegistration extends Data.TaggedClass("ModuleRegistration")<{
  /** Validated identity used for sorting, deduplication, and graph lookup. */
  readonly id: ModuleId
  /** Live mutable parameters owned by the registered module. */
  readonly params: Ref.Ref<ModuleParams>
  /** Description and baseline instructions captured by registration. */
  readonly signature: ModuleNodeSignature
  /** Sorted, unique identities of direct declared children. */
  readonly subModuleIds: ModuleGraphNode["subModuleIds"]
}> {}

/**
 * Sorts child identities and removes repeated values.
 *
 * @param subModuleIds - Identities in any order, possibly repeated.
 * @returns A new ascending array containing each identity once.
 *
 * @since 0.1.0
 * @category combinators
 */
export const canonicalSubModuleIds = (subModuleIds: Iterable<ModuleId>): ModuleGraphNode["subModuleIds"] =>
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
 * Sorts registrations by identity and canonicalizes each child-id array.
 *
 * @remarks
 * Duplicate registration ids remain present, and conflicts are not detected.
 * Use {@link register} when adding entries to the live registry.
 *
 * @param registrations - Snapshot values to copy and sort.
 * @returns New registration values in ascending id order.
 *
 * @since 0.1.0
 * @category combinators
 */
export const canonicalModuleRegistrations = (
  registrations: Iterable<ModuleRegistration>
) => Arr.sort(Arr.map(Arr.fromIterable(registrations), canonicalRegistration), registrationOrder)
