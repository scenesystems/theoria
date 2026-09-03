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
 * Distinguishes value, type-only, namespace, and default exports during public-surface inspection.
 *
 * @since 0.0.0
 * @category models
 */
export type PublicExportKind = "default" | "namespace" | "type" | "value"

/**
 * JSDoc summary and organization tags found on one exported declaration.
 *
 * @since 0.0.0
 * @category models
 */
export class PublicExportDoc extends Data.Class<{
  readonly exportName: string
  readonly kind: PublicExportKind
  readonly summary: string | null
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
  readonly sourceFile: SourceFilePath
  readonly summary: string | null
  readonly since: string | null
  readonly category: string | null
}> {}
