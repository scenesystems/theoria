import { Array as Arr, Data, Option, Record as Rec } from "effect"
import type { Heading, PhrasingContent, Root, RootContent } from "mdast"
import rehypeRaw from "rehype-raw"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"

import {
  type PackageDocsExcerptKind,
  PackageDocsRichTextDocument,
  PackageDocsRichTextElementNode,
  type PackageDocsRichTextPropertyValue,
  PackageDocsRichTextTextNode,
  type PackageDocsSectionBlock,
  type PackageDocsSourceKind
} from "../packageDocsSchema.js"

class MarkdownAccumulator extends Data.Class<{
  readonly blocks: ReadonlyArray<PackageDocsSectionBlock>
  readonly currentTitle: string
  readonly currentAnchor: string
  readonly currentTitleDocument: PackageDocsRichTextDocument
  readonly currentNodes: ReadonlyArray<RootContent>
  readonly index: number
}> {}

const markdownAstProcessor = unified().use(remarkParse).use(remarkGfm)

const markdownRichTextProcessor = unified()
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)

const frontmatterBoundary = "\n---\n"

const stripFrontmatter = (text: string): string => {
  const closingIndex = text.indexOf(frontmatterBoundary, 4)

  return text.startsWith("---\n") && closingIndex >= 0
    ? text.slice(closingIndex + frontmatterBoundary.length)
    : text
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const treeChildren = (value: unknown): ReadonlyArray<unknown> =>
  isRecord(value) && Arr.isArray(value.children) ? value.children : []

const treeType = (value: unknown): string => isRecord(value) && typeof value.type === "string" ? value.type : ""

const treeValue = (value: unknown): Option.Option<string> =>
  isRecord(value) && typeof value.value === "string"
    ? Option.some(value.value)
    : Option.none()

const treeTagName = (value: unknown): Option.Option<string> =>
  isRecord(value) && typeof value.tagName === "string"
    ? Option.some(value.tagName)
    : Option.none()

const treeProperties = (value: unknown): Record<string, unknown> =>
  isRecord(value) && isRecord(value.properties) ? value.properties : {}

const isRootContentNode = (value: unknown): value is RootContent => isRecord(value) && typeof value.type === "string"

const isPhrasingContentNode = (value: unknown): value is PhrasingContent =>
  isRecord(value) && typeof value.type === "string"

const isHeadingNode = (value: unknown): value is Heading => treeType(value) === "heading"

const normalizePropertyValue = (value: unknown): Option.Option<PackageDocsRichTextPropertyValue> =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? Option.some(value)
    : Arr.isArray(value) && value.every((item) => typeof item === "string" || typeof item === "number")
    ? Option.some(value.map(String))
    : Option.none()

const richTextProperties = (value: unknown): Record<string, PackageDocsRichTextPropertyValue> =>
  Rec.toEntries(treeProperties(value)).reduce<Record<string, PackageDocsRichTextPropertyValue>>(
    (properties, [key, propertyValue]) =>
      Option.match(normalizePropertyValue(propertyValue), {
        onNone: () => properties,
        onSome: (normalized) => ({
          ...properties,
          [key]: normalized
        })
      }),
    {}
  )

const richTextNode = (value: unknown): Option.Option<PackageDocsRichTextTextNode | PackageDocsRichTextElementNode> =>
  treeType(value) === "text"
    ? Option.map(treeValue(value), (text) => PackageDocsRichTextTextNode.make({ value: text }))
    : Option.match(treeTagName(value), {
      onNone: () => Option.none(),
      onSome: (tagName) =>
        Option.some(
          PackageDocsRichTextElementNode.make({
            children: Arr.filterMap(treeChildren(value), richTextNode),
            properties: richTextProperties(value),
            tagName
          })
        )
    })

const richTextDocument = (tree: unknown): PackageDocsRichTextDocument =>
  PackageDocsRichTextDocument.make({
    children: Arr.filterMap(treeChildren(tree), richTextNode)
  })

const unwrapSingleParagraph = (document: PackageDocsRichTextDocument): PackageDocsRichTextDocument =>
  document.children.length === 1
    && document.children[0]?._tag === "element"
    && document.children[0].tagName === "p"
    ? PackageDocsRichTextDocument.make({ children: document.children[0].children })
    : document

const markdownRoot = (children: ReadonlyArray<RootContent>): Root => ({
  children: [...children],
  type: "root"
})

const inlineMarkdownRoot = (children: ReadonlyArray<PhrasingContent>): Root =>
  markdownRoot([
    { children: [...children], type: "paragraph" }
  ])

const markdownDocument = (children: ReadonlyArray<RootContent>): PackageDocsRichTextDocument =>
  richTextDocument(markdownRichTextProcessor.runSync(markdownRoot(children)))

const inlineMarkdownDocument = (children: ReadonlyArray<PhrasingContent>): PackageDocsRichTextDocument =>
  unwrapSingleParagraph(richTextDocument(markdownRichTextProcessor.runSync(inlineMarkdownRoot(children))))

const plainTextFromNode = (node: PackageDocsRichTextTextNode | PackageDocsRichTextElementNode): string =>
  node._tag === "text"
    ? node.value
    : node.tagName === "br"
    ? "\n"
    : node.children.map(plainTextFromNode).join(" ")

const plainTextDocument = (document: PackageDocsRichTextDocument): string =>
  document.children.map(plainTextFromNode).join(" ").replace(/\s+/gu, " ").trim()

const textDocument = (text: string): PackageDocsRichTextDocument =>
  text.length === 0
    ? PackageDocsRichTextDocument.make({ children: [] })
    : PackageDocsRichTextDocument.make({
      children: [PackageDocsRichTextTextNode.make({ value: text })]
    })

const parsedMarkdownChildren = (text: string): ReadonlyArray<RootContent> =>
  treeChildren(markdownAstProcessor.parse(stripFrontmatter(text))).filter(isRootContentNode)

const headingChildren = (node: Heading): ReadonlyArray<PhrasingContent> =>
  treeChildren(node).filter(isPhrasingContentNode)

const headingDocument = (node: Heading): PackageDocsRichTextDocument => inlineMarkdownDocument(headingChildren(node))

const headingTitle = (node: Heading): string => plainTextDocument(headingDocument(node))

/**
 * Produces a stable anchor identity for normalized package-doc sections.
 */
export const normalizePackageDocsAnchor = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+/u, "")
    .replace(/-+$/u, "") || "section"

