/**
 * Reserves the experimental subpath for implemented, explicitly unstable APIs.
 *
 * @remarks
 * This subpath currently exports no APIs. Experimental contracts are added
 * only when they have executable behavior rather than as a metadata inventory.
 *
 * @since 0.1.0
 * @module
 */

import { Array, Schema } from "effect"

/**
 * Accepts a reserved experimental integration name.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ExperimentalSeam = Schema.Literal("VariantSchema", "Machine", "Persistence")

/**
 * A decoded experimental integration name.
 *
 * @since 0.1.0
 * @category models
 */
export type ExperimentalSeamType = typeof ExperimentalSeam.Type

/**
 * Lists integration names retained for compatibility while the subpath is experimental.
 *
 * @since 0.1.0
 * @category experimental
 */
export const ExperimentalSeams = Schema.decodeUnknownSync(Schema.NonEmptyArray(ExperimentalSeam))(
  Array.make("VariantSchema", "Machine", "Persistence")
)
