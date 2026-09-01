/**
 * Domain stability level schema — stable, provisional, or experimental.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Schema } from "effect"

/**
 * Accepts the three publication guarantees used by domain descriptors:
 * stable, provisional, or experimental.
 *
 * @since 0.1.0
 * @category contracts
 */
export const DomainStability = Schema.Literal("stable", "provisional", "experimental")

/**
 * A domain's declared API maturity and compatibility expectation.
 *
 * @since 0.1.0
 * @category models
 */
export type DomainStabilityType = typeof DomainStability.Type
