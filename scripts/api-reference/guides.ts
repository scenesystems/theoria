import { Array as Arr, Option, Schema } from "effect"
import type { Heading, RootContent } from "mdast"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"

import { type DocsGuideSummary, type DocsSearchEntry, type GuideBlock, type GuidePage } from "@theoria/docs-model"
import { guideBlock, guideSlug, inlineParts, inlineText } from "./guide-markdown.js"
import { type ApiSourcePackage } from "./source.js"

type MarkdownSection = {
  readonly title: string
  readonly nodes: ReadonlyArray<RootContent>
}

type SectionAccumulator = {
  readonly intro: ReadonlyArray<RootContent>
  readonly sections: ReadonlyArray<MarkdownSection>
}

export const PackageGuideExample = Schema.Struct({
  source: Schema.String,
  title: Schema.String
})

export type PackageGuideExample = typeof PackageGuideExample.Type

const headingText = (heading: Heading, packageSlug: string, revision: string): string =>
  inlineText(inlineParts(heading.children, packageSlug, revision))

const splitSections = (
  nodes: ReadonlyArray<RootContent>,
  packageSlug: string,
  revision: string
): SectionAccumulator =>
  Arr.reduce(nodes, { intro: [], sections: [] }, (acc: SectionAccumulator, node): SectionAccumulator => {
    if (node.type === "heading" && node.depth === 2) {
      return {
        ...acc,
        sections: Arr.append(acc.sections, {
          title: headingText(node, packageSlug, revision),
          nodes: []
        })
      }
    }

    if (node.type === "heading" && node.depth === 1) {
      return acc
    }

    const last = Arr.last(acc.sections)

    return Option.match(last, {
      onNone: () => ({ ...acc, intro: Arr.append(acc.intro, node) }),
      onSome: (section) => ({
        ...acc,
        sections: [
          ...acc.sections.slice(0, -1),
          { ...section, nodes: Arr.append(section.nodes, node) }
        ]
      })
    })
  })

const blocksFor = (
  nodes: ReadonlyArray<RootContent>,
  packageSlug: string,
  revision: string
): ReadonlyArray<GuideBlock> => Arr.getSomes(Arr.map(nodes, (node) => guideBlock({ node, packageSlug, revision })))

const blockText = (block: GuideBlock): string =>
  block.kind === "paragraph" || block.kind === "quote"
    ? inlineText(block.parts)
    : block.kind === "list"
    ? inlineText(block.items[0] ?? [])
    : ""

const summaryFor = (blocks: ReadonlyArray<GuideBlock>, fallback: string): string =>
  Option.getOrElse(
    Arr.findFirst(Arr.map(blocks, blockText), (text) => text.trim().length > 0),
    () => fallback
  )

const excludedGuide = (title: string): boolean =>
  /^(?:status|contributing(?: and support)?|contribution and support|attribution|license)$/iu.test(title.trim())

const gettingStartedSection = (title: string): boolean =>
  /^(?:installation|basic use|minimal (?:example|study))$/iu.test(title.trim())

const examplesSection = (title: string): boolean => /^examples(?: and reference)?$/iu.test(title.trim())

const includesCode = (blocks: ReadonlyArray<GuideBlock>): boolean => Arr.some(blocks, (block) => block.kind === "code")

export const enrichGuideBlocks = (
  title: string,
  blocks: ReadonlyArray<GuideBlock>,
  example: Option.Option<PackageGuideExample>
): ReadonlyArray<GuideBlock> =>
  examplesSection(title) && !includesCode(blocks)
    ? Option.match(example, {
      onNone: () => blocks,
      onSome: (value): ReadonlyArray<GuideBlock> => [
        { kind: "heading", depth: 3, id: guideSlug(value.title), text: value.title },
        { kind: "code", language: "ts", source: value.source },
        ...blocks
      ]
    })
    : blocks

const guideAsset = (revision: string, packageSlug: string, slug: string): string =>
  `/docs-data/${revision}/packages/${packageSlug}/guides/${slug.length === 0 ? "overview" : slug}.json`

