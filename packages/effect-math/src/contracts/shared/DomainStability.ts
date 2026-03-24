/**
 * Domain stability level schema — stable, provisional, or experimental.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Schema } from "effect"

/**
 * Shared domain stability schema authority.
 *
 * @since 0.1.0
 * @category contracts
 */
export const DomainStability = Schema.Literal("stable", "provisional", "experimental")

/**
 * Shared domain stability type.
 *
 * @since 0.1.0
 * @category models
 */
export type DomainStabilityType = typeof DomainStability.Type
