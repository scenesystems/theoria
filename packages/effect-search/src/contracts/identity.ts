/**
 * Branded identity types for the artifact provenance system.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * ULID-shaped execution-run identifier.
 *
 * @remarks
 * The schema validates and brands the string; it does not generate identifiers
 * or establish their uniqueness or trustworthiness.
 *
 * @see {@link ArtifactId} — composite key that includes a RunId
 * @see {@link SourceRef} — locator for the producing package within a run
 *
 * @since 0.1.0
 * @category schemas
 */
export const RunId = Schema.ULID.pipe(Schema.brand("RunId"))

/**
 * Provenance scope for artifacts produced during one declared execution. The
 * brand proves ULID syntax only, not uniqueness or authenticity.
 *
 * @see {@link RunId} — the schema used for validation
 * @see {@link ArtifactId} — pairs a RunId with a monotonic sequence
 *
 * @since 0.1.0
 * @category type-level
 */
export type RunId = Schema.Schema.Type<typeof RunId>

/**
 * Semver-validated package version. Requires a leading `MAJOR.MINOR.PATCH`
 * prefix but permits pre-release and build-metadata suffixes.
 *
 * @see {@link SourceRef} — embeds producer package identity
 * @see {@link ArtifactId} — artifact provenance includes producer version context
 *
 * @since 0.1.0
 * @category schemas
 */
export const PackageVersion = Schema.NonEmptyString.pipe(
  Schema.pattern(/^\d+\.\d+\.\d+/),
  Schema.brand("PackageVersion")
)

/**
 * Branded string type extracted from the {@link PackageVersion} schema —
 * guarantees the value matches a semver prefix pattern.
 *
 * @see {@link PackageVersion} — the schema used for validation
 *
 * @since 0.1.0
 * @category type-level
 */
export type PackageVersion = Schema.Schema.Type<typeof PackageVersion>

/**
 * Module location within the producing package. A non-empty array of
 * path segments (e.g. `['Study', 'snapshot']`) enabling hierarchical
 * grouping without filesystem assumptions.
 *
 * @see {@link SourceRef} — wraps a ComponentPath with origin and domain
 *
 * @since 0.1.0
 * @category schemas
 */
export const ComponentPath = Schema.NonEmptyArray(Schema.NonEmptyString)

/**
 * Non-empty array of non-empty strings representing a module path —
 * use the {@link ComponentPath} schema to validate input.
 *
 * @see {@link ComponentPath} — the schema used for validation
 * @see {@link SourceRef} — the model that consumes this path
 *
 * @since 0.1.0
 * @category type-level
 */
export type ComponentPath = Schema.Schema.Type<typeof ComponentPath>

/**
 * Declared source locator containing an origin, domain, and non-empty path.
 *
 * @remarks
 * This is provenance metadata supplied by the producer, not authenticated
 * evidence of where an artifact was created.
 *
 * @see {@link ArtifactLineage} — lineage record that carries a SourceRef
 * @see {@link ArtifactProducerSchema} — tagged union of known producer systems
 *
 * @since 0.1.0
 * @category models
 */
export class SourceRef extends Schema.Class<SourceRef>("SourceRef")({
  origin: Schema.Literal("effect-search", "effect-dsp", "external"),
  domain: Schema.NonEmptyString,
  segments: Schema.NonEmptyArray(Schema.NonEmptyString)
}) {}

/**
 * Composite artifact identifier containing a run ID and non-negative sequence.
 *
 * @remarks
 * The schema does not enforce uniqueness or monotonicity across values.
 *
 * @see {@link RunId} — the branded ULID that scopes this identity
 * @see {@link ArtifactLineage} — carries an ArtifactId alongside provenance
 *
 * @since 0.1.0
 * @category models
 */
export class ArtifactId extends Schema.Class<ArtifactId>("ArtifactId")({
  runId: RunId,
  sequence: Schema.NonNegativeInt
}) {}

export {
  /**
   * Re-export from `@scenesystems/digest` — algorithm-tagged digest pair
   * for content-addressable integrity checks.
   *
   * @see {@link ArtifactLineage} — optional integrity field for content verification
   *
   * @since 0.1.0
   * @category models
   */
  ContentDigest
} from "@scenesystems/digest"