const guidePath = (packageSlug: string, slug: string): string =>
  `/docs/${packageSlug}${slug.length === 0 ? "" : `/${slug}`}`

const makePage = (input: {
  readonly sourcePackage: ApiSourcePackage
  readonly revision: string
  readonly title: string
  readonly slug: string
  readonly blocks: ReadonlyArray<GuideBlock>
}): GuidePage => ({
  schemaVersion: 1,
  kind: "guide",
  path: guidePath(input.sourcePackage.directoryName, input.slug),
  package: {
    name: input.sourcePackage.manifest.name,
    version: input.sourcePackage.manifest.version,
    slug: input.sourcePackage.directoryName,
    description: input.sourcePackage.description
  },
  title: input.title,
  summary: summaryFor(input.blocks, input.sourcePackage.description),
  sourceUrl:
    `https://github.com/scenesystems/theoria/blob/${input.revision}/packages/${input.sourcePackage.directoryName}/README.md`,
  blocks: input.blocks,
  anchors: Arr.filterMap(input.blocks, (block) =>
    block.kind === "heading"
      ? Option.some({ id: block.id, label: block.text, depth: block.depth })
      : Option.none())
})

const summaryForPage = (revision: string, page: GuidePage, slug: string): DocsGuideSummary => ({
  slug,
  title: page.title,
  summary: page.summary,
  path: page.path,
  asset: guideAsset(revision, page.package.slug, slug)
})

const searchEntry = (page: GuidePage, slug: string): DocsSearchEntry => ({
  id: `${page.package.slug}/guide/${slug.length === 0 ? "overview" : slug}`,
  kind: slug.length === 0 ? "package" : "guide",
  package: page.package.name,
  packageSlug: page.package.slug,
  name: page.title,
  qualifiedName: slug.length === 0 ? page.package.name : `${page.package.name} / ${page.title}`,
  category: slug.length === 0 ? null : "guide",
  summary: page.summary,
  path: page.path,
  anchor: null
})

export const buildPackageGuides = (input: {
  readonly example: Option.Option<PackageGuideExample>
  readonly markdown: string
  readonly revision: string
  readonly sourcePackage: ApiSourcePackage
}) => {
  const root = unified().use(remarkParse).use(remarkGfm).parse(input.markdown)
  const split = splitSections(root.children, input.sourcePackage.directoryName, input.revision)
  const overview = makePage({
    ...input,
    title: input.sourcePackage.manifest.name,
    slug: "",
    blocks: blocksFor(split.intro, input.sourcePackage.directoryName, input.revision)
  })
  const publicSections = Arr.filter(split.sections, (section) => !excludedGuide(section.title))
  const gettingSections = Arr.filter(publicSections, (section) => gettingStartedSection(section.title))
  const gettingBlocks = Arr.flatMap(gettingSections, (section): ReadonlyArray<GuideBlock> => [
    { kind: "heading", depth: 2, id: guideSlug(section.title), text: section.title },
    ...blocksFor(section.nodes, input.sourcePackage.directoryName, input.revision)
  ])
  const gettingStarted = makePage({
    ...input,
    title: "Getting started",
    slug: "getting-started",
    blocks: gettingBlocks
  })
  const guidePages = Arr.map(
    Arr.filter(publicSections, (section) => !gettingStartedSection(section.title)),
    (section) =>
      makePage({
        ...input,
        title: section.title,
        slug: guideSlug(section.title),
        blocks: enrichGuideBlocks(
          section.title,
          blocksFor(section.nodes, input.sourcePackage.directoryName, input.revision),
          input.example
        )
      })
  )
  const pages = [overview, gettingStarted, ...guidePages]
  const slugs = ["", "getting-started", ...Arr.map(guidePages, (page) => guideSlug(page.title))]

  return {
    pages,
    overview: summaryForPage(input.revision, overview, ""),
    guides: Arr.map(
      Arr.zip(slugs.slice(1), pages.slice(1)),
      ([slug, page]) => summaryForPage(input.revision, page, slug)
    ),
    searchEntries: Arr.map(Arr.zip(slugs, pages), ([slug, page]) => searchEntry(page, slug))
  }
}
