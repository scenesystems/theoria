import { Array, Boolean, Chunk, Data, Match, Option, Schema, String } from "effect"
import type { Heading, RootContent } from "mdast"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"

import { DocsGuideSummarySchema, DocsSearchEntrySchema, type GuideBlock, GuidePageSchema } from "@theoria/docs-model"
import { guideBlock, guideSlug, inlineParts, inlineText } from "./guide-markdown.js"
import type { ApiSourcePackage } from "./source.js"

class MarkdownSection extends Data.Class<{
  readonly title: string
  readonly nodes: Chunk.Chunk<RootContent>
}> {}

class SectionAccumulator extends Data.Class<{
  readonly intro: Chunk.Chunk<RootContent>
  readonly sections: Chunk.Chunk<MarkdownSection>
}> {}

export const PackageGuideExample = Schema.Struct({
  source: Schema.String,
  title: Schema.String
})

export type PackageGuideExample = typeof PackageGuideExample.Type

class MakePageInput extends Data.Class<{
  readonly sourcePackage: ApiSourcePackage
  readonly revision: string
  readonly title: string
  readonly slug: string
  readonly blocks: typeof GuidePageSchema.Type.blocks
}> {}

class BuildPackageGuidesInput extends Data.Class<{
  readonly example: Option.Option<PackageGuideExample>
  readonly markdown: string
  readonly revision: string
  readonly sourcePackage: ApiSourcePackage
}> {}

const PackageGuideData = Schema.Struct({
  pages: Schema.Array(GuidePageSchema),
  overview: DocsGuideSummarySchema,
  guides: Schema.Array(DocsGuideSummarySchema),
  searchEntries: Schema.Array(DocsSearchEntrySchema)
})

const headingText = (heading: Heading, packageSlug: string, revision: string): string =>
  inlineText(inlineParts(heading.children, packageSlug, revision))

const splitSections = (
  nodes: Iterable<RootContent>,
  packageSlug: string,
  revision: string
): SectionAccumulator =>
  Array.reduce(
    Array.fromIterable(nodes),
    new SectionAccumulator({ intro: Chunk.empty(), sections: Chunk.empty() }),
    (accumulator, node): SectionAccumulator => {
      const appendNode = (): SectionAccumulator =>
        Option.match(Chunk.last(accumulator.sections), {
          onNone: () => new SectionAccumulator({ ...accumulator, intro: Chunk.append(accumulator.intro, node) }),
          onSome: (section) =>
            new SectionAccumulator({
              ...accumulator,
              sections: Chunk.append(
                Chunk.dropRight(accumulator.sections, 1),
                new MarkdownSection({ ...section, nodes: Chunk.append(section.nodes, node) })
              )
            })
        })

      return Match.value(node).pipe(
        Match.withReturnType<SectionAccumulator>(),
        Match.when({ type: "heading", depth: 1 }, () => accumulator),
        Match.when({ type: "heading", depth: 2 }, (heading) =>
          new SectionAccumulator({
            ...accumulator,
            sections: Chunk.append(
              accumulator.sections,
              new MarkdownSection({
                title: headingText(heading, packageSlug, revision),
                nodes: Chunk.empty()
              })
            )
          })),
        Match.when({ type: "heading", depth: Match.is(3, 4, 5, 6) }, appendNode),
        Match.when(
          {
            type: Match.is(
              "blockquote",
              "break",
              "code",
              "definition",
              "delete",
              "emphasis",
              "footnoteDefinition",
              "footnoteReference",
              "html",
              "image",
              "imageReference",
              "inlineCode",
              "link",
              "linkReference",
              "list",
              "listItem",
              "paragraph",
              "strong",
              "table",
              "tableCell",
              "tableRow",
              "text",
              "thematicBreak",
              "yaml"
            )
          },
          appendNode
        ),
        Match.exhaustive
      )
    }
  )

const blocksFor = (
  nodes: Iterable<RootContent>,
  packageSlug: string,
  revision: string
): typeof GuidePageSchema.Type.blocks =>
  Array.getSomes(Array.map(Array.fromIterable(nodes), (node) => guideBlock({ node, packageSlug, revision })))

const blockText = (block: GuideBlock): string =>
  Match.value(block).pipe(
    Match.withReturnType<string>(),
    Match.when({ kind: "paragraph" }, ({ parts }) => inlineText(parts)),
    Match.when({ kind: "quote" }, ({ parts }) => inlineText(parts)),
    Match.when({ kind: "list" }, ({ items }) => Option.getOrElse(Option.map(Array.head(items), inlineText), () => "")),
    Match.when({ kind: Match.is("code", "heading", "table") }, () => ""),
    Match.exhaustive
  )

const summaryFor = (blocks: typeof GuidePageSchema.Type.blocks, fallback: string): string =>
  Option.getOrElse(
    Array.findFirst(Array.map(blocks, blockText), (text) => String.isNonEmpty(String.trim(text))),
    () => fallback
  )

const excludedGuide = (title: string): boolean =>
  Option.isSome(
    String.match(/^(?:status|contributing(?: and support)?|contribution and support|attribution|license)$/iu)(
      String.trim(title)
    )
  )

const gettingStartedSection = (title: string): boolean =>
  Option.isSome(String.match(/^(?:installation|basic use|minimal (?:example|study))$/iu)(String.trim(title)))

const examplesSection = (title: string): boolean =>
  Option.isSome(String.match(/^examples(?: and reference)?$/iu)(String.trim(title)))

const includesCode = (blocks: typeof GuidePageSchema.Type.blocks): boolean =>
  Array.some(blocks, (block) =>
    Match.value(block).pipe(
      Match.when({ kind: "code" }, () => true),
      Match.when({ kind: Match.is("heading", "list", "paragraph", "quote", "table") }, () => false),
      Match.exhaustive
    ))

