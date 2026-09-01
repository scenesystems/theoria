/**
 * Native TGI, TEI, and Ollama route-family discriminators. This module only
 * exports the union and its Schema; it does not provide adapters for them.
 *
 * @since 0.1.0
 */

import {
  type NativeRouteFamily as NativeRouteFamilyContract,
  NativeRouteFamilySchema as NativeRouteFamilySchemaContract
} from "../contracts/RouteFamily.js"

/**
 * Union of `TgiNative`, `TeiNative`, and `OllamaNative` route-family values.
 *
 * @since 0.1.0
 * @category type-level
 */
export type NativeRouteFamily = NativeRouteFamilyContract

/**
 * Decodes the three native route-family literals.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NativeRouteFamilySchema = NativeRouteFamilySchemaContract
