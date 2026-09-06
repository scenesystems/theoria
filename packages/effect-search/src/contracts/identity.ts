/**
 * Validated identifiers and declared source locations used by artifact envelopes.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Validates and brands a ULID string used to group artifacts from one execution.
 * The brand establishes syntax, not uniqueness, issuance, or authenticity.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RunId = Schema.ULID.pipe(Schema.brand("RunId"))

/**
 * ULID-shaped execution identifier whose brand records successful schema validation.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RunId = Schema.Schema.Type<typeof RunId>

/**
 * Validates and brands a non-empty string beginning with `MAJOR.MINOR.PATCH` digits.
 * Text after that prefix is unconstrained, so this schema does not validate full semver syntax.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PackageVersion = Schema.NonEmptyString.pipe(
  Schema.pattern(/^\d+\.\d+\.\d+/),
  Schema.brand("PackageVersion")
)

/**
 * Declared producer version with a validated numeric triplet prefix.
 *
 * @since 0.1.0
 * @category type-level
 */
export type PackageVersion = Schema.Schema.Type<typeof PackageVersion>

/**
 * Validates a non-empty sequence of non-empty component names.
 * The segments describe a logical package location and need not match filesystem paths.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ComponentPath = Schema.NonEmptyArray(Schema.NonEmptyString)

/**
 * Logical package location represented by non-empty path segments.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ComponentPath = Schema.Schema.Type<typeof ComponentPath>

/**
 * Records the producer family and its declared logical location.
 *
 * @remarks
 * `origin` identifies effect-search, effect-dsp, or an external producer. `domain`
 * is the producer-defined namespace, and `segments` locates the component within it.
 * These fields are assertions from the producer rather than authenticated evidence.
 *
 * @since 0.1.0
 * @category models
 */
export class SourceRef extends Schema.Class<SourceRef>("SourceRef")({
  /** Producer family that defines the domain and component path. */
  origin: Schema.Literal("effect-search", "effect-dsp", "external"),
  /** Producer-defined namespace; the schema requires only a non-empty string. */
  domain: Schema.NonEmptyString,
  /** Ordered logical path within the producer's domain. */
  segments: Schema.NonEmptyArray(Schema.NonEmptyString)
}) {}

/**
 * Identifies an artifact by execution and a non-negative integer sequence.
 * Decoding validates each field but cannot establish uniqueness or sequence monotonicity.
 *
 * @since 0.1.0
 * @category models
 */
export class ArtifactId extends Schema.Class<ArtifactId>("ArtifactId")({
  /** Execution group to which the artifact declares membership. */
  runId: RunId,
  /** Non-negative position allocated within the run; uniqueness is not validated. */
  sequence: Schema.NonNegativeInt
}) {}

export { ContentDigest } from "@scenesystems/digest"
