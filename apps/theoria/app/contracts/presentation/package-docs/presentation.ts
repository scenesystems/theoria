import { Match, Option, Schema } from "effect"

import { entryPresentationForPackageName } from "../../entry/routing.js"

import {
  packageDocsPagePath,
  type PackageDocsPageRoute,
  packageDocsPageRoute,
  packageDocsSelectedPackageId
} from "./page-route.js"
import { NonEmptyString, type PackageName } from "./shared.js"

export class PackageDocsPresentation extends Schema.Class<PackageDocsPresentation>("PackageDocsPresentation")({
  canonicalPath: Schema.String,
  description: Schema.String,
  metadataDescription: Schema.String,
  metadataTitle: Schema.String,
  title: Schema.String
}) {}

export const PackageDocsPresentationCopy = Schema.Struct({
  navigationTitle: Schema.Literal("Capability Packages"),
  studyEntryLabel: Schema.Literal("Study Entry"),
  defaultMetadataDescription: NonEmptyString,
  defaultSurfaceDescription: NonEmptyString,
  sharedCapabilityMetadataSuffix: NonEmptyString
})

export type PackageDocsPresentationCopy = typeof PackageDocsPresentationCopy.Type

export const packageDocsPresentationCopy: PackageDocsPresentationCopy = {
  navigationTitle: "Capability Packages",
  studyEntryLabel: "Study Entry",
  defaultMetadataDescription: "Source-linked package reference projected from the canonical Theoria release surfaces.",
  defaultSurfaceDescription: "Source-linked package reference for a shipped capability surface inside Theoria.",
  sharedCapabilityMetadataSuffix:
    "Source-linked package reference, examples, release snapshots, and proof commands for the shared capability surface."
}

export const packageDocsMetadataDescription = (packageDescription: string | null): string =>
  packageDescription === null
    ? packageDocsPresentationCopy.defaultMetadataDescription
    : `${packageDescription} ${packageDocsPresentationCopy.sharedCapabilityMetadataSuffix}`

export const packageDocsSurfaceDescription = (packageDescription: string | null): string =>
  packageDescription ?? packageDocsPresentationCopy.defaultSurfaceDescription

const defaultPackageDocsPresentation = (
  route: PackageDocsPageRoute,
  packageId: PackageName | null
): PackageDocsPresentation =>
  PackageDocsPresentation.make({
    canonicalPath: packageDocsPagePath(route),
    description: packageDocsSurfaceDescription(null),
    metadataDescription: packageDocsMetadataDescription(null),
    metadataTitle: `${packageId ?? "Package"} Docs — Theoria`,
    title: `${packageId ?? "Package"} Docs`
  })

export const packageDocsPresentationForRoute = (route: PackageDocsPageRoute): PackageDocsPresentation => {
  const packageId = packageDocsSelectedPackageId(route)

  return Option.match(Option.fromNullable(packageId).pipe(Option.flatMap(entryPresentationForPackageName)), {
    onNone: () => defaultPackageDocsPresentation(route, packageId),
    onSome: (presentation) =>
      PackageDocsPresentation.make({
        canonicalPath: packageDocsPagePath(route),
        description: packageDocsSurfaceDescription(presentation.description),
        metadataDescription: packageDocsMetadataDescription(presentation.description),
        metadataTitle: `${presentation.title} Docs — Theoria`,
        title: `${presentation.title} Docs`
      })
  })
}

export const packageDocsPresentationForPackage = (packageId: PackageName | null): PackageDocsPresentation =>
  Match.value(packageId).pipe(
    Match.when(null, () => packageDocsPresentationForRoute(packageDocsPageRoute(null))),
    Match.orElse((resolvedPackageId) => packageDocsPresentationForRoute(packageDocsPageRoute(resolvedPackageId)))
  )