const finalizeBlock = (input: {
  readonly packageId: PackageDocsSectionBlock["source"]["packageId"]
  readonly path: string
  readonly sourceKind: PackageDocsSourceKind
  readonly excerptKind: PackageDocsExcerptKind
  readonly state: MarkdownAccumulator
}): ReadonlyArray<PackageDocsSectionBlock> => {
  const contentDocument = markdownDocument(input.state.currentNodes)
  const content = plainTextDocument(contentDocument)

  return content.length === 0 && input.state.currentTitle.length === 0
    ? input.state.blocks
    : Arr.append(input.state.blocks, {
      contentDocument,
      id: `${input.path}#${input.state.currentAnchor || `section-${input.state.index}`}`,
      kind: input.excerptKind,
      language: null,
      title: input.state.currentTitle,
      titleDocument: input.state.currentTitleDocument,
      content,
      source: {
        packageId: input.packageId,
        kind: input.sourceKind,
        path: input.path,
        anchor: input.state.currentAnchor,
        title: input.state.currentTitle
      }
    })
}

/**
 * Splits a markdown document into source-linked normalized section blocks.
 */
export const markdownSectionBlocks = (input: {
  readonly packageId: PackageDocsSectionBlock["source"]["packageId"]
  readonly path: string
  readonly documentTitle: string
  readonly sourceKind: PackageDocsSourceKind
  readonly excerptKind: PackageDocsExcerptKind
  readonly text: string
}): ReadonlyArray<PackageDocsSectionBlock> => {
  const initialState: MarkdownAccumulator = {
    blocks: [],
    currentTitle: input.documentTitle,
    currentAnchor: "overview",
    currentTitleDocument: textDocument(input.documentTitle),
    currentNodes: [],
    index: 0
  }

  const finalState = parsedMarkdownChildren(input.text)
    .reduce<MarkdownAccumulator>(
      (state, node) =>
        isHeadingNode(node)
          ? new MarkdownAccumulator({
            blocks: finalizeBlock({
              packageId: input.packageId,
              path: input.path,
              sourceKind: input.sourceKind,
              excerptKind: input.excerptKind,
              state
            }),
            currentTitle: headingTitle(node),
            currentAnchor: normalizePackageDocsAnchor(headingTitle(node)),
            currentTitleDocument: headingDocument(node),
            currentNodes: [],
            index: state.index + 1
          })
          : new MarkdownAccumulator({
            ...state,
            currentNodes: Arr.append(state.currentNodes, node)
          }),
      new MarkdownAccumulator(initialState)
    )

  return finalizeBlock({
    packageId: input.packageId,
    path: input.path,
    sourceKind: input.sourceKind,
    excerptKind: input.excerptKind,
    state: finalState
  })
}
