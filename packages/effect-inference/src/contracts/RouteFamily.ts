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
 * Stable route-family discriminator extracted from
 * {@link StableRouteFamilySchema}.
 *
 * @since 0.1.0
 * @category type-level
 */
export type StableRouteFamily = Schema.Schema.Type<typeof StableRouteFamilySchema>

/**
 * Experimental native route-family discriminator extracted from
 * {@link NativeRouteFamilySchema}.
 *
 * @since 0.1.0
 * @category type-level
 */
export type NativeRouteFamily = Schema.Schema.Type<typeof NativeRouteFamilySchema>

/**
 * Route-family discriminator extracted from {@link RouteFamilySchema}.
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
