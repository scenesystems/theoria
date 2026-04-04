/**
 * Closed discriminant for the optimizer algorithms shipped in effect-dsp.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Literal union of optimizer algorithm identifiers. Each value corresponds
 * to a self-contained optimizer implementation under `src/optimizers/`.
 * Used by {@link OptimizerEventEnvelope} to tag progress events and by
 * the ensemble optimizer to compose heterogeneous strategies.
 *
 * @see {@link OptimizerEventEnvelope} — tags events with the originating optimizer kind
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
 * Inferred runtime type of {@link OptimizerKind}.
 *
 * @see {@link OptimizerKind}
 * @since 0.1.0
 * @category type-level
 */
export type OptimizerKind = Schema.Schema.Type<typeof OptimizerKind>
