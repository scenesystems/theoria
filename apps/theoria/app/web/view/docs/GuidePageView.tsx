import { Boolean as Bool, Equal, Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import type { GuideBlock, GuideInline, GuidePage } from "@theoria/docs-model"
import { CodeBlock, codeLanguageFor } from "../primitives/CodeBlock.js"
import { anchorHeadingClassName, focusClassName, linkTextClassName } from "../primitives/designSystem.js"
import { Cluster, Layer, Section, Stack } from "../primitives/Layout.js"
import { ExternalLink } from "../primitives/Link.js"
import { SemanticContent, type SemanticContentElement } from "../primitives/SemanticContent.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { DocsRichText } from "./DocsRichText.js"

type HeadingBlock = Extract<GuideBlock, { readonly kind: "heading" }>

/** A guide's heading depth is the element's level: the page title is the h1 above the blocks. */
const headingElement = (depth: HeadingBlock["depth"]): SemanticContentElement =>
  Match.value(depth).pipe(
    Match.withReturnType<SemanticContentElement>(),
    Match.when(2, () => "h2"),
    Match.when(3, () => "h3"),
    Match.when(4, () => "h4"),
    Match.when(5, () => "h5"),
    Match.when(6, () => "h6"),
    Match.exhaustive
  )

const GuideHeading = ({ block }: { readonly block: HeadingBlock }) => {
  const isSection = Equal.equals(block.depth, 2)

  return (
    <SemanticContent
      as={headingElement(block.depth)}
      className={Bool.match(isSection, {
        onTrue: () => "scroll-mt-28 pt-5",
        onFalse: () => "scroll-mt-28 pt-2"
      })}
      role={block.depth === 2 ? "section-title" : block.depth === 3 ? "subsection-title" : "selection-title"}
    >
      <a
        className={`${focusClassName} ${anchorHeadingClassName}`}
        href={`#${block.id}`}
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

/** A list of parts is keyed by its place and its size, since two lists may read alike. */
const partsKey = (index: number, parts: ReadonlyArray<GuideInline>): string =>
  `${String(index)}:${String(Arr.length(parts))}`

const GuideList = ({ items, ordered }: {
  readonly items: ReadonlyArray<ReadonlyArray<GuideInline>>
  readonly ordered: boolean
}) => {
  const Component = Bool.match(ordered, { onTrue: (): ListElement => "ol", onFalse: (): ListElement => "ul" })
  const marker = Bool.match(ordered, { onTrue: () => "list-decimal", onFalse: () => "list-disc" })

  return (
    <Component className={`ml-6 space-y-2 ${marker}`}>
      {Arr.map(items, (parts, index) => (
        <li className="pl-1" key={partsKey(index, parts)}>
          <SemanticContent as="span" role="body">
            <DocsRichText parts={parts} />
          </SemanticContent>
        </li>
      ))}
    </Component>
  )
}

const GuideTable = ({ block }: { readonly block: Extract<GuideBlock, { readonly kind: "table" }> }) => (
  <Layer className="overflow-x-auto rounded-instrument border border-hairline-veil bg-paper-glass">
    <table className="w-full min-w-[32rem] border-collapse text-left">
      <thead className="border-b border-hairline bg-instrument-glass">
        <tr>
          {Arr.map(block.headers, (parts, index) => (
            <th className="px-4 py-3" key={partsKey(index, parts)}>
              <SemanticContent as="span" role="row-label">
                <DocsRichText parts={parts} />
              </SemanticContent>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-hairline-glass">
        {Arr.map(block.rows, (row, rowIndex) => (
          <tr key={`${String(rowIndex)}:${String(Arr.length(row))}`}>
            {Arr.map(
              row,
              (parts, columnIndex) => (
                <td className="px-4 py-3 align-top" key={partsKey(columnIndex, parts)}>
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
  Option.getOrElse(Option.liftPredicate(language, Str.isNonEmpty), () => "text")

const GuideBlockView = ({ block }: { readonly block: GuideBlock }) =>
  Match.value(block).pipe(
    Match.when(
      { kind: "paragraph" },
      ({ parts }) => (
        <SemanticContent as="p" role="body">
          <DocsRichText parts={parts} />
        </SemanticContent>
      )
    ),
    Match.when({ kind: "heading" }, (heading) => <GuideHeading block={heading} />),
    Match.when(
      { kind: "code" },
      ({ language, source }) => (
        <CodeBlock label={codeLabel(language)} language={codeLanguageFor(language)} source={source} />
      )
    ),
    Match.when({ kind: "list" }, ({ items, ordered }) => <GuideList items={items} ordered={ordered} />),
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
    Match.when({ kind: "table" }, (table) => <GuideTable block={table} />),
    Match.exhaustive
  )

export const GuidePageView = ({ page }: { readonly page: GuidePage }) => (
  <Stack className="gap-9 sm:gap-11">
    <Section className="border-b border-hairline-veil pb-8">
      <Stack className="gap-4">
        <SemanticText as="code" className="text-ink-tertiary" role="code-meta" text={page.package.name} />
        <SemanticText as="h1" role="hero-title" text={page.title} />
        <Cluster className="gap-4">
          <SemanticText as="span" role="caption" text={`v${page.package.version}`} />
          <ExternalLink
            className={`text-ink-secondary ${linkTextClassName}`}
            href={page.sourceUrl}
          >
            <SemanticText as="span" role="button-label" text="Source" />
          </ExternalLink>
        </Cluster>
      </Stack>
    </Section>
    <Stack className="gap-6 sm:gap-7">
      {Arr.map(
        page.blocks,
        (block, index) => (
          <Layer key={`${block.kind}:${String(index)}`}>
            <GuideBlockView block={block} />
          </Layer>
        )
      )}
    </Stack>
  </Stack>
)