export const enrichGuideBlocks = (
  title: string,
  blocks: typeof GuidePageSchema.Type.blocks,
  example: Option.Option<PackageGuideExample>
): typeof GuidePageSchema.Type.blocks =>
  Boolean.match(examplesSection(title), {
    onFalse: () => blocks,
    onTrue: () =>
      Boolean.match(includesCode(blocks), {
        onTrue: () => blocks,
        onFalse: () => {
          const withExample = (value: PackageGuideExample): typeof GuidePageSchema.Type.blocks => {
            const heading: GuideBlock = {
              kind: "heading",
              depth: 3,
              id: guideSlug(value.title),
              text: value.title
            }
            const code: GuideBlock = { kind: "code", language: "ts", source: value.source }
            return Array.appendAll(Array.make(heading, code), blocks)
          }

          return Option.match(example, {
            onNone: () => blocks,
            onSome: withExample
          })
        }
      })
  })

const guideAsset = (revision: string, packageSlug: string, slug: string): string =>
  Array.join(
    Array.make(
      "/docs-data/",
      revision,
      "/packages/",
      packageSlug,
      "/guides/",
      Boolean.match(String.isEmpty(slug), { onFalse: () => slug, onTrue: () => "overview" }),
      ".json"
    ),
    ""
  )

const guidePath = (packageSlug: string, slug: string): string =>
  Array.join(
    Array.make(
      "/docs/",
      packageSlug,
      Boolean.match(String.isEmpty(slug), { onFalse: () => String.concat("/", slug), onTrue: () => "" })
    ),
    ""
  )

const makePage = (input: MakePageInput): typeof GuidePageSchema.Type => ({
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
  sourceUrl: Array.join(
    Array.make(
      "https://github.com/scenesystems/theoria/blob/",
      input.revision,
      "/packages/",
      input.sourcePackage.directoryName,
      "/README.md"
    ),
    ""
  ),
  blocks: input.blocks,
  anchors: Array.filterMap(input.blocks, (block) =>
    Match.value(block).pipe(
      Match.when({ kind: "heading" }, ({ depth, id, text }) => Option.some({ id, label: text, depth })),
      Match.when({ kind: Match.is("code", "list", "paragraph", "quote", "table") }, () => Option.none()),
      Match.exhaustive
    ))
})

const summaryForPage = (
  revision: string,
  page: typeof GuidePageSchema.Type,
  slug: string
): typeof DocsGuideSummarySchema.Type => ({
  slug,
  title: page.title,
  summary: page.summary,
  path: page.path,
  asset: guideAsset(revision, page.package.slug, slug)
})

const searchEntry = (
  page: typeof GuidePageSchema.Type,
  slug: string
): typeof DocsSearchEntrySchema.Type => {
  const isOverview = String.isEmpty(slug)
  return {
    id: Array.join(
      Array.make(
        page.package.slug,
        "/guide/",
        Boolean.match(isOverview, { onFalse: () => slug, onTrue: () => "overview" })
      ),
      ""
    ),
    kind: Boolean.match(isOverview, { onFalse: () => "guide", onTrue: () => "package" }),
    package: page.package.name,
    packageSlug: page.package.slug,
    name: page.title,
    qualifiedName: Boolean.match(isOverview, {
      onFalse: () => Array.join(Array.make(page.package.name, " / ", page.title), ""),
      onTrue: () => page.package.name
    }),
    category: Boolean.match(isOverview, { onFalse: () => Option.some("guide"), onTrue: Option.none }),
    summary: page.summary,
    path: page.path,
    anchor: Option.none()
  }
}

export const buildPackageGuides = (input: BuildPackageGuidesInput): typeof PackageGuideData.Type => {
  // unified + remark are the source boundary: Effect currently has no native Markdown parser.
  const root = unified().use(remarkParse).use(remarkGfm).parse(input.markdown)
  const split = splitSections(root.children, input.sourcePackage.directoryName, input.revision)
  const overview = makePage({
    ...input,
    title: input.sourcePackage.manifest.name,
    slug: "",
    blocks: blocksFor(split.intro, input.sourcePackage.directoryName, input.revision)
  })
  const publicSections = Array.filter(
    Chunk.toReadonlyArray(split.sections),
    (section) => Boolean.not(excludedGuide(section.title))
  )
  const gettingSections = Array.filter(publicSections, (section) => gettingStartedSection(section.title))
  const gettingBlocks = Array.flatMap(gettingSections, (section): typeof GuidePageSchema.Type.blocks => {
    const heading: GuideBlock = {
      kind: "heading",
      depth: 2,
      id: guideSlug(section.title),
      text: section.title
    }
    return Array.prepend(blocksFor(section.nodes, input.sourcePackage.directoryName, input.revision), heading)
  })
  const gettingStarted = makePage({
    ...input,
    title: "Getting started",
    slug: "getting-started",
    blocks: gettingBlocks
  })
  const guidePages = Array.map(
    Array.filter(publicSections, (section) => Boolean.not(gettingStartedSection(section.title))),
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
  const pages = Array.appendAll(Array.make(overview, gettingStarted), guidePages)
  const slugs = Array.appendAll(
    Array.make("", "getting-started"),
    Array.map(guidePages, (page) => guideSlug(page.title))
  )

  return {
    pages,
    overview: summaryForPage(input.revision, overview, ""),
    guides: Array.map(
      Array.zip(Array.drop(slugs, 1), Array.drop(pages, 1)),
      ([slug, page]) => summaryForPage(input.revision, page, slug)
    ),
    searchEntries: Array.map(Array.zip(slugs, pages), ([slug, page]) => searchEntry(page, slug))
  }
}
