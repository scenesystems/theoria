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
 * Complex number with real and imaginary parts. Serves as the carrier
 * type for all operations in the Complex domain and supports
 * Schema decode/encode round-tripping for boundary serialization.
 *
 * @example
 * ```ts
 * import { Complex } from "effect-math/Complex"
 *
 * const z = new Complex({ re: 3, im: 4 })
 * z.re  // 3
 * z.im  // 4
 * ```
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
 * Runtime domain model for the Complex domain. Carries the canonical
 * domain identifier and stability level for domain discovery pipelines.
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
