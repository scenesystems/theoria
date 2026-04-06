import * as Option from "effect/Option"
import { cards } from "../../contracts/card.js"
import type { PackageDocsBundle, PackageDocsCatalogEntry } from "../../contracts/package-docs.js"
import { packageDocsPagePath } from "../../contracts/package-docs.js"

type PackageDocsNavItem = {
  readonly href: string
  readonly label: string
  readonly packageId: string
  readonly selected: boolean
}

type PackageDocsLink = {
  readonly external: boolean
  readonly href: string
  readonly label: string
}

type PackageDocsSection =
  | {
    readonly _tag: "code"
    readonly content: string
    readonly id: string
    readonly sourceHref: string
    readonly sourceLabel: string
    readonly title: string
  }
  | {
    readonly _tag: "prose"
    readonly content: string
    readonly id: string
    readonly sourceHref: string
    readonly sourceLabel: string
    readonly title: string
  }

type PackageDocsGroup = {
  readonly sections: ReadonlyArray<PackageDocsSection>
  readonly title: string
}

export type PackageDocsPageModel = {
  readonly description: string
  readonly groups: ReadonlyArray<PackageDocsGroup>
  readonly links: ReadonlyArray<PackageDocsLink>
  readonly navigation: ReadonlyArray<PackageDocsNavItem>
  readonly packageId: string
  readonly summary: ReadonlyArray<readonly [label: string, value: string]>
  readonly title: string
  readonly version: string
}

const repositorySourceHref = (path: string): string => `https://github.com/scenesystems/theoria/blob/main/${path}`

const packageCard = (packageId: string) => cards.find((card) => card.packageName === packageId)

const proseSection = (
  title: string,
  section: {
    readonly content: string
    readonly id: string
    readonly source: {
      readonly path: string
    }
  }
): PackageDocsSection => ({
  _tag: "prose",
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
): PackageDocsSection => ({
  _tag: "code",
  content: section.content,
  id: section.id,
  sourceHref: repositorySourceHref(section.source.path),
  sourceLabel: section.source.path,
  title
})

const groupIfAny = (title: string, sections: ReadonlyArray<PackageDocsSection>): ReadonlyArray<PackageDocsGroup> =>
  sections.length === 0 ? [] : [{ title, sections }]

export const packageDocsPageModel = (input: {
  readonly bundle: PackageDocsBundle
  readonly catalog: ReadonlyArray<PackageDocsCatalogEntry>
  readonly selectedPackageId: string
}): PackageDocsPageModel => {
  const card = packageCard(input.bundle.packageId)
  const navigation = input.catalog.map((entry) => ({
    href: packageDocsPagePath(entry.packageId),
    label: entry.packageId,
    packageId: entry.packageId,
    selected: entry.packageId === input.selectedPackageId
  }))
  const readmeSections = input.bundle.readme.blocks.map((block) => proseSection(block.title, block))
  const moduleSections = input.bundle.moduleDocs.flatMap((document) =>
    document.blocks.map((block) => proseSection(`${document.title} — ${block.title}`, block))
  )
  const exampleSections = input.bundle.examples.map((example) => codeSection(example.title, example.block))
  const snapshotSections = input.bundle.releaseSnapshots.map((snapshot) =>
    proseSection(snapshot.block.title, snapshot.block)
  )
  const proofSections = input.bundle.proofCommands.map((command) => codeSection(command.block.title, command.block))
  const links: ReadonlyArray<PackageDocsLink> = Option.match(Option.fromNullable(card), {
    onNone: () => [],
    onSome: (resolvedCard) => [
      { external: true, href: resolvedCard.npmUrl, label: "npm" },
      { external: true, href: resolvedCard.repoUrl, label: "Repository" },
      { external: false, href: resolvedCard.deepDivePath, label: "Deep Dive" }
    ]
  })

  return {
    description: input.bundle.description ??
      (card?.description ?? "Source-linked package documentation for the shipped package surface."),
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
      ["Version", input.bundle.version],
      ["Module Docs", String(input.bundle.moduleDocs.length)],
      ["Examples", String(input.bundle.examples.length)],
      ["Release Snapshots", String(input.bundle.releaseSnapshots.length)],
      ["Proof Commands", String(input.bundle.proofCommands.length)]
    ],
    title: `${input.bundle.packageId} Docs`,
    version: input.bundle.version
  }
}
