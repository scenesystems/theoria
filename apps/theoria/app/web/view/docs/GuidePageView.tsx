import * as Arr from "effect/Array"

import type { GuideBlock, GuideInline, GuidePage } from "@theoria/docs-model"
import { CodeBlock, codeLanguageFor } from "../primitives/CodeBlock.js"
import { Cluster, Layer, Section, Stack } from "../primitives/Layout.js"
import { ExternalLink } from "../primitives/Link.js"
import { SemanticContent } from "../primitives/SemanticContent.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { DocsRichText } from "./DocsRichText.js"

const GuideHeading = ({ block }: { readonly block: Extract<GuideBlock, { readonly kind: "heading" }> }) => {
  const element = block.depth === 2 ?
    "h2"
    : block.depth === 3 ?
    "h3"
    : block.depth === 4 ?
    "h4"
    : block.depth === 5 ?
    "h5"
    : "h6"

  return (
    <SemanticContent
      as={element}
      className={block.depth === 2 ? "scroll-mt-28 pt-5 text-ink-950" : "scroll-mt-28 pt-2 text-ink-900"}
      role={block.depth === 2 ? "section-title" : "selection-title"}
    >
      <a
        className="outline-none hover:text-ink-700 focus-visible:ring-2 focus-visible:ring-ink-900/20"
        href={`#${block.id}`}
        id={block.id}
      >
        {block.text}
      </a>
    </SemanticContent>
  )
}

const GuideList = ({ items, ordered }: {
  readonly items: ReadonlyArray<ReadonlyArray<GuideInline>>
  readonly ordered: boolean
}) => {
  const Component = ordered ? "ol" : "ul"

  return (
    <Component className={`ml-6 space-y-2 text-ink-700 ${ordered ? "list-decimal" : "list-disc"}`}>
      {Arr.map(items, (parts, index) => (
        <li className="pl-1" key={`${String(index)}:${parts.length}`}>
          <SemanticContent as="span" role="row-value">
            <DocsRichText parts={parts} />
          </SemanticContent>
        </li>
      ))}
    </Component>
  )
}

const GuideTable = ({ block }: { readonly block: Extract<GuideBlock, { readonly kind: "table" }> }) => (
  <Layer className="overflow-x-auto rounded-xl border border-stage-200/90 bg-stage-0/72">
    <table className="w-full min-w-[32rem] border-collapse text-left">
      <thead className="border-b border-stage-200 bg-stage-100/65">
        <tr>
          {Arr.map(block.headers, (parts, index) => (
            <th className="px-4 py-3" key={`${String(index)}:${parts.length}`}>
              <SemanticContent as="span" role="row-label">
                <DocsRichText parts={parts} />
              </SemanticContent>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-stage-200/75">
        {Arr.map(block.rows, (row, rowIndex) => (
          <tr key={`${String(rowIndex)}:${row.length}`}>
            {Arr.map(
              row,
              (parts, columnIndex) => (
                <td className="px-4 py-3 align-top" key={`${String(columnIndex)}:${parts.length}`}>
                  <SemanticContent as="span" className="text-ink-700" role="row-value">
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

const GuideBlockView = ({ block, index }: { readonly block: GuideBlock; readonly index: number }) => {
  const content = block.kind === "paragraph"
    ? (
      <SemanticContent as="p" className="text-ink-700" role="card-summary">
        <DocsRichText parts={block.parts} />
      </SemanticContent>
    )
    : block.kind === "heading" ?
    <GuideHeading block={block} />
    : block.kind === "code"
    ? <CodeBlock label={block.language || "text"} language={codeLanguageFor(block.language)} source={block.source} />
    : block.kind === "list" ?
    <GuideList items={block.items} ordered={block.ordered} />
    : block.kind === "quote"
    ? (
      <Layer as="blockquote" className="border-l-2 border-stage-400 pl-5">
        <SemanticContent as="p" className="text-ink-600" role="card-summary">
          <DocsRichText parts={block.parts} />
        </SemanticContent>
      </Layer>
    )
    : <GuideTable block={block} />

  return <Layer key={`${block.kind}:${String(index)}`}>{content}</Layer>
}

export const GuidePageView = ({ page }: { readonly page: GuidePage }) => (
  <Stack className="gap-9 sm:gap-11">
    <Section className="border-b border-stage-200/90 pb-8">
      <Stack className="gap-4">
        <SemanticText as="code" className="text-ink-500" role="code-meta" text={page.package.name} />
        <SemanticText
          as="h1"
          className="font-light tracking-[-0.04em] text-ink-950"
          role="hero-title"
          text={page.title}
        />
        <Cluster className="gap-4">
          <SemanticText as="span" className="text-ink-500" role="status" text={`v${page.package.version}`} />
          <ExternalLink
            className="font-body text-sm font-medium text-ink-700 underline decoration-stage-400 underline-offset-4 hover:text-ink-950"
            href={page.sourceUrl}
          >
            Source
          </ExternalLink>
        </Cluster>
      </Stack>
    </Section>
    <Stack className="gap-6 sm:gap-7">
      {Arr.map(
        page.blocks,
        (block, index) => <GuideBlockView block={block} index={index} key={`${block.kind}:${String(index)}`} />
      )}
    </Stack>
  </Stack>
)
