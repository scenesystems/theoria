/**
 * Codecs for deterministic outputs from the synthetic browser regression harness.
 *
 * @since 0.2.0
 */
import { Schema } from "effect"

import * as Text from "../Text/index.js"
import { BrowserSupportProfileIdSchema } from "./supportManifest.js"

/**
 * Stable scenario identifier used by the synthetic artifact harness.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserParityCaseIdSchema = Schema.Literal(
  "white-space-normal",
  "white-space-pre-wrap",
  "trailing-whitespace-hard-breaks",
  "tab-advances",
  "soft-hyphen",
  "mixed-inline-punctuation",
  "fit-paint-divergence"
)

/**
 * Identifier for a checked-in synthetic canvas scenario.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserParityCaseIdType = typeof BrowserParityCaseIdSchema.Type

/**
 * Decodes one scenario's preparation input, layout request, summary, and lines.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserParityArtifactCaseSchema = Schema.Struct({
  /** Released scenario represented by the result. */
  caseId: BrowserParityCaseIdSchema,
  /** Exact preparation input used by the run. */
  prepare: Text.PrepareInput,
  /** Exact layout geometry used by the run. */
  request: Text.LayoutRequest,
  /** Aggregate geometry produced by the run. */
  summary: Text.LayoutSummary,
  /** Materialized visual lines produced by the run. */
  lines: Schema.Array(Text.LayoutLine)
})

/**
 * Decoded result for one synthetic canvas scenario.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserParityArtifactCaseType = typeof BrowserParityArtifactCaseSchema.Type

/**
 * Decodes a profile-specific artifact including resolved font selection and cases.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserParityArtifactSchema = Schema.Struct({
  /** Browser support profile under test. */
  profileId: BrowserSupportProfileIdSchema,
  /** Resolved family used for artifact measurements. */
  fontFamily: Schema.String,
  /** Profile font-selection policy. */
  fontSelection: Schema.String,
  /** Ordered fallback stack recorded with the artifact. */
  fontStack: Schema.Array(Schema.String).pipe(Schema.minItems(1)),
  /** Scenarios claimed by the profile. */
  parityCases: Schema.Array(BrowserParityCaseIdSchema).pipe(Schema.minItems(1)),
  /** Non-empty ordered scenario results. */
  cases: Schema.Array(BrowserParityArtifactCaseSchema).pipe(Schema.minItems(1))
})

/**
 * Decoded profile-specific synthetic regression artifact.
 *
 * @since 0.2.0
 * @category models
 */
export type BrowserParityArtifactType = typeof BrowserParityArtifactSchema.Type

/**
 * JSON codec for checked-in synthetic regression artifacts.
 *
 * @since 0.2.0
 * @category schemas
 */
export const BrowserParityArtifactJsonSchema = Schema.parseJson(BrowserParityArtifactSchema)
