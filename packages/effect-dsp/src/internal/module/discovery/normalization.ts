/**
 * Discovery registration models.
 *
 * @since 0.1.0
 */
import { Array as Arr, Equivalence, Order } from "effect"
import { type Id, Registration } from "../../../Module.js"
import type { Node as ModuleGraphNode } from "../../../ModuleGraph.js"

const moduleIdOrder: Order.Order<Id> = Order.mapInput(Order.string, (moduleId: Id) => moduleId)

const moduleIdEquivalence: Equivalence.Equivalence<Id> = Equivalence.string

const uniqueSortedModuleIds = (moduleIds: Iterable<Id>): ModuleGraphNode["subModuleIds"] =>
  Arr.dedupeWith(Arr.sort(Arr.fromIterable(moduleIds), moduleIdOrder), moduleIdEquivalence)

/**
 * Sorts child identities and removes repeated values.
 *
 * @param subModuleIds - Identities in any order, possibly repeated.
 * @returns A new ascending array containing each identity once.
 *
 * @since 0.1.0
 * @category combinators
 */
export const canonicalSubModuleIds = (subModuleIds: Iterable<Id>): ModuleGraphNode["subModuleIds"] =>
  uniqueSortedModuleIds(subModuleIds)

const registrationOrder: Order.Order<Registration> = Order.mapInput(
  moduleIdOrder,
  (registration) => registration.id
)

const canonicalRegistration = (registration: Registration): Registration =>
  new Registration({
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
  registrations: Iterable<Registration>
) => Arr.sort(Arr.map(Arr.fromIterable(registrations), canonicalRegistration), registrationOrder)
