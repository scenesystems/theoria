/**
 * Defines the maturity labels recorded in domain discovery descriptors.
 *
 * @since 0.1.0
 * @category contracts
 */
import { Schema } from "effect"

/**
 * Accepts `"stable"`, `"provisional"`, or `"experimental"` descriptor metadata.
 *
 * @remarks
 * This Schema validates the label only. It does not enforce package-version
 * compatibility or restrict imports.
 *
 * @since 0.1.0
 * @category contracts
 */
export const DomainStability = Schema.Literal("stable", "provisional", "experimental")

/**
 * The maturity label carried by a decoded domain descriptor.
 *
 * @since 0.1.0
 * @category models
 */
export type DomainStabilityType = typeof DomainStability.Type
