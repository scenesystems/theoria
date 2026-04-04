/**
 * Prepared text model and provisional surface metadata.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"
import * as HashMap from "effect/HashMap"
import * as MutableRef from "effect/MutableRef"

import { BaseTextDirection, FontDescriptor, WhiteSpaceMode } from "./schema.js"

const PreparedSegmentKindSchema = Schema.Literal("text", "space", "hard-break", "tab")
const PreparedSegmentDirectionSchema = Schema.Literal("ltr", "rtl", "neutral")
const PreparedBreakOpportunitySchema = Schema.Literal("none", "space", "soft-hyphen")
const PreparedBreakKindSchema = Schema.Literal(
  "text",
  "space",
  "preserved-space",
  "soft-hyphen",
  "hard-break",
  "tab",
  "glue",
  "zero-width-break"
)

const PreparedSegmentSchema = Schema.Struct({
  kind: PreparedSegmentKindSchema,
  text: Schema.String,
  width: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)),
  fitWidth: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)),
  direction: PreparedSegmentDirectionSchema,
  bidiLevel: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  breakOpportunity: PreparedBreakOpportunitySchema,
  breakText: Schema.String,
  breakWidth: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)),
  graphemes: Schema.Array(Schema.String),
  graphemeAdvances: Schema.Array(Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))),
  fitPrefixWidths: Schema.Array(Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))),
  graphemeBidiLevels: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))),
  mirroredGraphemes: Schema.Array(Schema.String)
})

const _PreparedLineChunkSchema = Schema.Struct({
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
  graphemeBidiLevels: Schema.Array(
    Schema.Array(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)))
  ),
  mirroredGraphemes: Schema.Array(Schema.Array(Schema.String)),
  discretionaryHyphenWidth: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)),
  tabStopAdvance: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0))
})

const PreparedTextMetaSchema = Schema.Struct({
  text: Schema.String,
  font: FontDescriptor
})

const PreparedTextKernelSchema = Schema.Struct({
  whiteSpace: WhiteSpaceMode,
  baseDirection: BaseTextDirection,
  lineFitEpsilon: Schema.Number.pipe(Schema.finite(), Schema.greaterThanOrEqualTo(0)),
  preferEarlySoftHyphenBreak: Schema.Boolean,
  runtime: PreparedRuntimeTablesSchema
})

const PreparedTextLogicalSurfaceSchema = Schema.Struct({
  segments: Schema.Array(PreparedSegmentSchema)
})

const _PreparedTextCoreSchema = Schema.Struct({
  meta: PreparedTextMetaSchema,
  kernel: PreparedTextKernelSchema
})

const _PreparedTextWithSegmentsCoreSchema = Schema.Struct({
  meta: PreparedTextMetaSchema,
  kernel: PreparedTextKernelSchema,
  logicalSurface: PreparedTextLogicalSurfaceSchema
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
 * Internal hard-break chunk boundaries used while compiling kernel tables.
 *
 * @since 0.1.0
 * @category internals
 */
export type PreparedLineChunkType = typeof _PreparedLineChunkSchema.Type

/**
 * Internal parallel runtime tables compiled during preparation.
 *
 * @since 0.1.0
 * @category internals
 */
export type PreparedRuntimeTablesType = typeof PreparedRuntimeTablesSchema.Type

/**
 * Internal stable metadata retained alongside the kernel.
 *
 * @since 0.2.0
 * @category internals
 */
export type PreparedTextMetaType = typeof PreparedTextMetaSchema.Type

/**
 * Internal kernel authority used by the walker.
 *
 * @since 0.2.0
 * @category internals
 */
export type PreparedTextKernelType = typeof PreparedTextKernelSchema.Type

/**
 * Internal retained logical surface used only for materialization support.
 *
 * @since 0.2.0
 * @category internals
 */
export type PreparedTextLogicalSurfaceType = typeof PreparedTextLogicalSurfaceSchema.Type

/**
 * Internal summary prepared representation.
 *
 * @since 0.1.0
 * @category internals
 */
export type PreparedTextCore = typeof _PreparedTextCoreSchema.Type

/**
 * Internal prepared representation that retains logical-surface materialization data.
 *
 * @since 0.2.0
 * @category internals
 */
export type PreparedTextWithSegmentsCore = typeof _PreparedTextWithSegmentsCoreSchema.Type

type PreparedTextCursorHintKey = readonly [number, number, number]
type PreparedTextCursorHints = MutableRef.MutableRef<HashMap.HashMap<PreparedTextCursorHintKey, number>>

const preparedTextConstructionToken = Symbol("PreparedTextConstructionToken")
type PreparedTextConstructionToken = typeof preparedTextConstructionToken
const preparedTextCoreSymbol = Symbol("PreparedTextCore")
const preparedTextWithSegmentsCoreSymbol = Symbol("PreparedTextWithSegmentsCore")
const preparedTextCursorHintsSymbol = Symbol("PreparedTextCursorHints")

const summaryCoreFromWithSegmentsCore = (core: PreparedTextWithSegmentsCore): PreparedTextCore => ({
  kernel: core.kernel,
  meta: core.meta
})

const preparedTextCursorHints = (): PreparedTextCursorHints =>
  MutableRef.make(HashMap.empty<PreparedTextCursorHintKey, number>())

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
  /**
   * Opaque prepared representation used by visual materialization surfaces.
   *
   * @since 0.2.0
   * @category models
   */
  declare readonly [preparedTextWithSegmentsCoreSymbol]: PreparedTextWithSegmentsCore

  /**
   * Internal sequential-walk hint cache scoped to the prepared handle.
   *
   * @since 0.2.0
   * @category models
   */
  declare readonly [preparedTextCursorHintsSymbol]: PreparedTextCursorHints

  constructor(token: PreparedTextConstructionToken, core: PreparedTextWithSegmentsCore) {
    super(token, summaryCoreFromWithSegmentsCore(core))

    Object.defineProperty(this, preparedTextWithSegmentsCoreSymbol, {
      value: core,
      enumerable: false,
      configurable: false,
      writable: false
    })

    Object.defineProperty(this, preparedTextCursorHintsSymbol, {
      value: preparedTextCursorHints(),
      enumerable: false,
      configurable: false,
      writable: false
    })
  }
}

export const preparedTextFromCore = (core: PreparedTextCore): PreparedText =>
  new PreparedText(preparedTextConstructionToken, core)

export const preparedTextWithSegmentsFromCore = (core: PreparedTextWithSegmentsCore): PreparedTextWithSegments =>
  new PreparedTextWithSegments(preparedTextConstructionToken, core)

export const preparedTextCore = (self: PreparedText): PreparedTextCore => self[preparedTextCoreSymbol]

export const preparedTextWithSegmentsCore = (
  self: PreparedTextWithSegments
): PreparedTextWithSegmentsCore => self[preparedTextWithSegmentsCoreSymbol]

export const preparedTextWithSegmentsCursorHints = (
  self: PreparedTextWithSegments
): PreparedTextCursorHints => self[preparedTextCursorHintsSymbol]
