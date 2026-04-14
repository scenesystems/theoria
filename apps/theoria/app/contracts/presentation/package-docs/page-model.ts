import {
  type PackageDocsCodeLanguage,
  PackageDocsCodeLanguageSchema,
  PackageDocsRichTextDocument,
  PackageDocsRichTextTextNode,
  type PackageName,
  PackageNameSchema
} from "@theoria/source-proof/contracts"
import { Schema } from "effect"

import { Card } from "../../entry/card.js"
import { EntryId } from "../../entry/id.js"

import { PackageDocsPackagePageRoute } from "./page-route.js"
import { PackageDocsPresentation } from "./presentation.js"
import { packageDocsSectionFragmentId } from "./section-fragment.js"
import type { PackageDocsBundle, PackageDocsCatalogEntry } from "./shared.js"

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
  readonly contentDocument: PackageDocsRichTextDocument | null
  readonly id: string
  readonly language: PackageDocsCodeLanguage | null
  readonly source: {
    readonly anchor: string | null
    readonly path: string
  }
  readonly title: string
  readonly titleDocument: PackageDocsRichTextDocument
}

const prefixedTitleDocument = (
  titlePrefix: string,
  document: PackageDocsRichTextDocument
): PackageDocsRichTextDocument =>
  titlePrefix.length === 0
    ? document
    : PackageDocsRichTextDocument.make({
      children: [
        PackageDocsRichTextTextNode.make({ value: `${titlePrefix} — ` }),
        ...document.children
      ]
    })

const PackageDocsSectionFields = {
  content: Schema.String,
  fragmentId: Schema.String,
  id: Schema.String,
  sourceHref: Schema.String,
  sourceLabel: Schema.String,
  title: Schema.String,
  titleDocument: PackageDocsRichTextDocument
}

export class PackageDocsCodeSection extends Schema.TaggedClass<PackageDocsCodeSection>()("code", {
  ...PackageDocsSectionFields,
  language: PackageDocsCodeLanguageSchema
}) {
  static fromBlock(
    input: { readonly section: SourceBackedBlock; readonly titlePrefix?: string }
  ): PackageDocsCodeSection {
    const titlePrefix = input.titlePrefix ?? ""
    const title = titlePrefix.length === 0 ? input.section.title : `${titlePrefix} — ${input.section.title}`

    return PackageDocsCodeSection.make({
      content: input.section.content,
      fragmentId: packageDocsSectionFragmentId({
        sourceAnchor: input.section.source.anchor,
        sourcePath: input.section.source.path
      }),
      id: input.section.id,
      language: input.section.language ?? "plain",
      sourceHref: PackageDocsPageModel.repositorySourceHref(input.section.source.path),
      sourceLabel: input.section.source.path,
      title,
      titleDocument: prefixedTitleDocument(titlePrefix, input.section.titleDocument)
    })
  }
}

export class PackageDocsProseSection extends Schema.TaggedClass<PackageDocsProseSection>()(
  "prose",
  {
    ...PackageDocsSectionFields,
    content: PackageDocsRichTextDocument
  }
) {
  static fromBlock(
    input: { readonly section: SourceBackedBlock; readonly titlePrefix?: string }
  ): PackageDocsProseSection {
    const titlePrefix = input.titlePrefix ?? ""
    const title = titlePrefix.length === 0 ? input.section.title : `${titlePrefix} — ${input.section.title}`

    return PackageDocsProseSection.make({
      content: input.section.contentDocument ?? PackageDocsRichTextDocument.make({ children: [] }),
      fragmentId: packageDocsSectionFragmentId({
        sourceAnchor: input.section.source.anchor,
        sourcePath: input.section.source.path
      }),
      id: input.section.id,
      sourceHref: PackageDocsPageModel.repositorySourceHref(input.section.source.path),
      sourceLabel: input.section.source.path,
      title,
      titleDocument: prefixedTitleDocument(titlePrefix, input.section.titleDocument)
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
    const card = Card.forPackageName(input.bundle.packageId).pipe(
      (option) => option._tag === "Some" ? option.value : null
    )
    const presentation = PackageDocsPresentation.project(
      PackageDocsPackagePageRoute.fromPackageId(input.bundle.packageId)
    )

    return PackageDocsPageModel.make({
      description: presentation.description,
      entryId: null,
      groups: [
        ...PackageDocsGroup.fromSections(
          "README",
          input.bundle.readme.blocks.map((block) => PackageDocsProseSection.fromBlock({ section: block }))
        ),
        ...PackageDocsGroup.fromSections(
          "Reference",
          input.bundle.moduleDocs.flatMap((document) =>
            document.blocks.map((block) =>
              PackageDocsProseSection.fromBlock({ section: block, titlePrefix: document.title })
            )
          )
        ),
        ...PackageDocsGroup.fromSections(
          "Examples",
          input.bundle.examples.map((example) => PackageDocsCodeSection.fromBlock({ section: example.block }))
        ),
        ...PackageDocsGroup.fromSections(
          "Release History",
          [...input.bundle.releaseSnapshots].reverse().map((snapshot) =>
            PackageDocsProseSection.fromBlock({ section: snapshot.block })
          )
        ),
        ...PackageDocsGroup.fromSections(
          "Verification",
          input.bundle.proofCommands.map((command) => PackageDocsCodeSection.fromBlock({ section: command.block }))
        )
      ],
      links: card === null
        ? []
        : [
          PackageDocsLink.make({ external: true, href: card.npmUrl, label: "npm" }),
          PackageDocsLink.make({ external: true, href: card.repoUrl, label: "Repository" })
        ],
      navigation: PackageDocsNavigationItem.projectCatalog({
        catalog: input.catalog,
        selectedPackageId: input.selectedPackageId
      }),
      packageId: input.bundle.packageId,
      summary: [
        PackageDocsSummaryItem.summarize("Version", input.bundle.version),
        PackageDocsSummaryItem.summarize("Reference Sections", String(input.bundle.moduleDocs.length)),
        PackageDocsSummaryItem.summarize("Examples", String(input.bundle.examples.length)),
        PackageDocsSummaryItem.summarize("Release Entries", String(input.bundle.releaseSnapshots.length)),
        PackageDocsSummaryItem.summarize("Verification Commands", String(input.bundle.proofCommands.length))
      ],
      title: presentation.title,
      version: input.bundle.version
    })
  }

  static repositorySourceHref(path: string): string {
    return `https://github.com/scenesystems/theoria/blob/main/${path}`
  }
}
