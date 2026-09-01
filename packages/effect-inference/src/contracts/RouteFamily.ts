/**
 * Route-family authority for stable inference transport categories.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Stable root route families that consumer code can depend on in `v0.1`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StableRouteFamilySchema = Schema.Literal(
  "OpenAiCompatible",
  "OpenAiResponses",
  "AnthropicMessages",
  "HuggingFace"
)

/**
 * Additive native route families reserved for explicit companion or
 * experimental lanes.
 *
 * @since 0.1.0
 * @category schemas
 */
export const NativeRouteFamilySchema = Schema.Literal("TgiNative", "TeiNative", "OllamaNative")

/**
 * Full route-family vocabulary.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RouteFamilySchema = Schema.Union(StableRouteFamilySchema, NativeRouteFamilySchema)

/**
 * Canonical transport families accepted by persisted v0.1 descriptors and
 * stable route resolution.
 *
 * @since 0.1.0
 * @category type-level
 */
export type StableRouteFamily = Schema.Schema.Type<typeof StableRouteFamilySchema>

/**
 * Opt-in native protocol families whose integration boundary is experimental
 * and therefore excluded from canonical execution routes.
 *
 * @since 0.1.0
 * @category type-level
 */
export type NativeRouteFamily = Schema.Schema.Type<typeof NativeRouteFamilySchema>

/**
 * Complete transport vocabulary for code that deliberately handles both the
 * stable canonical families and opt-in native protocol families.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RouteFamily = Schema.Schema.Type<typeof RouteFamilySchema>

/**
 * Returns the default transport family for self-hosted and brokered open-model
 * runtimes in `v0.1`.
 *
 * @since 0.1.0
 * @category constructors
 */
export const defaultRouteFamily = (): StableRouteFamily => "OpenAiCompatible"
