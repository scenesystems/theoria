import {
  type PackageDocsRichTextDocument as PackageDocsRichTextDocumentType,
  type PackageDocsRichTextElementNode,
  type PackageDocsRichTextPropertyValue,
  type PackageDocsRichTextTextNode
} from "@theoria/source-proof/contracts"
import * as Arr from "effect/Array"
import { Fragment, type ReactNode } from "react"

import { normalizeCodeLanguage } from "../../ui/components/surface/code-highlighter.js"
import { HighlightedCode } from "../../ui/components/surface/HighlightedCode.js"
import { Box } from "../../ui/structure/Box.js"
import { Link } from "../../ui/structure/Link.js"
import { SemanticText } from "../../ui/structure/SemanticText.js"
import { Stack } from "../../ui/structure/Stack.js"

const textFromNodes = (nodes: ReadonlyArray<PackageDocsRichTextTextNode | PackageDocsRichTextElementNode>): string =>
  nodes.map((node) => node._tag === "text" ? node.value : textFromNodes(node.children)).join("")

const propertyValue = (
  properties: Record<string, PackageDocsRichTextPropertyValue>,
  key: string
): PackageDocsRichTextPropertyValue | undefined => properties[key]

const propertyString = (
  properties: Record<string, PackageDocsRichTextPropertyValue>,
  key: string
): string | undefined => {
  const value = propertyValue(properties, key)

  return typeof value === "string"
    ? value
    : typeof value === "number"
    ? String(value)
    : Arr.isArray(value)
    ? value.join(" ")
    : undefined
}

const propertyBoolean = (
  properties: Record<string, PackageDocsRichTextPropertyValue>,
  key: string
): boolean | undefined => propertyValue(properties, key) === true ? true : undefined

const withOptionalClassName = (className: string | undefined): { className?: string } =>
  className === undefined ? {} : { className }

const renderNodes = (
  nodes: ReadonlyArray<PackageDocsRichTextTextNode | PackageDocsRichTextElementNode>,
  keyPrefix: string
): ReadonlyArray<ReactNode> => nodes.map((node, index) => renderNode(node, `${keyPrefix}:${String(index)}`))

const renderHeading = (
  node: PackageDocsRichTextElementNode,
  key: string,
  role: "display" | "display-sm" | "label",
  tagName: "h2" | "h3" | "h4" | "h5" | "h6"
) => (
  <SemanticText as={tagName} className="text-ink-900" key={key} role={role}>
    {renderNodes(node.children, key)}
  </SemanticText>
)

const renderGenericElement = (node: PackageDocsRichTextElementNode, key: string): ReactNode =>
  node.tagName === "span"
    ? (
      <Box
        as="span"
        {...withOptionalClassName(propertyString(node.properties, "className"))}
        key={key}
      >
        {renderNodes(node.children, key)}
      </Box>
    )
    : (
      <Box
        {...withOptionalClassName(propertyString(node.properties, "className"))}
        key={key}
      >
        {renderNodes(node.children, key)}
      </Box>
    )

