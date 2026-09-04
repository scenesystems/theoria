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
import { Schema } from "effect"
import * as Arr from "effect/Array"

import type { FontReadinessRevisionType } from "../Browser/fontReadiness.js"
import { FontReadinessRevision } from "../Browser/fontReadiness.js"
import type { BrowserSupportProfileIdType } from "../Browser/supportManifest.js"
import { BrowserSupportProfileIdSchema } from "../Browser/supportManifest.js"
import { layoutLinesWithSummary } from "../Text/layout.js"
import type { PreparedTextWithSegments } from "../Text/model.js"
import {
  type EngineProfileType,
  LayoutLine,
  type LayoutLineType,
  type LayoutRequestType,
  LayoutSummary,
  type LayoutSummaryType,
  type PrepareInputType
} from "../Text/schema.js"
import { FontDescriptor, HyphenationLocale, WhiteSpaceMode } from "../Text/schema.js"

/**
 * Marks cache-key serialization and React projection helpers as provisional.
 *
 * @since 0.2.0
 * @category stability
 */
export const ReactStability = "provisional"

/**
 * Prepare-time identity used by framework consumers to cache prepared handles.
 *
 * @since 0.2.0
 * @category schemas
 */
export const PrepareIdentity = Schema.Struct({
  /** Source text whose measurements are cached. */
  text: Schema.String,
  /** Font whose measurements are cached. */
  font: FontDescriptor,
  /** Whitespace policy captured during preparation. */
  whiteSpace: WhiteSpaceMode,
  /** Dictionary locale captured during preparation. */
  hyphenationLocale: Schema.optional(HyphenationLocale),
  /** Encoded engine settings captured during preparation. */
  engineProfileIdentity: Schema.String,
  /** Browser support profile used for measurement. */
  supportProfileId: BrowserSupportProfileIdSchema,
  /** Font-readiness generation used by the measurement cache. */
  fontReadinessRevision: FontReadinessRevision
})

/**
 * Inputs whose equality permits reuse of one measured prepared handle.
 *
 * @since 0.2.0
 * @category models
 */
export type PrepareIdentityType = typeof PrepareIdentity.Type

/**
 * Accepts serialized preparation identity keys. Use `prepareIdentityKey` to
 * construct values that `prepareIdentityFromKey` can decode safely.
 *
 * @since 0.2.0
 * @category schemas
 */
export const PrepareIdentityKey = Schema.String

/**
 * Serialized cache identity produced from typed preparation inputs.
 *
 * @since 0.2.0
 * @category models
 */
export type PrepareIdentityKeyType = typeof PrepareIdentityKey.Type

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

const encodePart = (value: string | number): string => encodeURIComponent(String(value))

const decodePart = (value = ""): string => decodeURIComponent(value)

const supportProfileIdFrom = (value: string): BrowserSupportProfileIdType =>
  value === "canvas-system-ui" ? "canvas-system-ui" : "canvas-monospace"

/**
 * Encodes every current engine-profile field in declaration order. The result
 * is stable for equal typed profiles and is intended as one component of a
 * preparation cache key.
 *
 * @since 0.2.0
 * @category identities
 */
export const engineProfileIdentity = (profile: EngineProfileType): string =>
  [
    profile.lineFitEpsilon,
    profile.tabWidth,
    profile.defaultDirection,
    profile.preferEarlySoftHyphenBreak ? 1 : 0,
    profile.preferPrefixWidthsForBreakableRuns ? 1 : 0
  ].map(encodePart).join("~")

/**
 * Captures typed preparation input, engine settings, browser profile, and font
 * readiness as one cache identity. Values are copied by reference without
 * Schema decoding.
 *
 * @since 0.2.0
 * @category identities
 */
export const prepareIdentityFor = (options: {
  readonly prepare: PrepareInputType
  readonly engineProfile: EngineProfileType
  readonly supportProfileId: BrowserSupportProfileIdType
  readonly fontReadinessRevision: FontReadinessRevisionType
}): PrepareIdentityType => ({
  text: options.prepare.text,
  font: options.prepare.font,
  whiteSpace: options.prepare.whiteSpace,
  hyphenationLocale: options.prepare.hyphenationLocale,
  engineProfileIdentity: engineProfileIdentity(options.engineProfile),
  supportProfileId: options.supportProfileId,
  fontReadinessRevision: options.fontReadinessRevision
})

/**
 * Encodes all identity fields with component escaping and unambiguous
 * separators. A string containing an unpaired UTF-16 surrogate causes
 * `encodeURIComponent` to throw synchronously.
 *
 * @since 0.2.0
 * @category identities
 */
export const prepareIdentityKey = (identity: PrepareIdentityType): PrepareIdentityKeyType =>
  [
    encodePart(identity.text),
    encodePart(identity.font.family),
    encodePart(identity.font.size),
    encodePart(identity.font.weight ?? ""),
    encodePart(identity.whiteSpace),
    encodePart(identity.hyphenationLocale ?? ""),
    encodePart(identity.engineProfileIdentity),
    encodePart(identity.supportProfileId),
    encodePart(identity.fontReadinessRevision)
  ].join("|")

/**
 * Decodes keys produced by `prepareIdentityKey` without Schema validation.
 * Missing numeric fields become zero; other non-numeric fields become `NaN`.
 * Unknown whitespace and profile values fall back to `normal` and
 * `canvas-monospace`. Malformed percent escapes throw synchronously from
 * `decodeURIComponent`.
 *
 * @since 0.2.0
 * @category identities
 */
export const prepareIdentityFromKey = (key: PrepareIdentityKeyType): PrepareIdentityType => {
  const [text, family, size, weight, whiteSpace, hyphenationLocale, engineProfileId, supportProfileId, revision] = key
    .split("|")

  return {
    text: decodePart(text),
    font: {
      family: decodePart(family),
      size: Number(decodePart(size)),
      ...(decodePart(weight).length === 0 ? {} : { weight: Number(decodePart(weight)) })
    },
    whiteSpace: decodePart(whiteSpace) === "pre-wrap" ? "pre-wrap" : "normal",
    ...(decodePart(hyphenationLocale).length === 0 ? {} : { hyphenationLocale: decodePart(hyphenationLocale) }),
    engineProfileIdentity: decodePart(engineProfileId),
    supportProfileId: supportProfileIdFrom(decodePart(supportProfileId)),
    fontReadinessRevision: Number(decodePart(revision))
  }
}

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
