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
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Data, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import type { FontReadinessRevisionType } from "../Browser/fontReadiness.js"
import type { BrowserSupportProfileIdType } from "../Browser/supportManifest.js"
import { layoutLinesWithSummary } from "../Text/layout.js"
import type { PreparedTextWithSegments } from "../Text/model.js"
import {
  type BaseTextDirectionType,
  type EngineProfileType,
  type HyphenationLocaleType,
  LayoutLine,
  type LayoutLineType,
  type LayoutRequestType,
  LayoutSummary,
  type LayoutSummaryType,
  type PrepareInputType,
  type WhiteSpaceModeType
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
export class PrepareIdentityFont extends Data.Class<{
  /** CSS font-family value passed to the measurement service. */
  readonly family: string
  /** Positive font size in CSS pixels. */
  readonly size: number
  /** Positive integer font weight when the preparation named one. */
  readonly weight: Option.Option<number>
}> {}

/**
 * Engine settings captured during preparation, compared field by field.
 *
 * @since 0.4.0
 * @category models
 */
export class PrepareIdentityEngineProfile extends Data.Class<{
  /** Non-negative tolerance added when deciding whether a run fits. */
  readonly lineFitEpsilon: number
  /** Positive number of space columns represented by a tab stop. */
  readonly tabWidth: number
  /** Paragraph direction used when source text has no strong direction. */
  readonly defaultDirection: BaseTextDirectionType
  /** Whether an earlier soft-hyphen break wins over a later fit. */
  readonly preferEarlySoftHyphenBreak: boolean
  /** Whether prepared prefix measurements drive breakable-run fitting. */
  readonly preferPrefixWidthsForBreakableRuns: boolean
}> {}

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
export class PrepareIdentity extends Data.Class<{
  /** Source text whose measurements are cached. */
  readonly text: string
  /** Font whose measurements are cached. */
  readonly font: PrepareIdentityFont
  /** Whitespace policy captured during preparation. */
  readonly whiteSpace: WhiteSpaceModeType
  /** Dictionary locale captured during preparation. */
  readonly hyphenationLocale: Option.Option<HyphenationLocaleType>
  /** Engine settings captured during preparation. */
  readonly engineProfile: PrepareIdentityEngineProfile
  /** Browser support profile used for measurement. */
  readonly supportProfileId: BrowserSupportProfileIdType
  /** Font-readiness generation used by the measurement cache. */
  readonly fontReadinessRevision: FontReadinessRevisionType
}> {}

/**
 * Layout geometry and visual lines projected without repeating measurement.
 *
 * @since 0.2.0
 * @category schemas
 */
export const PreparedLayoutProjection = Schema.Struct({
  /** Aggregate layout geometry. */
  summary: LayoutSummary,
  /** Materialized lines in visual order. */
  lines: Schema.Array(LayoutLine)
})

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
export const prepareIdentityFor = (options: {
  readonly prepare: PrepareInputType
  readonly engineProfile: EngineProfileType
  readonly supportProfileId: BrowserSupportProfileIdType
  readonly fontReadinessRevision: FontReadinessRevisionType
}): PrepareIdentity =>
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
  lines: ReadonlyArray<LayoutLineType>,
  lineHeight: number
): LayoutSummaryType => ({
  lineCount: lines.length,
  height: lines.length * lineHeight,
  maxLineWidth: Arr.reduce(lines, 0, (maxWidth, line) => Numeric.max(maxWidth, line.width))
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
