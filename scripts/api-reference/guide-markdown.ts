import { Array as Arr, Option } from "effect"
import type {
  BlockContent,
  DefinitionContent,
  ListItem,
  PhrasingContent,
  RootContent,
  TableCell
} from "mdast"

import {
  type GuideBlock,
  type GuideInline
} from "@theoria/docs-model"

const repositoryUrl = "https://github.com/scenesystems/theoria"

export const guideSlug = (value: string): string =>
  value.trim().toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")

const crossPackageReadme = /^\.\.\/([^/]+)\/README\.md(?:#.*)?$/u

const guideHref = (input: {
  readonly href: string
  readonly packageSlug: string
  readonly revision: string
}): string => {
  if (/^(?:https?:|mailto:|#|\/)/u.test(input.href)) {
    return input.href
  }

  const crossPackage = crossPackageReadme.exec(input.href)

  if (crossPackage?.[1] !== undefined) {
    return `/docs/${crossPackage[1]}`
  }

  return `${repositoryUrl}/blob/${input.revision}/packages/${input.packageSlug}/${input.href.replace(/^\.\//u, "")}`
}

const inlinePart = (input: {
  readonly node: PhrasingContent
  readonly packageSlug: string
  readonly revision: string
}): ReadonlyArray<GuideInline> => {
  const { node } = input

  if (node.type === "text") {
    return [{ kind: "text", text: node.value }]
  }

  if (node.type === "inlineCode") {
    return [{ kind: "code", text: node.value }]
  }

  if (node.type === "break") {
    return [{ kind: "text", text: "\n" }]
  }

  if (node.type === "image") {
    return [{
      kind: "link",
      text: node.alt ?? node.title ?? node.url,
      href: guideHref({ ...input, href: node.url })
    }]
  }

  if (node.type === "link") {
    return [{
      kind: "link",
      text: inlineText(inlineParts(node.children, input.packageSlug, input.revision)),
      href: guideHref({ ...input, href: node.url })
    }]
  }

  if (node.type === "emphasis" || node.type === "strong" || node.type === "delete") {
    return inlineParts(node.children, input.packageSlug, input.revision)
  }

  return []
}

export const inlineParts = (
  children: ReadonlyArray<PhrasingContent>,
  packageSlug: string,
  revision: string
): ReadonlyArray<GuideInline> =>
  Arr.flatMap(children, (node) => inlinePart({ node, packageSlug, revision }))

export const inlineText = (parts: ReadonlyArray<GuideInline>): string =>
  Arr.map(parts, (part) => part.text).join("")

const itemParts = (
  item: ListItem,
  packageSlug: string,
  revision: string
): ReadonlyArray<GuideInline> =>
  Arr.flatMap(item.children, (child) =>
    child.type === "paragraph"
      ? inlineParts(child.children, packageSlug, revision)
      : child.type === "list"
      ? Arr.flatMap(child.children, (nested) => itemParts(nested, packageSlug, revision))
      : [])

const cellParts = (
  cell: TableCell,
  packageSlug: string,
  revision: string
): ReadonlyArray<GuideInline> => inlineParts(cell.children, packageSlug, revision)

const blockquoteParts = (
  children: ReadonlyArray<BlockContent | DefinitionContent>,
  packageSlug: string,
  revision: string
): ReadonlyArray<GuideInline> =>
  Arr.flatMap(children, (child) =>
    child.type === "paragraph" ? inlineParts(child.children, packageSlug, revision) : [])

export const guideBlock = (input: {
  readonly node: RootContent
  readonly packageSlug: string
  readonly revision: string
}): Option.Option<GuideBlock> => {
  const { node, packageSlug, revision } = input

  if (node.type === "paragraph") {
    return Option.some({ kind: "paragraph", parts: inlineParts(node.children, packageSlug, revision) })
  }

  if (node.type === "code") {
    return Option.some({ kind: "code", language: node.lang ?? "text", source: node.value })
  }

  if (node.type === "heading" && node.depth !== 1) {
    const text = inlineText(inlineParts(node.children, packageSlug, revision))
    return text.length === 0
      ? Option.none()
      : Option.some({ kind: "heading", depth: node.depth, id: guideSlug(text), text })
  }

  if (node.type === "list") {
    return Option.some({
      kind: "list",
      ordered: node.ordered === true,
      items: Arr.map(node.children, (item) => itemParts(item, packageSlug, revision))
    })
  }

  if (node.type === "blockquote") {
    return Option.some({ kind: "quote", parts: blockquoteParts(node.children, packageSlug, revision) })
  }

  if (node.type === "table") {
    const cells = Arr.map(node.children, (row) =>
      Arr.map(row.children, (cell) => cellParts(cell, packageSlug, revision)))

    return Option.some({
      kind: "table",
      headers: cells[0] ?? [],
      rows: cells.slice(1)
    })
  }

  return Option.none()
}
