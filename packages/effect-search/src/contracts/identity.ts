/**
 * Validated identifiers and declared source locations used by artifact envelopes.
 *
 * @since 0.1.0
 */
import * as Artifacts from "@scenesystems/effect-study/Artifacts"
import { Schema } from "effect"

/**
 * Validates and brands a ULID string used to group artifacts from one execution.
 * The brand establishes syntax, not uniqueness, issuance, or authenticity.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RunId = Artifacts.RunId

/**
 * ULID-shaped execution identifier whose brand records successful schema validation.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RunId = Artifacts.RunId

/**
 * Validates and brands a non-empty string beginning with `MAJOR.MINOR.PATCH` digits.
 * Text after that prefix is unconstrained, so this schema does not validate full semver syntax.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PackageVersion = Artifacts.PackageVersion

/**
 * Declared producer version with a validated numeric triplet prefix.
 *
 * @since 0.1.0
 * @category type-level
 */
export type PackageVersion = Artifacts.PackageVersion

/**
 * Validates a non-empty sequence of non-empty component names.
 * The segments describe a logical package location and need not match filesystem paths.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ComponentPath = Artifacts.ComponentPath

/**
 * Logical package location represented by non-empty path segments.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ComponentPath = Artifacts.ComponentPath

const SearchSourceRef = Artifacts.makeSourceRefSchema(Schema.Literal("effect-search", "effect-dsp", "external"))

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
export class SourceRef extends Schema.Class<SourceRef>("SourceRef")(SearchSourceRef.fields) {}

/**
 * Identifies an artifact by execution and a non-negative integer sequence.
 * Decoding validates each field but cannot establish uniqueness or sequence monotonicity.
 *
 * @since 0.1.0
 * @category models
 */
export const ArtifactId = Artifacts.ArtifactId

/**
 * Artifact identity decoded by the canonical effect-study schema.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ArtifactId = Artifacts.ArtifactId

export { ContentDigest } from "@scenesystems/effect-study/Artifacts"
