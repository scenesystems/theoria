import { Array as Arr, Data, Option } from "effect"

import type { PackageDocsExcerptKind, PackageDocsSectionBlock, PackageDocsSourceKind } from "../packageDocsSchema.js"

class MarkdownAccumulator extends Data.Class<{
  readonly blocks: ReadonlyArray<PackageDocsSectionBlock>
  readonly currentTitle: string
  readonly currentAnchor: string
  readonly currentLines: ReadonlyArray<string>
  readonly index: number
}> {}

const frontmatterBoundary = "\n---\n"

const stripFrontmatter = (text: string): string => {
  const closingIndex = text.indexOf(frontmatterBoundary, 4)

  return text.startsWith("---\n") && closingIndex >= 0
    ? text.slice(closingIndex + frontmatterBoundary.length)
    : text
}

const headingTitle = (line: string): Option.Option<string> => {
  const trimmed = line.trim()

  return trimmed.startsWith("#")
    ? Option.some(trimmed.replace(/^#+\s*/u, ""))
    : Option.none()
}

const normalizeBlockContent = (lines: ReadonlyArray<string>): string => lines.join("\n").trim()

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
  readonly packageId: string
  readonly path: string
  readonly sourceKind: PackageDocsSourceKind
  readonly excerptKind: PackageDocsExcerptKind
  readonly state: MarkdownAccumulator
}): ReadonlyArray<PackageDocsSectionBlock> => {
  const content = normalizeBlockContent(input.state.currentLines)

  return content.length === 0 && input.state.currentTitle.length === 0
    ? input.state.blocks
    : Arr.append(input.state.blocks, {
      id: `${input.path}#${input.state.currentAnchor || `section-${input.state.index}`}`,
      kind: input.excerptKind,
      title: input.state.currentTitle,
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
  readonly packageId: string
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
    currentLines: [],
    index: 0
  }

  const finalState = stripFrontmatter(input.text)
    .split("\n")
    .reduce<MarkdownAccumulator>(
      (state, line) =>
        Option.match(headingTitle(line), {
          onNone: () =>
            new MarkdownAccumulator({
              ...state,
              currentLines: Arr.append(state.currentLines, line)
            }),
          onSome: (nextTitle) =>
            new MarkdownAccumulator({
              blocks: finalizeBlock({
                packageId: input.packageId,
                path: input.path,
                sourceKind: input.sourceKind,
                excerptKind: input.excerptKind,
                state
              }),
              currentTitle: nextTitle,
              currentAnchor: normalizePackageDocsAnchor(nextTitle),
              currentLines: [],
              index: state.index + 1
            })
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
