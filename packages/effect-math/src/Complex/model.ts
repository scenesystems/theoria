/**
 * Defines Cartesian complex values and their discovery descriptor.
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
 * @since 0.1.0
 * @category models
 */
export class Complex extends Schema.TaggedClass<Complex>()("Complex", {
  /** Real component. */
  re: Schema.Number,
  /** Imaginary component. */
  im: Schema.Number
}) {}

/**
 * Runtime descriptor identifying the Complex domain as provisional.
 *
 * @since 0.1.0
 * @category models
 */
export const ComplexDomainModel: ComplexDomain = {
  domain: ComplexDomainContract,
  stability: "provisional"
}
