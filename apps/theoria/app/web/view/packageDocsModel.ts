import type { PackageName } from "@theoria/source-proof/contracts"
import * as Option from "effect/Option"

import { cardForPackageName } from "../../contracts/entry/card.js"
import { entryIdForPackageName } from "../../contracts/entry/registry.js"
import {
  type PackageDocsBundle,
  type PackageDocsCatalogEntry,
  PackageDocsCodeSection,
  PackageDocsGroup,
  PackageDocsLink,
  PackageDocsNavigationItem,
  packageDocsPackagePageRoute,
  PackageDocsPageModel,
  packageDocsPagePath,
  packageDocsPresentationCopy,
  packageDocsPresentationForRoute,
  PackageDocsProseSection,
  type PackageDocsSection,
  PackageDocsSummaryItem
} from "../../contracts/presentation/package-docs.js"

const repositorySourceHref = (path: string): string => `https://github.com/scenesystems/theoria/blob/main/${path}`

const proseSection = (
  title: string,
  section: {
    readonly content: string
    readonly id: string
    readonly source: {
      readonly path: string
    }
  }
): PackageDocsSection =>
  PackageDocsProseSection.make({
    content: section.content,
    id: section.id,
    sourceHref: repositorySourceHref(section.source.path),
    sourceLabel: section.source.path,
    title
  })

const codeSection = (
  title: string,
  section: {
    readonly content: string
    readonly id: string
    readonly source: {
      readonly path: string
    }
  }
): PackageDocsSection =>
  PackageDocsCodeSection.make({
    content: section.content,
    id: section.id,
    sourceHref: repositorySourceHref(section.source.path),
    sourceLabel: section.source.path,
    title
  })

const groupIfAny = (title: string, sections: ReadonlyArray<PackageDocsSection>): ReadonlyArray<PackageDocsGroup> =>
  sections.length === 0 ? [] : [PackageDocsGroup.make({ title, sections })]

export const packageDocsNavigationModel = (input: {
  readonly catalog: ReadonlyArray<PackageDocsCatalogEntry>
  readonly selectedPackageId: PackageName | null
}): ReadonlyArray<PackageDocsNavigationItem> =>
  input.catalog.map((entry) =>
    PackageDocsNavigationItem.make({
      href: packageDocsPagePath(packageDocsPackagePageRoute(entry.packageId)),
      label: entry.packageId,
      packageId: entry.packageId,
      selected: entry.packageId === input.selectedPackageId
    })
  )

export const packageDocsPageModel = (input: {
  readonly bundle: PackageDocsBundle
  readonly catalog: ReadonlyArray<PackageDocsCatalogEntry>
  readonly selectedPackageId: PackageName
}): PackageDocsPageModel => {
  const card = Option.getOrNull(cardForPackageName(input.bundle.packageId))
  const entryId = Option.getOrNull(entryIdForPackageName(input.bundle.packageId))
  const presentation = packageDocsPresentationForRoute(packageDocsPackagePageRoute(input.bundle.packageId))
  const navigation = packageDocsNavigationModel({
    catalog: input.catalog,
    selectedPackageId: input.selectedPackageId
  })
  const readmeSections = input.bundle.readme.blocks.map((block) => proseSection(block.title, block))
  const moduleSections = input.bundle.moduleDocs.flatMap((document) =>
    document.blocks.map((block) => proseSection(`${document.title} — ${block.title}`, block))
  )
  const exampleSections = input.bundle.examples.map((example) => codeSection(example.title, example.block))
  const snapshotSections = input.bundle.releaseSnapshots.map((snapshot) =>
    proseSection(snapshot.block.title, snapshot.block)
  )
  const proofSections = input.bundle.proofCommands.map((command) => codeSection(command.block.title, command.block))
  const links: ReadonlyArray<PackageDocsLink> = card === null
    ? []
    : [
      PackageDocsLink.make({ external: true, href: card.npmUrl, label: "npm" }),
      PackageDocsLink.make({ external: true, href: card.repoUrl, label: "Repository" }),
      PackageDocsLink.make({
        external: false,
        href: card.deepDivePath,
        label: packageDocsPresentationCopy.studyEntryLabel
      })
    ]

  return PackageDocsPageModel.make({
    description: presentation.description,
    entryId,
    groups: [
      ...groupIfAny("README", readmeSections),
      ...groupIfAny("Module Docs", moduleSections),
      ...groupIfAny("Examples", exampleSections),
      ...groupIfAny("Release Snapshots", snapshotSections),
      ...groupIfAny("Proof Commands", proofSections)
    ],
    links,
    navigation,
    packageId: input.bundle.packageId,
    summary: [
      PackageDocsSummaryItem.make({ label: "Version", value: input.bundle.version }),
      PackageDocsSummaryItem.make({ label: "Module Docs", value: String(input.bundle.moduleDocs.length) }),
      PackageDocsSummaryItem.make({ label: "Examples", value: String(input.bundle.examples.length) }),
      PackageDocsSummaryItem.make({
        label: "Release Snapshots",
        value: String(input.bundle.releaseSnapshots.length)
      }),
      PackageDocsSummaryItem.make({ label: "Proof Commands", value: String(input.bundle.proofCommands.length) })
    ],
    title: presentation.title,
    version: input.bundle.version
  })
}
