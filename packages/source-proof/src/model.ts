import { Data } from "effect"

/**
 * Absolute and project-relative path metadata for a discovered source file.
 *
 * @since 0.0.0
 * @category models
 */
export class SourceFilePath extends Data.Class<{
  readonly absolute: string
  readonly relative: string
}> {}

/**
 * Consumer-facing public export kinds used by release-governance checks.
 *
 * @since 0.0.0
 * @category models
 */
export type PublicExportKind = "default" | "namespace" | "type" | "value"

/**
 * Source-owned documentation metadata for one public export surface entry.
 *
 * This model is the shared foundation for later package-level `@since`
 * governance, where current public exports are compared against checked-in
 * release snapshots.
 *
 * @since 0.0.0
 * @category models
 */
export class PublicExportDoc extends Data.Class<{
  readonly exportName: string
  readonly kind: PublicExportKind
  readonly since: string | null
  readonly category: string | null
}> {}

/**
 * Package manifest entrypoint that contributes one consumer-facing public module.
 *
 * @since 0.0.0
 * @category models
 */
export class PackagePublicEntrypoint extends Data.Class<{
  readonly packageName: string
  readonly releasedVersion: string
  readonly subpath: string
  readonly sourceFile: SourceFilePath
}> {}

/**
 * Consumer-facing export resolved from a package subpath entrypoint.
 *
 * This is the semantic public surface after `package.json` exports and the
 * TypeScript checker have resolved barrels, aliases, and re-exports.
 *
 * @since 0.0.0
 * @category models
 */
export class PackagePublicExport extends Data.Class<{
  readonly subpath: string
  readonly exportName: string
  readonly kind: PublicExportKind
  readonly since: string | null
  readonly category: string | null
}> {}

/**
 * First-release truth for one consumer-visible export entry.
 *
 * @since 0.0.0
 * @category models
 */
export class ReleaseSinceSnapshotEntry extends Data.Class<{
  readonly subpath: string
  readonly exportName: string
  readonly kind: PublicExportKind
  readonly firstReleasedIn: string
}> {}

/**
 * Checked-in release snapshot for a versioned package surface.
 *
 * @since 0.0.0
 * @category models
 */
export class ReleaseSinceSnapshot extends Data.Class<{
  readonly packageName: string
  readonly releasedVersion: string
  readonly exports: ReadonlyArray<ReleaseSinceSnapshotEntry>
}> {}

/**
 * One failed release-governance rule for a public export entry.
 *
 * @since 0.0.0
 * @category models
 */
export class ReleaseSinceGovernanceFinding extends Data.Class<{
  readonly subpath: string
  readonly exportName: string
  readonly kind: PublicExportKind
  readonly issue: "missing-category" | "missing-since" | "mismatched-since"
  readonly expectedSince: string
  readonly actualSince: string | null
}> {}