const renderElement = (node: PackageDocsRichTextElementNode, key: string): ReactNode =>
  node.tagName === "a"
    ? (
      <Link
        className="underline decoration-stage-300/80 underline-offset-3 hover:text-ink-900 hover:decoration-stage-400"
        href={propertyString(node.properties, "href") ?? "#"}
        key={key}
        rel={(propertyString(node.properties, "href") ?? "#").startsWith("http") ? "noopener noreferrer" : undefined}
        target={(propertyString(node.properties, "href") ?? "#").startsWith("http") ? "_blank" : undefined}
        tone="inherit"
      >
        {renderNodes(node.children, key)}
      </Link>
    )
    : node.tagName === "blockquote"
    ? (
      <Box as="blockquote" className="border-l-2 border-stage-300/60 pl-4 italic text-ink-600" key={key}>
        <Stack className="gap-2">{renderNodes(node.children, key)}</Stack>
      </Box>
    )
    : node.tagName === "code"
    ? (
      <Box as="code" className="rounded-sm bg-stage-100/80 px-1 py-0.5 text-[0.875em] text-ink-800 font-mono" key={key}>
        {textFromNodes(node.children).replace(/\n$/u, "")}
      </Box>
    )
    : node.tagName === "del"
    ? <Box as="del" className="text-ink-500 line-through" key={key}>{renderNodes(node.children, key)}</Box>
    : node.tagName === "em"
    ? <Box as="em" className="italic" key={key}>{renderNodes(node.children, key)}</Box>
    : node.tagName === "h1" || node.tagName === "h2"
    ? renderHeading(node, key, "display", "h2")
    : node.tagName === "h3" || node.tagName === "h4"
    ? renderHeading(node, key, "display-sm", node.tagName)
    : node.tagName === "h5" || node.tagName === "h6"
    ? renderHeading(node, key, "label", node.tagName)
    : node.tagName === "hr"
    ? <Box as="hr" className="my-1 border-t border-stage-200/60" key={key} />
    : node.tagName === "img"
    ? (
      <img
        alt={propertyString(node.properties, "alt") ?? ""}
        className="inline-block max-h-80 rounded-md border border-stage-200/60"
        key={key}
        src={propertyString(node.properties, "src")}
      />
    )
    : node.tagName === "input"
    ? propertyString(node.properties, "type") === "checkbox"
      ? (
        <input
          checked={propertyBoolean(node.properties, "checked")}
          className="mt-0.5 mr-2 size-3.5 rounded-sm border border-stage-300/80 accent-stage-500"
          disabled={propertyBoolean(node.properties, "disabled")}
          key={key}
          readOnly
          type="checkbox"
        />
      )
      : null
    : node.tagName === "li"
    ? <Box as="li" className="leading-relaxed text-ink-700" key={key}>{renderNodes(node.children, key)}</Box>
    : node.tagName === "ol"
    ? (
      <Box as="ol" className="list-decimal space-y-1 pl-6 marker:text-stage-400" key={key}>
        {renderNodes(node.children, key)}
      </Box>
    )
    : node.tagName === "p"
    ? (
      <SemanticText as="p" className="text-ink-700" key={key} role="body">
        {renderNodes(node.children, key)}
      </SemanticText>
    )
    : node.tagName === "pre"
    ? (
      <HighlightedCode
        code={textFromNodes(node.children).replace(/\n$/u, "")}
        key={key}
        language={normalizeCodeLanguage(
          node.children[0]?._tag === "element"
            ? propertyString(node.children[0].properties, "className")
            : undefined
        )}
      />
    )
    : node.tagName === "strong"
    ? <Box as="strong" className="font-semibold text-ink-900" key={key}>{renderNodes(node.children, key)}</Box>
    : node.tagName === "table"
    ? (
      <Box className="overflow-x-auto rounded-lg border border-stage-200/70 bg-stage-0/70" key={key}>
        <Box as="table" className="min-w-full border-collapse">{renderNodes(node.children, key)}</Box>
      </Box>
    )
    : node.tagName === "tbody"
    ? <Box as="tbody" key={key}>{renderNodes(node.children, key)}</Box>
    : node.tagName === "td"
    ? (
      <Box as="td" className="border-t border-stage-200/60 px-3 py-2 align-top text-ink-700" key={key}>
        <SemanticText as="span" role="body" tone="inherit">{renderNodes(node.children, key)}</SemanticText>
      </Box>
    )
    : node.tagName === "th"
    ? (
      <Box
        as="th"
        className="border-b border-stage-200/70 bg-stage-50/70 px-3 py-2 text-left align-top text-ink-900"
        key={key}
      >
        <SemanticText as="span" role="label" tone="inherit">{renderNodes(node.children, key)}</SemanticText>
      </Box>
    )
    : node.tagName === "thead"
    ? <Box as="thead" key={key}>{renderNodes(node.children, key)}</Box>
    : node.tagName === "tr"
    ? <Box as="tr" key={key}>{renderNodes(node.children, key)}</Box>
    : node.tagName === "ul"
    ? (
      <Box as="ul" className="list-disc space-y-1 pl-6 marker:text-stage-400" key={key}>
        {renderNodes(node.children, key)}
      </Box>
    )
    : renderGenericElement(node, key)

const renderNode = (node: PackageDocsRichTextTextNode | PackageDocsRichTextElementNode, key: string): ReactNode =>
  node._tag === "text"
    ? <Fragment key={key}>{node.value}</Fragment>
    : renderElement(node, key)

export const PackageDocsInlineContent = ({ document }: { readonly document: PackageDocsRichTextDocumentType }) => (
  <>{renderNodes(document.children, "inline")}</>
)

export const PackageDocsMarkdownBody = ({ document }: { readonly document: PackageDocsRichTextDocumentType }) => (
  <Stack className="gap-3.5">{renderNodes(document.children, "body")}</Stack>
)
