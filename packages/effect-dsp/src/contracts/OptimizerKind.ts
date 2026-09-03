/**
 * Stable discriminants used in optimizer event envelopes.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Decodes the optimizer identities accepted by {@link OptimizerEventEnvelope}.
 * Unknown labels fail Schema decoding rather than entering event streams.
 *
 * @since 0.1.0
 * @category schemas
 */
export const OptimizerKind = Schema.Literal(
  "labeledFewShot",
  "bootstrapFewShot",
  "bootstrapRS",
  "miprov2",
  "gepa",
  "ensemble"
)

/**
 * Selects an optimizer identity decoded by the {@link OptimizerKind} schema.
 * @since 0.1.0
 * @category type-level
 */
export type OptimizerKind = Schema.Schema.Type<typeof OptimizerKind>
