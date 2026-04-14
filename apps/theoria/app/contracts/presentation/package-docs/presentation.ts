import { Option, Schema } from "effect"

import { authorityCatalogForPackageName } from "../../capability/catalog.js"

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
    return "Source-linked package guides, examples, release history, and verification notes from the canonical Theoria package library."
  }

  static defaultSurfaceDescription(): string {
    return "Browse the package library behind Theoria's studies, workflows, and evidence surfaces."
  }

  static navigationTitle(): string {
    return "Package Library"
  }

  static sharedCapabilityMetadataSuffix(): string {
    return "Browse source-linked guides, examples, release history, and verification commands for this part of the shared study toolkit."
  }

  static studyEntryLabel(): string {
    return "Workflow Entry"
  }

  static metadataDescription(packageDescription: string | null): string {
    return packageDescription === null
      ? PackageDocsPresentation.defaultMetadataDescription()
      : `${packageDescription} ${PackageDocsPresentation.sharedCapabilityMetadataSuffix()}`
  }

  static project(route: PackageDocsPageRoute): PackageDocsPresentation {
    const packageId = route.selectedPackageId()

    return Option.match(Option.fromNullable(packageId).pipe(Option.flatMap(authorityCatalogForPackageName)), {
      onNone: () =>
        PackageDocsPresentation.make({
          canonicalPath: route.path(),
          description: PackageDocsPresentation.surfaceDescription(null),
          metadataDescription: PackageDocsPresentation.metadataDescription(null),
          metadataTitle: `${packageId ?? "Package"} Docs — Theoria`,
          title: `${packageId ?? "Package"} Docs`
        }),
      onSome: (catalog) =>
        PackageDocsPresentation.make({
          canonicalPath: route.path(),
          description: PackageDocsPresentation.surfaceDescription(catalog.description),
          metadataDescription: PackageDocsPresentation.metadataDescription(catalog.description),
          metadataTitle: `${catalog.title} Docs — Theoria`,
          title: `${catalog.title} Docs`
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
    return packageDescription === null
      ? PackageDocsPresentation.defaultSurfaceDescription()
      : `${packageDescription} Explore the package guide, examples, release history, and verification commands from one place.`
  }
}
