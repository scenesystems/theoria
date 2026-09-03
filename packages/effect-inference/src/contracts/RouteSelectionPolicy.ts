/**
 * Provider-selection instructions for brokered routes.
 *
 * @since 0.1.0
 */
import { Option, Schema } from "effect"

/**
 * Decodes a policy that requires one named provider.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ExplicitProviderRouteSelectionPolicySchema = Schema.Struct({
  _tag: Schema.Literal("provider"),
  provider: Schema.String
})

/**
 * Accepts broker strategies or a required provider.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RouteSelectionPolicySchema = Schema.Union(
  Schema.Literal("auto", "fastest", "cheapest", "preferred"),
  ExplicitProviderRouteSelectionPolicySchema
)

/**
 * Expresses caller preference at a brokered routing boundary: delegate the
 * choice to a named strategy or require one explicit provider. Absence leaves
 * selection to the route adapter's default policy.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RouteSelectionPolicy = Schema.Schema.Type<typeof RouteSelectionPolicySchema>

/**
 * Requires a brokered route to select `provider`. The provider name is stored
 * unchanged and is not validated against a broker registry.
 *
 * @since 0.1.0
 * @category constructors
 */
export const explicitProviderSelection = (provider: string): RouteSelectionPolicy => ({
  _tag: "provider",
  provider
})

/**
 * Extracts a required provider. Broker strategies and an absent policy return
 * `None`.
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
