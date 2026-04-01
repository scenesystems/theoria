/**
 * Prepared text model and provisional surface metadata.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { BaseTextDirection, FontDescriptor, WhiteSpaceMode } from "./schema.js"

const PreparedSegmentKindSchema = Schema.Literal("text", "space", "hard-break", "tab")
const PreparedSegmentDirectionSchema = Schema.Literal("ltr", "rtl", "neutral")
const PreparedBreakOpportunitySchema = Schema.Literal("none", "space", "soft-hyphen")

const PreparedSegmentSchema = Schema.Struct({
  kind: PreparedSegmentKindSchema,
  text: Schema.String,
  width: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)),
  direction: PreparedSegmentDirectionSchema,
  bidiLevel: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  breakOpportunity: PreparedBreakOpportunitySchema,
  breakText: Schema.String,
  breakWidth: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))
})

const _PreparedTextCoreSchema = Schema.Struct({
  text: Schema.String,
  font: FontDescriptor,
  whiteSpace: WhiteSpaceMode,
  baseDirection: BaseTextDirection,
  lineFitEpsilon: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)),
  tabStopWidth: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)),
  preferEarlySoftHyphenBreak: Schema.Boolean,
  segments: Schema.Array(PreparedSegmentSchema)
})

/**
 * Stability lane for the Text namespace.
 *
 * @since 0.1.0
 * @category stability
 */
export const TextStability = "provisional"

/**
 * Internal prepared segment representation.
 *
 * @since 0.1.0
 * @category internals
 */
export type PreparedSegmentType = typeof PreparedSegmentSchema.Type

/**
 * Internal prepared representation.
 *
 * @since 0.1.0
 * @category internals
 */
export type PreparedTextCore = typeof _PreparedTextCoreSchema.Type

/**
 * Prepared text handle returned by `Text.prepare`.
 *
 * @since 0.1.0
 * @category models
 */
export class PreparedText {
  /**
   * Opaque prepared representation used by pure layout projection.
   *
   * @since 0.1.0
   * @category models
   */
  readonly #core: PreparedTextCore

  private constructor(core: PreparedTextCore) {
    this.#core = core
  }

  /**
   * Wraps prepared core data in an opaque handle.
   *
   * @since 0.1.0
   * @category constructors
   */
  static fromCore(core: PreparedTextCore): PreparedText {
    return new PreparedText(core)
  }

  /**
   * Unwraps opaque prepared data for pure layout helpers.
   *
   * @since 0.1.0
   * @category accessors
   */
  static core(self: PreparedText): PreparedTextCore {
    return self.#core
  }
}
