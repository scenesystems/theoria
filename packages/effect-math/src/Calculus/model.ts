/**
 * Calculus domain model instance.
 *
 * @since 0.1.0
 * @category models
 */
import { CalculusDomainContract } from "./contract.js"
import type { CalculusDomain } from "./schema.js"

/**
 * Calculus domain model instance — limit-accurate differential
 * operators and numerical quadrature kernels.
 *
 * @since 0.1.0
 * @category models
 */
export const CalculusDomainModel: CalculusDomain = {
  domain: CalculusDomainContract,
  stability: "provisional"
}
