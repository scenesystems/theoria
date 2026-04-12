import { Option, Schema } from "effect"

import { EntryPresentation } from "../../entry/routing.js"

import { PackageDocsLandingPageRoute, PackageDocsPackagePageRoute, type PackageDocsPageRoute } from "./page-route.js"
import { type PackageName } from "./shared.js"

export class PackageDocsPresentation extends Schema.Class<PackageDocsPresentation>("PackageDocsPresentation")({
  canonicalPath: Schema.String,
  description: Schema.String,
  metadataDescription: Schema.String,
  metadataTitle: Schema.String,
  title: Schema.String
}) {
  static defaultMetadataDescription(): string {
    return "Source-linked package reference projected from the canonical Theoria release surfaces."
  }

  static defaultSurfaceDescription(): string {
    return "Source-linked package reference for a shipped capability surface inside Theoria."
  }

  static navigationTitle(): string {
    return "Capability Packages"
  }

  static sharedCapabilityMetadataSuffix(): string {
    return "Source-linked package reference, examples, release snapshots, and proof commands for the shared capability surface."
  }

  static studyEntryLabel(): string {
    return "Study Entry"
  }

  static metadataDescription(packageDescription: string | null): string {
    return packageDescription === null
      ? PackageDocsPresentation.defaultMetadataDescription()
      : `${packageDescription} ${PackageDocsPresentation.sharedCapabilityMetadataSuffix()}`
  }

  static project(route: PackageDocsPageRoute): PackageDocsPresentation {
    const packageId = route.selectedPackageId()

    return Option.match(Option.fromNullable(packageId).pipe(Option.flatMap(EntryPresentation.fromPackageName)), {
      onNone: () =>
        PackageDocsPresentation.make({
          canonicalPath: route.path(),
          description: PackageDocsPresentation.surfaceDescription(null),
          metadataDescription: PackageDocsPresentation.metadataDescription(null),
          metadataTitle: `${packageId ?? "Package"} Docs — Theoria`,
          title: `${packageId ?? "Package"} Docs`
        }),
      onSome: (presentation) =>
        PackageDocsPresentation.make({
          canonicalPath: route.path(),
          description: PackageDocsPresentation.surfaceDescription(presentation.description),
          metadataDescription: PackageDocsPresentation.metadataDescription(presentation.description),
          metadataTitle: `${presentation.title} Docs — Theoria`,
          title: `${presentation.title} Docs`
        })
    })
  }

  static projectPackage(packageId: PackageName | null): PackageDocsPresentation {
    return PackageDocsPresentation.project(
      packageId === null
        ? PackageDocsLandingPageRoute.landing()
        : PackageDocsPackagePageRoute.fromPackageId(packageId)
    )
  }

  static surfaceDescription(packageDescription: string | null): string {
    return packageDescription ?? PackageDocsPresentation.defaultSurfaceDescription()
  }
}
