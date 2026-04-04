/**
 * Framework-thin React companion boundary for effect-text.
 *
 * @since 0.2.0
 */
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
 * Stability lane for React companion helpers.
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
  text: Schema.String,
  font: FontDescriptor,
  whiteSpace: WhiteSpaceMode,
  hyphenationLocale: Schema.optional(HyphenationLocale),
  engineProfileIdentity: Schema.String,
  supportProfileId: BrowserSupportProfileIdSchema,
  fontReadinessRevision: FontReadinessRevision
})

/**
 * Prepare-time identity type.
 *
 * @since 0.2.0
 * @category models
 */
export type PrepareIdentityType = typeof PrepareIdentity.Type

/**
 * Stable cache key for a prepare-time identity.
 *
 * @since 0.2.0
 * @category schemas
 */
export const PrepareIdentityKey = Schema.String

/**
 * Stable cache key type for a prepare-time identity.
 *
 * @since 0.2.0
 * @category models
 */
export type PrepareIdentityKeyType = typeof PrepareIdentityKey.Type

/**
 * Pure summary-plus-lines projection over an already prepared handle.
 *
 * @since 0.2.0
 * @category schemas
 */
export const PreparedLayoutProjection = Schema.Struct({
  summary: LayoutSummary,
  lines: Schema.Array(LayoutLine)
})

/**
 * Pure summary-plus-lines projection type.
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
 * Encodes one runtime engine profile into a stable identity string.
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
 * Builds the full prepare-time identity from prepare input plus browser/runtime freshness.
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
 * Encodes a prepare-time identity into a stable cache key.
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
 * Decodes a stable cache key back into the prepare-time identity payload.
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
 * Summarizes already materialized lines without reopening preparation.
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
  maxLineWidth: Arr.reduce(lines, 0, (maxWidth, line) => Math.max(maxWidth, line.width))
})

/**
 * Projects summary and lines from one prepared handle without re-entering `prepare`.
 *
 * @since 0.2.0
 * @category projection
 */
export const projectPreparedLayout = (
  prepared: PreparedTextWithSegments,
  request: LayoutRequestType
): PreparedLayoutProjectionType => layoutLinesWithSummary(prepared, request)
