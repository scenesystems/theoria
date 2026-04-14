import { Either, Option, Schema } from "effect"

const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9~][a-z0-9._~-]*\/)?[a-z0-9~][a-z0-9._~-]*$/u
const RELEASE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u

/**
 * Canonical package identifier for root release-governance and docs surfaces.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PackageNameSchema = Schema.String.pipe(
  Schema.pattern(PACKAGE_NAME_PATTERN),
  Schema.brand("PackageName")
).annotations({ identifier: "PackageName" })

/**
 * Canonical semantic release version used by release snapshots and docs truth.
 *
 * @since 0.0.0
 * @category schemas
 */
export const ReleaseVersionSchema = Schema.String.pipe(
  Schema.pattern(RELEASE_VERSION_PATTERN),
  Schema.brand("ReleaseVersion")
).annotations({ identifier: "ReleaseVersion" })

/**
 * Package identifier type derived from the canonical source-proof schema.
 *
 * @since 0.0.0
 * @category models
 */
export type PackageName = typeof PackageNameSchema.Type

/**
 * Semantic release version type derived from the canonical source-proof schema.
 *
 * @since 0.0.0
 * @category models
 */
export type ReleaseVersion = typeof ReleaseVersionSchema.Type

/**
 * Decodes a package identifier synchronously for checked-in constants and tests.
 *
 * @since 0.0.0
 * @category constructors
 */
export const packageNameFromString = Schema.decodeUnknownSync(PackageNameSchema)

/**
 * Decodes a semantic release version synchronously for checked-in constants and tests.
 *
 * @since 0.0.0
 * @category constructors
 */
export const releaseVersionFromString = Schema.decodeUnknownSync(ReleaseVersionSchema)

/**
 * Attempts to decode a package identifier while preserving invalid input as `None`.
 *
 * @since 0.0.0
 * @category queries
 */
export const packageNameOption = (value: string): Option.Option<PackageName> =>
  Either.match(Schema.decodeUnknownEither(PackageNameSchema)(value), {
    onLeft: () => Option.none(),
    onRight: Option.some
  })

/**
 * Attempts to decode a semantic release version while preserving invalid input as `None`.
 *
 * @since 0.0.0
 * @category queries
 */
export const releaseVersionOption = (value: string): Option.Option<ReleaseVersion> =>
  Either.match(Schema.decodeUnknownEither(ReleaseVersionSchema)(value), {
    onLeft: () => Option.none(),
    onRight: Option.some
  })

/**
 * Decodes a package identifier into `null` when the input is not valid.
 *
 * @since 0.0.0
 * @category queries
 */
export const nullablePackageName = (value: string | null): PackageName | null =>
  Option.getOrNull(
    Option.fromNullable(value).pipe(
      Option.flatMap(packageNameOption)
    )
  )

/**
 * Decodes a semantic release version into `null` when the input is not valid.
 *
 * @since 0.0.0
 * @category queries
 */
export const nullableReleaseVersion = (value: string | null): ReleaseVersion | null =>
  Option.getOrNull(
    Option.fromNullable(value).pipe(
      Option.flatMap(releaseVersionOption)
    )
  )

/**
 * Validates that a raw package identifier is well-formed.
 *
 * @since 0.0.0
 * @category guards
 */
export const isPackageName = Schema.is(PackageNameSchema)

/**
 * Validates that a raw release version is a semver-compatible identifier.
 *
 * @since 0.0.0
 * @category guards
 */
export const isReleaseVersion = Schema.is(ReleaseVersionSchema)
