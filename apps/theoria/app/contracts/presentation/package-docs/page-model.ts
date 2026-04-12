import { type PackageName, PackageNameSchema } from "@theoria/source-proof/contracts"
import { Schema } from "effect"
import * as Option from "effect/Option"

import { Card } from "../../entry/card.js"
import { EntryId } from "../../entry/id.js"
import { EntryRegistry } from "../../entry/registry.js"

import { PackageDocsPackagePageRoute } from "./page-route.js"
import { PackageDocsPresentation } from "./presentation.js"
import type { PackageDocsBundle, PackageDocsCatalogEntry } from "./shared.js"

const entryRegistry = EntryRegistry.current()

export class PackageDocsNavigationItem extends Schema.Class<PackageDocsNavigationItem>("PackageDocsNavigationItem")({
  href: Schema.String,
  label: Schema.String,
  packageId: PackageNameSchema,
  selected: Schema.Boolean
}) {
  static projectCatalog(input: {
    readonly catalog: ReadonlyArray<PackageDocsCatalogEntry>
    readonly selectedPackageId: PackageName | null
  }): ReadonlyArray<PackageDocsNavigationItem> {
    return input.catalog.map((entry) =>
      PackageDocsNavigationItem.make({
        href: PackageDocsPackagePageRoute.fromPackageId(entry.packageId).path(),
        label: entry.packageId,
        packageId: entry.packageId,
        selected: entry.packageId === input.selectedPackageId
      })
    )
  }
}

export class PackageDocsLink extends Schema.Class<PackageDocsLink>("PackageDocsLink")({
  external: Schema.Boolean,
  href: Schema.String,
  label: Schema.String
}) {}

type SourceBackedBlock = {
  readonly content: string
  readonly id: string
  readonly source: {
    readonly path: string
  }
}

const PackageDocsSectionFields = {
  content: Schema.String,
  id: Schema.String,
  sourceHref: Schema.String,
  sourceLabel: Schema.String,
  title: Schema.String
}

export class PackageDocsCodeSection
  extends Schema.TaggedClass<PackageDocsCodeSection>()("code", PackageDocsSectionFields)
{
  static fromBlock(title: string, section: SourceBackedBlock): PackageDocsCodeSection {
    return PackageDocsCodeSection.make({
      content: section.content,
      id: section.id,
      sourceHref: PackageDocsPageModel.repositorySourceHref(section.source.path),
      sourceLabel: section.source.path,
      title
    })
  }
}

export class PackageDocsProseSection extends Schema.TaggedClass<PackageDocsProseSection>()(
  "prose",
  PackageDocsSectionFields
) {
  static fromBlock(title: string, section: SourceBackedBlock): PackageDocsProseSection {
    return PackageDocsProseSection.make({
      content: section.content,
      id: section.id,
      sourceHref: PackageDocsPageModel.repositorySourceHref(section.source.path),
      sourceLabel: section.source.path,
      title
    })
  }
}

export const PackageDocsSection = Schema.Union(PackageDocsCodeSection, PackageDocsProseSection)

export type PackageDocsSection = typeof PackageDocsSection.Type

export class PackageDocsGroup extends Schema.Class<PackageDocsGroup>("PackageDocsGroup")({
  sections: Schema.Array(PackageDocsSection),
  title: Schema.String
}) {
  static fromSections(title: string, sections: ReadonlyArray<PackageDocsSection>): ReadonlyArray<PackageDocsGroup> {
    return sections.length === 0 ? [] : [PackageDocsGroup.make({ title, sections })]
  }
}

export class PackageDocsSummaryItem extends Schema.Class<PackageDocsSummaryItem>("PackageDocsSummaryItem")({
  label: Schema.String,
  value: Schema.String
}) {
  static summarize(label: string, value: string): PackageDocsSummaryItem {
    return PackageDocsSummaryItem.make({ label, value })
  }
}

export class PackageDocsPageModel extends Schema.Class<PackageDocsPageModel>("PackageDocsPageModel")({
  description: Schema.String,
  entryId: Schema.NullOr(EntryId),
  groups: Schema.Array(PackageDocsGroup),
  links: Schema.Array(PackageDocsLink),
  navigation: Schema.Array(PackageDocsNavigationItem),
  packageId: PackageNameSchema,
  summary: Schema.Array(PackageDocsSummaryItem),
  title: Schema.String,
  version: Schema.String
}) {
  static project(input: {
    readonly bundle: PackageDocsBundle
    readonly catalog: ReadonlyArray<PackageDocsCatalogEntry>
    readonly selectedPackageId: PackageName
  }): PackageDocsPageModel {
    const card = Option.getOrNull(Card.forPackageName(input.bundle.packageId))
    const entryId = Option.getOrNull(entryRegistry.entryIdForPackageName(input.bundle.packageId))
    const presentation = PackageDocsPresentation.project(
      PackageDocsPackagePageRoute.fromPackageId(input.bundle.packageId)
    )

    return PackageDocsPageModel.make({
      description: presentation.description,
      entryId,
      groups: [
        ...PackageDocsGroup.fromSections(
          "README",
          input.bundle.readme.blocks.map((block) => PackageDocsProseSection.fromBlock(block.title, block))
        ),
        ...PackageDocsGroup.fromSections(
          "Module Docs",
          input.bundle.moduleDocs.flatMap((document) =>
            document.blocks.map((block) =>
              PackageDocsProseSection.fromBlock(`${document.title} — ${block.title}`, block)
            )
          )
        ),
        ...PackageDocsGroup.fromSections(
          "Examples",
          input.bundle.examples.map((example) => PackageDocsCodeSection.fromBlock(example.title, example.block))
        ),
        ...PackageDocsGroup.fromSections(
          "Release Snapshots",
          input.bundle.releaseSnapshots.map((snapshot) =>
            PackageDocsProseSection.fromBlock(snapshot.block.title, snapshot.block)
          )
        ),
        ...PackageDocsGroup.fromSections(
          "Proof Commands",
          input.bundle.proofCommands.map((command) =>
            PackageDocsCodeSection.fromBlock(command.block.title, command.block)
          )
        )
      ],
      links: card === null
        ? []
        : [
          PackageDocsLink.make({ external: true, href: card.npmUrl, label: "npm" }),
          PackageDocsLink.make({ external: true, href: card.repoUrl, label: "Repository" }),
          PackageDocsLink.make({
            external: false,
            href: card.deepDivePath,
            label: PackageDocsPresentation.studyEntryLabel()
          })
        ],
      navigation: PackageDocsNavigationItem.projectCatalog({
        catalog: input.catalog,
        selectedPackageId: input.selectedPackageId
      }),
      packageId: input.bundle.packageId,
      summary: [
        PackageDocsSummaryItem.summarize("Version", input.bundle.version),
        PackageDocsSummaryItem.summarize("Module Docs", String(input.bundle.moduleDocs.length)),
        PackageDocsSummaryItem.summarize("Examples", String(input.bundle.examples.length)),
        PackageDocsSummaryItem.summarize("Release Snapshots", String(input.bundle.releaseSnapshots.length)),
        PackageDocsSummaryItem.summarize("Proof Commands", String(input.bundle.proofCommands.length))
      ],
      title: presentation.title,
      version: input.bundle.version
    })
  }

  static repositorySourceHref(path: string): string {
    return `https://github.com/scenesystems/theoria/blob/main/${path}`
  }
}
