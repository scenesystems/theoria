/**
 * Explicitly unstable inference experiments.
 *
 * @since 0.1.0
 */

import {
  type NativeRouteFamily as NativeRouteFamilyContract,
  NativeRouteFamilySchema as NativeRouteFamilySchemaContract
} from "../contracts/RouteFamily.js"

/**
 * Native route-family discriminator reserved for explicit experimental lanes.
 *
 * @since 0.1.0
 * @category type-level
 */
export type NativeRouteFamily = NativeRouteFamilyContract

/**
 * Native route-family schema reserved for explicit experimental lanes.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NativeRouteFamilySchema = NativeRouteFamilySchemaContract
