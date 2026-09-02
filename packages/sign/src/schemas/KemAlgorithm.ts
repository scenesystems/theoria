/**
 * Defines the algorithm discriminator accepted by key-encapsulation operations.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"

/**
 * Restricts key-encapsulation dispatch to the `"xwing"` suite.
 *
 * @since 0.1.0
 * @category schemas
 */
export const KemAlgorithm = Schema.Literal("xwing")
