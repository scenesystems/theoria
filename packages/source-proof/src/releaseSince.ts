import { Array as Arr, Option, Schema } from "effect"

import {
  type PublicExportKind,
  ReleaseSinceGovernanceFinding,
  ReleaseSinceSnapshot,
  ReleaseSinceSnapshotEntry
} from "./model.js"
import type { PackagePublicExport } from "./model.js"
import { releaseSinceSnapshotKey } from "./publicExports.js"

/**
 * Schema for public-export kinds stored in checked-in release snapshots.
 *
 * @since 0.0.0
 * @category schemas
 */
export const PublicExportKindSchema = Schema.Literal("default", "namespace", "type", "value")

/**
 * Schema for one checked-in release-snapshot export entry.
 *
 * @since 0.0.0
 * @category schemas
 */
export const ReleaseSinceSnapshotEntrySchema = Schema.Struct({
  subpath: Schema.String,
  exportName: Schema.String,
  kind: PublicExportKindSchema,
  firstReleasedIn: Schema.String
})

/**
 * Schema for a checked-in package release snapshot.
 *
 * @since 0.0.0
 * @category schemas
 */
export const ReleaseSinceSnapshotSchema = Schema.Struct({
  packageName: Schema.String,
  releasedVersion: Schema.String,
  exports: Schema.Array(ReleaseSinceSnapshotEntrySchema)
})

/**
 * JSON decoder schema for checked-in release snapshots.
 *
 * @since 0.0.0
 * @category schemas
 */
export const ReleaseSinceSnapshotJson = Schema.parseJson(ReleaseSinceSnapshotSchema)

const compareReleaseVersion = (left: string, right: string): number => {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10))
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10))
  const maxLength = Math.max(leftParts.length, rightParts.length)

  return Arr.findFirst(
    Arr.makeBy(maxLength, (index) => index),
    (index) => (leftParts[index] ?? 0) !== (rightParts[index] ?? 0)
  ).pipe(
    Option.match({
      onNone: () => 0,
      onSome: (index) => (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    })
  )
}

const snapshotKey = (input: {
  readonly subpath: string
  readonly exportName: string
  readonly kind: PublicExportKind
}): string => releaseSinceSnapshotKey(input)

const firstReleasedVersionByKey = (
  snapshots: ReadonlyArray<ReleaseSinceSnapshot>
): Readonly<{ readonly [key: string]: string }> =>
  Arr.fromIterable(snapshots)
    .sort((left, right) => compareReleaseVersion(left.releasedVersion, right.releasedVersion))
    .reduce<{ readonly [key: string]: string }>((accumulator, snapshot) =>
      Arr.fromIterable(snapshot.exports).reduce<{ readonly [key: string]: string }>((entries, entry) => {
        const key = snapshotKey(entry)

        return key in entries
          ? entries
          : { ...entries, [key]: entry.firstReleasedIn }
      }, accumulator), {})

const expectedSince = (
  snapshotVersions: Readonly<{ readonly [key: string]: string }>,
  currentVersion: string,
  entry: PackagePublicExport
): string => snapshotVersions[snapshotKey(entry)] ?? currentVersion

const dedupeSnapshotEntries = (
  entries: ReadonlyArray<ReleaseSinceSnapshotEntry>
): ReadonlyArray<ReleaseSinceSnapshotEntry> =>
  Arr.fromIterable(entries)
    .sort((left, right) => snapshotKey(left).localeCompare(snapshotKey(right)))
    .reduce((accumulator, entry) =>
      accumulator.some((existing) => snapshotKey(existing) === snapshotKey(entry))
        ? accumulator
        : [...accumulator, entry], new Array<ReleaseSinceSnapshotEntry>())

/**
 * Stamps the next checked-in release snapshot from current public-export truth.
 *
 * Existing snapshot entries preserve first-release history; exports not seen in
 * prior snapshots are stamped with the current package release version.
 *
 * @since 0.0.0
 * @category constructors
 */
export const stampReleaseSinceSnapshot = (input: {
  readonly packageName: string
  readonly releasedVersion: string
  readonly exports: ReadonlyArray<PackagePublicExport>
  readonly previousSnapshots: ReadonlyArray<ReleaseSinceSnapshot>
}): ReleaseSinceSnapshot => {
  const versionsByKey = firstReleasedVersionByKey(input.previousSnapshots)

  return new ReleaseSinceSnapshot({
    packageName: input.packageName,
    releasedVersion: input.releasedVersion,
    exports: dedupeSnapshotEntries(
      Arr.map(input.exports, (entry) =>
        new ReleaseSinceSnapshotEntry({
          subpath: entry.subpath,
          exportName: entry.exportName,
          kind: entry.kind,
          firstReleasedIn: expectedSince(versionsByKey, input.releasedVersion, entry)
        }))
    )
  })
}

/**
 * Verifies release-accurate `@since` and `@category` metadata for a public surface.
 *
 * @since 0.0.0
 * @category queries
 */
export const verifyReleaseSince = (input: {
  readonly currentVersion: string
  readonly exports: ReadonlyArray<PackagePublicExport>
  readonly snapshots: ReadonlyArray<ReleaseSinceSnapshot>
}): ReadonlyArray<ReleaseSinceGovernanceFinding> => {
  const versionsByKey = firstReleasedVersionByKey(input.snapshots)

  return Arr.fromIterable(input.exports)
    .flatMap((entry) => {
      const requiredSince = expectedSince(versionsByKey, input.currentVersion, entry)
      const candidates = [
        entry.since === null
          ? Option.some(
            new ReleaseSinceGovernanceFinding({
              subpath: entry.subpath,
              exportName: entry.exportName,
              kind: entry.kind,
              issue: "missing-since",
              expectedSince: requiredSince,
              actualSince: entry.since
            })
          )
          : Option.none<ReleaseSinceGovernanceFinding>(),
        entry.since !== null && entry.since !== requiredSince
          ? Option.some(
            new ReleaseSinceGovernanceFinding({
              subpath: entry.subpath,
              exportName: entry.exportName,
              kind: entry.kind,
              issue: "mismatched-since",
              expectedSince: requiredSince,
              actualSince: entry.since
            })
          )
          : Option.none<ReleaseSinceGovernanceFinding>(),
        entry.category === null
          ? Option.some(
            new ReleaseSinceGovernanceFinding({
              subpath: entry.subpath,
              exportName: entry.exportName,
              kind: entry.kind,
              issue: "missing-category",
              expectedSince: requiredSince,
              actualSince: entry.since
            })
          )
          : Option.none<ReleaseSinceGovernanceFinding>()
      ]

      return Arr.filterMap(candidates, (finding) => finding)
    })
    .sort((left, right) =>
      `${left.subpath}::${left.exportName}::${left.kind}::${left.issue}`.localeCompare(
        `${right.subpath}::${right.exportName}::${right.kind}::${right.issue}`
      )
    )
}
