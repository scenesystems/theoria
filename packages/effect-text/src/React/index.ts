/**
 * Creates deterministic preparation cache identities and pure layout
 * projections for React consumers.
 *
 * @remarks
 * This module owns no React state or rendering. Include the browser support
 * profile and font-readiness revision in an identity, cache the prepared
 * handle in the application, and project lines without re-entering text
 * measurement.
 *
 * @since 0.2.0
 * @module
 */
import { Number, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { FontReadinessRevision } from "../Browser/fontReadiness.js"
import { BrowserSupportProfileIdSchema } from "../Browser/supportManifest.js"
import { layoutLinesWithSummary } from "../Text/layout.js"
import type { PreparedTextWithSegments } from "../Text/model.js"
import {
  EngineProfile,
  FontDescriptor,
  HyphenationLocale,
  type LayoutLinesType,
  LayoutLinesWithSummary,
  type LayoutRequestType,
  type LayoutSummaryType,
  PrepareInput,
  type PrepareInputType,
  WhiteSpaceMode
} from "../Text/schema.js"

/**
 * Marks preparation identities and React projection helpers as provisional.
 *
 * @since 0.2.0
 * @category stability
 */
export const ReactStability = "provisional"

/**
 * Font whose measurements are cached. An omitted weight is `Option.none()`, so
 * two fonts prepared without an explicit weight are equal.
 *
 * @since 0.4.0
 * @category models
 */
export class PrepareIdentityFont extends Schema.Class<PrepareIdentityFont>("effect-text/PrepareIdentityFont")({
  /** CSS font-family value passed to the measurement service. */
  family: FontDescriptor.fields.family,
  /** Positive font size in CSS pixels. */
  size: FontDescriptor.fields.size,
  /** Positive integer font weight when the preparation named one. */
  weight: Schema.OptionFromSelf(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)))
}) {}

/**
 * Engine settings captured during preparation, compared field by field.
 *
 * @since 0.4.0
 * @category models
 */
export class PrepareIdentityEngineProfile extends Schema.Class<PrepareIdentityEngineProfile>(
  "effect-text/PrepareIdentityEngineProfile"
)(EngineProfile) {}

/**
 * Inputs whose equality permits reuse of one measured prepared handle.
 *
 * @remarks
 * Identities are structural: two identities built from equal inputs satisfy
 * `Equal.equals` and hash alike, so an identity is directly usable as a
 * `HashMap` key or an `Atom.family` argument. Nothing is serialized.
 *
 * @since 0.2.0
 * @category models
 */
export class PrepareIdentity extends Schema.Class<PrepareIdentity>("effect-text/PrepareIdentity")({
  /** Source text whose measurements are cached. */
  text: PrepareInput.fields.text,
  /** Font whose measurements are cached. */
  font: PrepareIdentityFont,
  /** Whitespace policy captured during preparation. */
  whiteSpace: WhiteSpaceMode,
  /** Dictionary locale captured during preparation. */
  hyphenationLocale: Schema.OptionFromSelf(HyphenationLocale),
  /** Engine settings captured during preparation. */
  engineProfile: PrepareIdentityEngineProfile,
  /** Browser support profile used for measurement. */
  supportProfileId: BrowserSupportProfileIdSchema,
  /** Font-readiness generation used by the measurement cache. */
  fontReadinessRevision: FontReadinessRevision
}) {}

const PrepareIdentityOptions = Schema.Struct({
  prepare: PrepareInput,
  engineProfile: EngineProfile,
  supportProfileId: BrowserSupportProfileIdSchema,
  fontReadinessRevision: FontReadinessRevision
})

type PrepareIdentityOptionsType = typeof PrepareIdentityOptions.Type

/**
 * Layout geometry and visual lines projected without repeating measurement.
 *
 * @since 0.2.0
 * @category schemas
 */
export const PreparedLayoutProjection = LayoutLinesWithSummary

/**
 * Decoded geometry and visual lines produced from one prepared handle.
 *
 * @since 0.2.0
 * @category models
 */
export type PreparedLayoutProjectionType = typeof PreparedLayoutProjection.Type

/**
 * Captures typed preparation input, engine settings, browser profile, and font
 * readiness as one structural cache identity. Values are copied without Schema
 * decoding; optional preparation fields become `Option`.
 *
 * @since 0.2.0
 * @category identities
 */
export const prepareIdentityFor = (options: PrepareIdentityOptionsType): PrepareIdentity =>
  new PrepareIdentity({
    text: options.prepare.text,
    font: new PrepareIdentityFont({
      family: options.prepare.font.family,
      size: options.prepare.font.size,
      weight: Option.fromNullable(options.prepare.font.weight)
    }),
    whiteSpace: options.prepare.whiteSpace,
    hyphenationLocale: Option.fromNullable(options.prepare.hyphenationLocale),
    engineProfile: new PrepareIdentityEngineProfile({
      lineFitEpsilon: options.engineProfile.lineFitEpsilon,
      tabWidth: options.engineProfile.tabWidth,
      defaultDirection: options.engineProfile.defaultDirection,
      preferEarlySoftHyphenBreak: options.engineProfile.preferEarlySoftHyphenBreak,
      preferPrefixWidthsForBreakableRuns: options.engineProfile.preferPrefixWidthsForBreakableRuns
    }),
    supportProfileId: options.supportProfileId,
    fontReadinessRevision: options.fontReadinessRevision
  })

/**
 * Recovers the preparation input an identity was captured from, so a cache
 * miss can prepare the handle from the identity alone.
 *
 * @since 0.4.0
 * @category identities
 */
export const prepareInputFromIdentity = (identity: PrepareIdentity): PrepareInputType => ({
  text: identity.text,
  font: {
    family: identity.font.family,
    size: identity.font.size,
    ...Option.match(identity.font.weight, {
      onNone: () => ({}),
      onSome: (weight) => ({ weight })
    })
  },
  whiteSpace: identity.whiteSpace,
  ...Option.match(identity.hyphenationLocale, {
    onNone: () => ({}),
    onSome: (hyphenationLocale) => ({ hyphenationLocale })
  })
})

/**
 * Derives line count, `lines.length * lineHeight`, and maximum painted width.
 * Empty input produces zero for all fields. Inputs are not Schema-decoded.
 *
 * @since 0.2.0
 * @category projection
 */
export const layoutSummaryFromLines = (
  lines: LayoutLinesType,
  lineHeight: number
): LayoutSummaryType => ({
  lineCount: Arr.length(lines),
  height: Number.multiply(Arr.length(lines), lineHeight),
  maxLineWidth: Arr.reduce(lines, 0, (maxWidth, line) => Number.max(maxWidth, line.width))
})

/**
 * Projects aggregate geometry and visual lines from one prepared handle in a
 * single pure walk. The operation performs no measurement or service lookup.
 *
 * @since 0.2.0
 * @category projection
 */
export const projectPreparedLayout = (
  prepared: PreparedTextWithSegments,
  request: LayoutRequestType
): PreparedLayoutProjectionType => layoutLinesWithSummary(prepared, request)
