import { Array, Boolean, Equal, Match, Option, Schema, String } from "effect"

import type { GuideHeading, GuideList, GuideTable } from "@theoria/docs-model"
import { type GuideBlock, GuidePageSchema } from "@theoria/docs-model"
import type { TextRole } from "../../../contracts/text.js"
import { CodeBlock, codeLanguageFor } from "../primitives/CodeBlock.js"
import { anchorHeadingClassName, focusClassName, linkTextClassName } from "../primitives/designSystem.js"
import { Cluster, Layer, Section, Stack } from "../primitives/Layout.js"
import { ExternalLink } from "../primitives/Link.js"
import { MathContent } from "../primitives/MathContent.js"
import { SemanticContent, type SemanticContentElement } from "../primitives/SemanticContent.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { DocsRichText } from "./DocsRichText.js"

const Page = Schema.Struct({ page: GuidePageSchema })

/** A guide's heading depth is the element's level: the page title is the h1 above the blocks. */
const headingElement = (depth: typeof GuideHeading.Type.depth): SemanticContentElement =>
  Match.value(depth).pipe(
    Match.withReturnType<SemanticContentElement>(),
    Match.when(2, () => "h2"),
    Match.when(3, () => "h3"),
    Match.when(4, () => "h4"),
    Match.when(5, () => "h5"),
    Match.when(6, () => "h6"),
    Match.exhaustive
  )

const Heading = (block: typeof GuideHeading.Type) => {
  const isSection = Equal.equals(block.depth, 2)

  return (
    <SemanticContent
      as={headingElement(block.depth)}
      className={Boolean.match(isSection, {
        onTrue: () => "scroll-mt-28 pt-5",
        onFalse: () => "scroll-mt-28 pt-2"
      })}
      role={Match.value(block.depth).pipe(
        Match.withReturnType<TextRole>(),
        Match.when(2, () => "section-title"),
        Match.when(3, () => "subsection-title"),
        Match.when(Match.is(4, 5, 6), () => "selection-title"),
        Match.exhaustive
      )}
    >
      <a
        className={Array.join(Array.make(focusClassName, anchorHeadingClassName), " ")}
        href={String.concat("#", block.id)}
        id={block.id}
      >
        {block.text}
      </a>
    </SemanticContent>
  )
}

/** A guide list is ordered or not; the element says which. */
const ListElement = Schema.Literal("ol", "ul")
type ListElement = typeof ListElement.Type

const List = ({ items, ordered }: typeof GuideList.Type) => {
  const Component = Boolean.match(ordered, { onTrue: (): ListElement => "ol", onFalse: (): ListElement => "ul" })
  const marker = Boolean.match(ordered, { onTrue: () => "list-decimal", onFalse: () => "list-disc" })

  return (
    <Component className={String.concat("ml-6 space-y-2 ", marker)}>
      {Array.map(items, (parts, index) => (
        <li className="pl-1" key={index}>
          <SemanticContent as="span" role="body">
            <DocsRichText parts={parts} />
          </SemanticContent>
        </li>
      ))}
    </Component>
  )
}

const Table = (block: typeof GuideTable.Type) => (
  <Layer className="overflow-x-auto rounded-instrument border border-hairline-veil bg-paper-glass">
    <table className="w-full min-w-[32rem] border-collapse text-left">
      <thead className="border-b border-hairline bg-instrument-glass">
        <tr>
          {Array.map(block.headers, (parts, index) => (
            <th className="px-4 py-3" key={index}>
              <SemanticContent as="span" role="row-label">
                <DocsRichText parts={parts} />
              </SemanticContent>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-hairline-glass">
        {Array.map(block.rows, (row, rowIndex) => (
          <tr key={rowIndex}>
            {Array.map(
              row,
              (parts, columnIndex) => (
                <td className="px-4 py-3 align-top" key={columnIndex}>
                  <SemanticContent as="span" className="text-ink-secondary" role="row-value">
                    <DocsRichText parts={parts} />
                  </SemanticContent>
                </td>
              )
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </Layer>
)

/** A code block with no language named is labelled as plain text. */
const codeLabel = (language: string): string =>
  Option.getOrElse(Option.liftPredicate(language, String.isNonEmpty), () => "text")

const GuideBlockView = (block: GuideBlock) =>
  Match.value(block).pipe(
    Match.when(
      { kind: "paragraph" },
      ({ parts }) => (
        <SemanticContent as="p" role="body">
          <DocsRichText parts={parts} />
        </SemanticContent>
      )
    ),
    Match.when({ kind: "heading" }, (heading) => <Heading {...heading} />),
    Match.when({ kind: "math" }, (expression) => <MathContent {...expression} />),
    Match.when(
      { kind: "code" },
      ({ language, source }) => (
        <CodeBlock label={codeLabel(language)} language={codeLanguageFor(language)} source={source} />
      )
    ),
    Match.when({ kind: "list" }, (list) => <List {...list} />),
    Match.when(
      { kind: "quote" },
      ({ parts }) => (
        <Layer render={<blockquote />} className="border-l-2 border-accent pl-5">
          <SemanticContent as="p" role="body">
            <DocsRichText parts={parts} />
          </SemanticContent>
        </Layer>
      )
    ),
    Match.when({ kind: "table" }, (table) => <Table {...table} />),
    Match.exhaustive
  )

export const GuidePageView = ({ page }: typeof Page.Type) => (
  <Stack className="gap-9 sm:gap-11">
    <Section className="border-b border-hairline-veil pb-8">
      <Stack className="gap-4">
        <SemanticText as="code" className="text-ink-tertiary" role="code-meta" text={page.package.name} />
        <SemanticText as="h1" role="hero-title" text={page.title} />
        <Cluster className="gap-4">
          <SemanticText as="span" role="caption" text={String.concat("v", page.package.version)} />
          <ExternalLink
            className={String.concat("text-ink-secondary ", linkTextClassName)}
            href={page.sourceUrl}
          >
            <SemanticText as="span" role="button-label" text="Source" />
          </ExternalLink>
        </Cluster>
      </Stack>
    </Section>
    <Stack className="gap-6 sm:gap-7">
      {Array.map(
        page.blocks,
        (block, index) => (
          <Layer key={index}>
            <GuideBlockView {...block} />
          </Layer>
        )
      )}
    </Stack>
  </Stack>
)
