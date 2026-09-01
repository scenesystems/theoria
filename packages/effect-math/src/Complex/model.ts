/**
 * Complex number carrier type and domain model instance.
 *
 * `Complex` is the tagged carrier for all complex arithmetic,
 * trigonometric, and analysis operations. `ComplexDomainModel`
 * registers the domain in the effect-math domain discovery system.
 *
 * @since 0.1.0
 * @category models
 */
import { Schema } from "effect"

import { ComplexDomainContract } from "./contract.js"
import type { ComplexDomain } from "./schema.js"

/**
 * Schema-backed Cartesian complex value. Components are unrestricted IEEE
 * 754 numbers; use validated operation inputs when finite components are
 * required.
 *
 * @see {@link ComplexDomainModel} — domain registration for discovery
 *
 * @since 0.1.0
 * @category models
 */
export class Complex extends Schema.TaggedClass<Complex>()("Complex", {
  re: Schema.Number,
  im: Schema.Number
}) {}

/**
 * Runtime descriptor identifying the Complex domain as provisional.
 *
 * @see {@link Complex} — the carrier type for complex values
 * @see {@link ComplexDomainContract} — the domain identifier string
 *
 * @since 0.1.0
 * @category models
 */
export const ComplexDomainModel: ComplexDomain = {
  domain: ComplexDomainContract,
  stability: "provisional"
}
