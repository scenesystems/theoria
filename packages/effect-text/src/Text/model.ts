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
const PreparedBreakKindSchema = Schema.Literal("text", "space", "soft-hyphen", "hard-break", "tab")

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

const PreparedLineChunkSchema = Schema.Struct({
  startSegmentIndex: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  endSegmentIndex: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  consumedEndSegmentIndex: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
})

const PreparedRuntimeTablesSchema = Schema.Struct({
  breakKinds: Schema.Array(PreparedBreakKindSchema),
  fitAdvances: Schema.Array(Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))),
  paintAdvances: Schema.Array(Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))),
  chunkStartIndices: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))),
  chunkConsumedEndIndices: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))),
  breakableGraphemeWidths: Schema.Array(
    Schema.Array(Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)))
  ),
  breakablePrefixWidths: Schema.Array(
    Schema.Array(Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)))
  ),
  discretionaryHyphenWidth: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)),
  tabStopAdvance: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))
})

const PreparedTextManualSurfaceSchema = Schema.Struct({
  segments: Schema.Array(PreparedSegmentSchema),
  chunks: Schema.Array(PreparedLineChunkSchema)
})

const _PreparedTextCoreSchema = Schema.Struct({
  text: Schema.String,
  font: FontDescriptor,
  whiteSpace: WhiteSpaceMode,
  baseDirection: BaseTextDirection,
  lineFitEpsilon: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)),
  tabStopWidth: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)),
  preferEarlySoftHyphenBreak: Schema.Boolean,
  runtime: PreparedRuntimeTablesSchema,
  manualSurface: PreparedTextManualSurfaceSchema
})

/**
 * Stability lane for the Text namespace.
 *
 * @since 0.1.0
 * @category stability
 */
export const TextStability = "provisional"

/**
 * Internal compiled break kind for the walker kernel.
 *
 * @since 0.1.0
 * @category internals
 */
export type PreparedBreakKindType = typeof PreparedBreakKindSchema.Type

/**
 * Internal prepared segment representation.
 *
 * @since 0.1.0
 * @category internals
 */
export type PreparedSegmentType = typeof PreparedSegmentSchema.Type

/**
 * Internal hard-break chunk boundaries for sequential walking.
 *
 * @since 0.1.0
 * @category internals
 */
export type PreparedLineChunkType = typeof PreparedLineChunkSchema.Type

/**
 * Internal parallel runtime tables compiled during preparation.
 *
 * @since 0.1.0
 * @category internals
 */
export type PreparedRuntimeTablesType = typeof PreparedRuntimeTablesSchema.Type

/**
 * Internal rich manual-layout surface retained for materialized line APIs.
 *
 * @since 0.1.0
 * @category internals
 */
export type PreparedTextManualSurfaceType = typeof PreparedTextManualSurfaceSchema.Type

/**
 * Internal prepared representation.
 *
 * @since 0.1.0
 * @category internals
 */
export type PreparedTextCore = typeof _PreparedTextCoreSchema.Type

const preparedTextConstructionToken = Symbol("PreparedTextConstructionToken")
type PreparedTextConstructionToken = typeof preparedTextConstructionToken
const preparedTextCoreSymbol = Symbol("PreparedTextCore")

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
  declare readonly [preparedTextCoreSymbol]: PreparedTextCore

  constructor(_token: PreparedTextConstructionToken, core: PreparedTextCore) {
    Object.defineProperty(this, preparedTextCoreSymbol, {
      value: core,
      enumerable: false,
      configurable: false,
      writable: false
    })
  }
}

/**
 * Rich prepared handle for manual layout, cursor stepping, and stream projection.
 *
 * @since 0.1.0
 * @category models
 */
export class PreparedTextWithSegments extends PreparedText {
  constructor(token: PreparedTextConstructionToken, core: PreparedTextCore) {
    super(token, core)
  }
}

export const preparedTextFromCore = (core: PreparedTextCore): PreparedText =>
  new PreparedText(preparedTextConstructionToken, core)

export const preparedTextWithSegmentsFromCore = (core: PreparedTextCore): PreparedTextWithSegments =>
  new PreparedTextWithSegments(preparedTextConstructionToken, core)

export const preparedTextCore = (self: PreparedText): PreparedTextCore => self[preparedTextCoreSymbol]
