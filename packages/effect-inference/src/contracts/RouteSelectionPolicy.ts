/**
 * Route-selection policy authority for routed provider families.
 *
 * @since 0.1.0
 */
import { Option, Schema } from "effect"

/**
 * Explicit provider selection for routed provider families.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ExplicitProviderRouteSelectionPolicySchema = Schema.Struct({
  _tag: Schema.Literal("provider"),
  provider: Schema.String
})

/**
 * Stable selection policies for brokered provider routing.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RouteSelectionPolicySchema = Schema.Union(
  Schema.Literal("auto", "fastest", "cheapest", "preferred"),
  ExplicitProviderRouteSelectionPolicySchema
)

/**
 * Extracted route-selection policy type.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RouteSelectionPolicy = Schema.Schema.Type<typeof RouteSelectionPolicySchema>

/**
 * Constructs an explicit-provider selection policy.
 *
 * @since 0.1.0
 * @category constructors
 */
export const explicitProviderSelection = (provider: string): RouteSelectionPolicy => ({
  _tag: "provider",
  provider
})

/**
 * Extracts an explicitly requested provider when the selection policy names
 * one directly.
 *
 * @since 0.1.0
 * @category constructors
 */
export const explicitProviderFromSelectionPolicy = (
  selectionPolicy: Option.Option<RouteSelectionPolicy>
): Option.Option<string> =>
  Option.match(selectionPolicy, {
    onNone: () => Option.none(),
    onSome: (resolvedSelectionPolicy) =>
      typeof resolvedSelectionPolicy === "string"
        ? Option.none()
        : Option.some(resolvedSelectionPolicy.provider)
  })
