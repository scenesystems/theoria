/**
 * Defines the algorithm discriminator accepted by raw key-agreement operations.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"

/**
 * Restricts key-agreement dispatch to the `"x25519"` suite.
 *
 * @since 0.1.0
 * @category schemas
 */
export const AgreementAlgorithm = Schema.Literal("x25519")
