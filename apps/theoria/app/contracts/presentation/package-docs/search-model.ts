import {
  type PackageDocsBundle as RootPackageDocsBundle,
  type PackageDocsCatalogEntry as RootPackageDocsCatalogEntry,
  type PackageDocsExample as RootPackageDocsExample,
  type PackageDocsProofCommand as RootPackageDocsProofCommand,
  type PackageDocsReleaseSnapshot as RootPackageDocsReleaseSnapshot,
  PackageDocsRichTextDocument,
  PackageDocsRichTextTextNode,
  type PackageDocsSearchResult,
  type PackageDocsSectionBlock as RootPackageDocsSectionBlock,
  type PackageDocsSourceKind,
  type PackageName,
  PackageNameSchema
} from "@theoria/source-proof/contracts"
import { Array as Arr, Match, Schema } from "effect"

import { PackageDocsPackagePageRoute } from "./page-route.js"
import { packageDocsSectionFragmentId, packageDocsSectionHref } from "./section-fragment.js"

const compactWhitespace = (value: string): string => value.replace(/\s+/gu, " ").trim()

const boundedExcerpt = (value: string): string => {
  const compact = compactWhitespace(value)

  return compact.length <= 220
    ? compact
    : `${compact.slice(0, 217)}...`
}

const textDocument = (text: string): PackageDocsRichTextDocument =>
  PackageDocsRichTextDocument.make({
    children: text.length === 0 ? [] : [PackageDocsRichTextTextNode.make({ value: text })]
  })

const textFromRichTextNodes = (
  nodes: ReadonlyArray<PackageDocsRichTextDocument["children"][number]>
): string => nodes.map((node) => node._tag === "text" ? node.value : textFromRichTextNodes(node.children)).join("")

const inlineExcerptDocumentFromContentDocument = (
  contentDocument: PackageDocsRichTextDocument,
  excerpt: string
): PackageDocsRichTextDocument | null => {
  const firstChild = contentDocument.children[0]

  if (firstChild?._tag === "element" && firstChild.tagName === "p") {
    return compactWhitespace(textFromRichTextNodes(firstChild.children)) === excerpt
      ? PackageDocsRichTextDocument.make({ children: firstChild.children })
      : null
  }

  return contentDocument.children.every((node) => node._tag === "text")
      && compactWhitespace(textFromRichTextNodes(contentDocument.children)) === excerpt
    ? contentDocument
    : null
}

const excerptDocumentFromSection = (input: {
  readonly content: string
  readonly contentDocument: PackageDocsRichTextDocument | null
  readonly excerpt: string
}): PackageDocsRichTextDocument =>
  input.contentDocument === null || compactWhitespace(input.content) !== input.excerpt
    ? textDocument(input.excerpt)
    : inlineExcerptDocumentFromContentDocument(input.contentDocument, input.excerpt) ?? textDocument(input.excerpt)

const githubSourceHref = (path: string): string => `https://github.com/scenesystems/theoria/blob/main/${path}`

const tokenizeSearchIntent = (value: string): ReadonlyArray<string> =>
  compactWhitespace(value)
    .replace(/([a-z\d])([A-Z])/gu, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
    .replace(/[@/_-]+/gu, " ")
    .toLowerCase()
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter((term) => term.length > 0)

const packageDocsSearchItemId = (input: {
  readonly fragmentId: string | null
  readonly kind: PackageDocsSearchItemKind
  readonly packageId: PackageName
  readonly sourceLabel: string
}): string => `${input.packageId}:${input.kind}:${input.sourceLabel}:${input.fragmentId ?? "package"}`

const packageDocsSearchPackageHref = (packageId: PackageName): string =>
  PackageDocsPackagePageRoute.fromPackageId(packageId).path()

const packageDocsSearchSectionIdentity = (input: {
  readonly packageId: PackageName
  readonly sourceAnchor: string | null
  readonly sourcePath: string
}): { readonly fragmentId: string; readonly href: string } => {
  const fragmentId = packageDocsSectionFragmentId({
    sourceAnchor: input.sourceAnchor,
    sourcePath: input.sourcePath
  })

  return {
    fragmentId,
    href: packageDocsSectionHref({ fragmentId, packageId: input.packageId })
  }
}

const packageDocsSearchItemKindFromSourceKind = (sourceKind: PackageDocsSourceKind): PackageDocsSearchItemKind =>
  sourceKind === "example"
    ? "example"
    : sourceKind === "module-doc"
    ? "api"
    : sourceKind === "package-manifest"
    ? "package-entry"
    : sourceKind === "proof-command"
    ? "verification"
    : sourceKind === "readme"
    ? "guide"
    : "release-history"

const packageDocsSearchItemKindLabel = (kind: PackageDocsSearchItemKind): string =>
  Match.value(kind).pipe(
    Match.when("api", () => "API"),
    Match.when("example", () => "Example"),
    Match.when("guide", () => "Guide"),
    Match.when("package-entry", () => "Entry"),
    Match.when("release-history", () => "Release"),
    Match.when("verification", () => "Proof command"),
    Match.exhaustive
  )

const packageDocsSearchLaneTitle = (kind: PackageDocsSearchLaneKind): string =>
  Match.value(kind).pipe(
    Match.when("api", () => "API reference"),
    Match.when("example", () => "Examples"),
    Match.when("guide", () => "Guides"),
    Match.when("package-entry", () => "Entry points"),
    Match.when("recent", () => "Recents"),
    Match.when("release-history", () => "Release history"),
    Match.when("verification", () => "Proof commands"),
    Match.exhaustive
  )

const packageDocsSearchLaneSummary = (kind: PackageDocsSearchLaneKind, packageId: PackageName | null): string =>
  Match.value(kind).pipe(
    Match.when("api", () => "Reference surfaces with the strongest contract and symbol coverage."),
    Match.when("example", () =>
      packageId === null
        ? "Runnable study examples and end-to-end usage surfaces across the package library."
        : `Runnable usage examples and study workflows inside ${packageId}.`),
    Match.when("guide", () => "Guides, README sections, and explanatory docs."),
    Match.when("package-entry", () =>
      packageId === null
        ? "High-signal package entry points with the richest docs surface."
        : `Top entry points and landing material inside ${packageId}.`),
    Match.when("recent", () => ""),
    Match.when("release-history", () => "Release snapshots and governance-oriented surface changes."),
    Match.when("verification", () => "Proof commands and verification entry points for the active package surface."),
    Match.exhaustive
  )

const packageDocsSearchItemsMatch = (
  left: { readonly id: string },
  right: { readonly id: string }
): boolean => left.id === right.id

const uniqueSearchItems = (items: ReadonlyArray<PackageDocsSearchItem>): ReadonlyArray<PackageDocsSearchItem> =>
  items.filter((item, index) => items.findIndex((candidate) => packageDocsSearchItemsMatch(candidate, item)) === index)

const packageDocsRecentSelectionBoost = (
  result: PackageDocsSearchResult,
  recentSelections: ReadonlyArray<PackageDocsSearchItem>
): number => {
  const fragmentId = packageDocsSectionFragmentId({
    sourceAnchor: result.source.anchor,
    sourcePath: result.source.path
  })
  const recentIndex = recentSelections.findIndex((selection) =>
    selection.packageId === result.packageId
    && selection.sourceLabel === result.source.path
    && selection.fragmentId === fragmentId
  )

  return recentIndex === -1 ? 0 : Math.max(0, 12 - recentIndex * 3)
}

const packageDocsCatalogEntrySummary = (entry: RootPackageDocsCatalogEntry): string =>
  entry.description ??
    `${entry.exampleCount} examples, ${entry.moduleDocCount} module docs, ${entry.proofCommandCount} proof commands.`

const packageDocsSearchIntentKeywords = {
  api: ["api", "class", "constructor", "function", "interface", "module", "reference", "schema", "symbol", "type"],
  example: ["demo", "example", "quick", "start", "tutorial", "usage"],
  guide: ["docs", "guide", "intro", "overview", "readme"],
  "release-history": ["changelog", "release", "version"],
  verification: ["build", "check", "command", "lint", "proof", "publish", "script", "test", "validate", "verify"]
}

const queryLaneOrder = (intent: PackageDocsSearchIntent): ReadonlyArray<PackageDocsSearchLaneKind> =>
  intent === "api"
    ? ["api", "guide", "example", "verification", "release-history", "package-entry"]
    : intent === "example"
    ? ["example", "guide", "api", "verification", "release-history", "package-entry"]
    : intent === "guide"
    ? ["guide", "api", "example", "verification", "release-history", "package-entry"]
    : intent === "mixed"
    ? ["example", "api", "verification", "guide", "release-history", "package-entry"]
    : intent === "release-history"
    ? ["release-history", "guide", "api", "example", "verification", "package-entry"]
    : ["verification", "example", "api", "guide", "release-history", "package-entry"]

const emptyLaneOrder = (packageId: PackageName | null): ReadonlyArray<PackageDocsSearchLaneKind> =>
  packageId === null
    ? ["recent", "package-entry"]
    : ["recent", "example", "verification", "package-entry", "guide", "release-history"]

export const PackageDocsSearchIntent = Schema.Literal(
  "api",
  "example",
  "guide",
  "mixed",
  "release-history",
  "verification"
)

export type PackageDocsSearchIntent = typeof PackageDocsSearchIntent.Type

export const PackageDocsSearchItemKind = Schema.Literal(
  "api",
  "example",
  "guide",
  "package-entry",
  "release-history",
  "verification"
)

export type PackageDocsSearchItemKind = typeof PackageDocsSearchItemKind.Type

export const PackageDocsSearchLaneKind = Schema.Literal(
  "api",
  "example",
  "guide",
  "package-entry",
  "recent",
  "release-history",
  "verification"
)

export type PackageDocsSearchLaneKind = typeof PackageDocsSearchLaneKind.Type

export class PackageDocsSearchItem extends Schema.Class<PackageDocsSearchItem>("PackageDocsSearchItem")({
  excerpt: Schema.String,
  excerptDocument: PackageDocsRichTextDocument,
  fragmentId: Schema.NullOr(Schema.String),
  href: Schema.String,
  id: Schema.String,
  kind: PackageDocsSearchItemKind,
  kindLabel: Schema.String,
  packageId: PackageNameSchema,
  sourceHref: Schema.String,
  sourceLabel: Schema.String,
  title: Schema.String,
  titleDocument: PackageDocsRichTextDocument
}) {
  static fromCatalogEntry(entry: RootPackageDocsCatalogEntry): PackageDocsSearchItem {
    const excerpt = packageDocsCatalogEntrySummary(entry)

    return PackageDocsSearchItem.make({
      excerpt,
      excerptDocument: textDocument(excerpt),
      fragmentId: null,
      href: packageDocsSearchPackageHref(entry.packageId),
      id: packageDocsSearchItemId({
        fragmentId: null,
        kind: "package-entry",
        packageId: entry.packageId,
        sourceLabel: entry.readmePath
      }),
      kind: "package-entry",
      kindLabel: packageDocsSearchItemKindLabel("package-entry"),
      packageId: entry.packageId,
      sourceHref: githubSourceHref(entry.readmePath),
      sourceLabel: entry.readmePath,
      title: entry.packageId,
      titleDocument: textDocument(entry.packageId)
    })
  }

  static fromExample(example: RootPackageDocsExample): PackageDocsSearchItem {
    const section = packageDocsSearchSectionIdentity({
      packageId: example.source.packageId,
      sourceAnchor: example.block.source.anchor,
      sourcePath: example.source.path
    })

    const excerpt = boundedExcerpt(example.block.content.length === 0 ? example.title : example.block.content)

    return PackageDocsSearchItem.make({
      excerpt,
      excerptDocument: excerptDocumentFromSection({
        content: example.block.content.length === 0 ? example.title : example.block.content,
        contentDocument: example.block.contentDocument,
        excerpt
      }),
      fragmentId: section.fragmentId,
      href: section.href,
      id: packageDocsSearchItemId({
        fragmentId: section.fragmentId,
        kind: "example",
        packageId: example.source.packageId,
        sourceLabel: example.source.path
      }),
      kind: "example",
      kindLabel: packageDocsSearchItemKindLabel("example"),
      packageId: example.source.packageId,
      sourceHref: githubSourceHref(example.source.path),
      sourceLabel: example.source.path,
      title: example.title,
      titleDocument: example.block.titleDocument
    })
  }

  static fromPackageBundle(bundle: RootPackageDocsBundle): PackageDocsSearchItem {
    const readmePreview = bundle.readme.blocks[0]?.content ?? bundle.readme.title
    const excerpt = boundedExcerpt(bundle.description ?? readmePreview)

    return PackageDocsSearchItem.make({
      excerpt,
      excerptDocument: textDocument(excerpt),
      fragmentId: null,
      href: packageDocsSearchPackageHref(bundle.packageId),
      id: packageDocsSearchItemId({
        fragmentId: null,
        kind: "package-entry",
        packageId: bundle.packageId,
        sourceLabel: bundle.readme.source.path
      }),
      kind: "package-entry",
      kindLabel: packageDocsSearchItemKindLabel("package-entry"),
      packageId: bundle.packageId,
      sourceHref: githubSourceHref(bundle.readme.source.path),
      sourceLabel: bundle.readme.source.path,
      title: bundle.packageId,
      titleDocument: textDocument(bundle.packageId)
    })
  }

  static fromProofCommand(command: RootPackageDocsProofCommand): PackageDocsSearchItem {
    const section = packageDocsSearchSectionIdentity({
      packageId: command.source.packageId,
      sourceAnchor: command.source.anchor,
      sourcePath: command.source.path
    })

    const excerpt = boundedExcerpt(command.command)

    return PackageDocsSearchItem.make({
      excerpt,
      excerptDocument: textDocument(excerpt),
      fragmentId: section.fragmentId,
      href: section.href,
      id: packageDocsSearchItemId({
        fragmentId: section.fragmentId,
        kind: "verification",
        packageId: command.source.packageId,
        sourceLabel: command.source.path
      }),
      kind: "verification",
      kindLabel: packageDocsSearchItemKindLabel("verification"),
      packageId: command.source.packageId,
      sourceHref: githubSourceHref(command.source.path),
      sourceLabel: command.source.path,
      title: command.source.title,
      titleDocument: command.block.titleDocument
    })
  }

  static fromReleaseSnapshot(snapshot: RootPackageDocsReleaseSnapshot): PackageDocsSearchItem {
    const section = packageDocsSearchSectionIdentity({
      packageId: snapshot.source.packageId,
      sourceAnchor: snapshot.source.anchor,
      sourcePath: snapshot.source.path
    })

    const excerpt = boundedExcerpt(snapshot.block.content.length === 0 ? snapshot.block.title : snapshot.block.content)

    return PackageDocsSearchItem.make({
      excerpt,
      excerptDocument: excerptDocumentFromSection({
        content: snapshot.block.content.length === 0 ? snapshot.block.title : snapshot.block.content,
        contentDocument: snapshot.block.contentDocument,
        excerpt
      }),
      fragmentId: section.fragmentId,
      href: section.href,
      id: packageDocsSearchItemId({
        fragmentId: section.fragmentId,
        kind: "release-history",
        packageId: snapshot.source.packageId,
        sourceLabel: snapshot.source.path
      }),
      kind: "release-history",
      kindLabel: packageDocsSearchItemKindLabel("release-history"),
      packageId: snapshot.source.packageId,
      sourceHref: githubSourceHref(snapshot.source.path),
      sourceLabel: snapshot.source.path,
      title: snapshot.block.title,
      titleDocument: snapshot.block.titleDocument
    })
  }

  static fromResult(result: PackageDocsSearchResult): PackageDocsSearchItem {
    const kind = packageDocsSearchItemKindFromSourceKind(result.source.kind)
    const section = packageDocsSearchSectionIdentity({
      packageId: result.packageId,
      sourceAnchor: result.source.anchor,
      sourcePath: result.source.path
    })

    return PackageDocsSearchItem.make({
      excerpt: result.excerpt,
      excerptDocument: result.excerptDocument,
      fragmentId: section.fragmentId,
      href: section.href,
      id: packageDocsSearchItemId({
        fragmentId: section.fragmentId,
        kind,
        packageId: result.packageId,
        sourceLabel: result.source.path
      }),
      kind,
      kindLabel: packageDocsSearchItemKindLabel(kind),
      packageId: result.packageId,
      sourceHref: githubSourceHref(result.source.path),
      sourceLabel: result.source.path,
      title: result.title,
      titleDocument: result.titleDocument
    })
  }

  static fromSectionBlock(packageId: PackageName, block: RootPackageDocsSectionBlock): PackageDocsSearchItem {
    const kind = packageDocsSearchItemKindFromSourceKind(block.source.kind)
    const section = packageDocsSearchSectionIdentity({
      packageId,
      sourceAnchor: block.source.anchor,
      sourcePath: block.source.path
    })

    const excerpt = boundedExcerpt(block.content.length === 0 ? block.title : block.content)

    return PackageDocsSearchItem.make({
      excerpt,
      excerptDocument: textDocument(excerpt),
      fragmentId: section.fragmentId,
      href: section.href,
      id: packageDocsSearchItemId({
        fragmentId: section.fragmentId,
        kind,
        packageId,
        sourceLabel: block.source.path
      }),
      kind,
      kindLabel: packageDocsSearchItemKindLabel(kind),
      packageId,
      sourceHref: githubSourceHref(block.source.path),
      sourceLabel: block.source.path,
      title: block.title,
      titleDocument: block.titleDocument
    })
  }
}

export class PackageDocsSearchLane extends Schema.Class<PackageDocsSearchLane>("PackageDocsSearchLane")({
  items: Schema.Array(PackageDocsSearchItem),
  kind: PackageDocsSearchLaneKind,
  summary: Schema.String,
  title: Schema.String
}) {}

export class PackageDocsSearchModel extends Schema.Class<PackageDocsSearchModel>("PackageDocsSearchModel")({
  intent: PackageDocsSearchIntent,
  lanes: Schema.Array(PackageDocsSearchLane),
  presentationItems: Schema.Array(PackageDocsSearchItem),
  query: Schema.String,
  resultSummary: Schema.String,
  results: Schema.Array(PackageDocsSearchItem),
  scopeDescription: Schema.String,
  scopeLabel: Schema.String
}) {
  static project(input: {
    readonly intent: PackageDocsSearchIntent
    readonly packageId: PackageName | null
    readonly query: string
    readonly recentSelections: ReadonlyArray<PackageDocsSearchItem>
    readonly results: ReadonlyArray<PackageDocsSearchResult>
    readonly suggestions: ReadonlyArray<PackageDocsSearchItem>
  }): PackageDocsSearchModel {
    const trimmedQuery = compactWhitespace(input.query)
    const scopeLabel = PackageDocsSearchModel.scopeLabel(input.packageId)
    const recentSelections = uniqueSearchItems(input.recentSelections)
    const rankedResults = PackageDocsSearchModel.rankResults(input.results, recentSelections)
    const resultItems = uniqueSearchItems(rankedResults.map(PackageDocsSearchItem.fromResult))
    const suggestionItems = uniqueSearchItems(
      input.suggestions.filter((item) => recentSelections.every((recent) => !packageDocsSearchItemsMatch(recent, item)))
    )
    const flattenedResults = trimmedQuery.length === 0
      ? uniqueSearchItems(Arr.appendAll(recentSelections, suggestionItems))
      : resultItems
    const lanes = trimmedQuery.length === 0
      ? PackageDocsSearchModel.emptyLanes({
        packageId: input.packageId,
        recentSelections,
        suggestions: suggestionItems
      })
      : PackageDocsSearchModel.queryLanes({
        intent: input.intent,
        items: flattenedResults,
        packageId: input.packageId
      })

    return PackageDocsSearchModel.make({
      intent: input.intent,
      lanes,
      presentationItems: uniqueSearchItems(Arr.flatMap(lanes, (lane) => lane.items)),
      query: input.query,
      resultSummary: PackageDocsSearchModel.resultSummary({
        query: trimmedQuery,
        resultCount: flattenedResults.length,
        scopeLabel
      }),
      results: flattenedResults,
      scopeDescription: PackageDocsSearchModel.scopeDescription(input.packageId),
      scopeLabel
    })
  }

  static emptyLanes(input: {
    readonly packageId: PackageName | null
    readonly recentSelections: ReadonlyArray<PackageDocsSearchItem>
    readonly suggestions: ReadonlyArray<PackageDocsSearchItem>
  }): ReadonlyArray<PackageDocsSearchLane> {
    return emptyLaneOrder(input.packageId).flatMap((kind) => {
      const items = kind === "recent"
        ? input.recentSelections
        : input.suggestions.filter((item) => item.kind === kind)

      return items.length === 0
        ? []
        : [PackageDocsSearchLane.make({
          items,
          kind,
          summary: packageDocsSearchLaneSummary(kind, input.packageId),
          title: packageDocsSearchLaneTitle(kind)
        })]
    })
  }

  static queryLanes(input: {
    readonly intent: PackageDocsSearchIntent
    readonly items: ReadonlyArray<PackageDocsSearchItem>
    readonly packageId: PackageName | null
  }): ReadonlyArray<PackageDocsSearchLane> {
    return queryLaneOrder(input.intent).flatMap((kind) => {
      const items = input.items.filter((item) => item.kind === kind)

      return items.length === 0
        ? []
        : [PackageDocsSearchLane.make({
          items,
          kind,
          summary: packageDocsSearchLaneSummary(kind, input.packageId),
          title: packageDocsSearchLaneTitle(kind)
        })]
    })
  }

  static rankResults(
    results: ReadonlyArray<PackageDocsSearchResult>,
    recentSelections: ReadonlyArray<PackageDocsSearchItem>
  ): ReadonlyArray<PackageDocsSearchResult> {
    return results.slice().sort((left, right) =>
      (right.score + packageDocsRecentSelectionBoost(right, recentSelections))
        - (left.score + packageDocsRecentSelectionBoost(left, recentSelections))
      || left.packageId.localeCompare(right.packageId)
      || left.source.path.localeCompare(right.source.path)
      || left.title.localeCompare(right.title)
    )
  }

  static resultSummary(input: {
    readonly query: string
    readonly resultCount: number
    readonly scopeLabel: string
  }): string {
    return input.query.length === 0
      ? ""
      : input.resultCount === 0
      ? `No results for "${input.query}" in ${input.scopeLabel.toLowerCase()}.`
      : `${input.resultCount} match${
        input.resultCount === 1 ? "" : "es"
      } for "${input.query}" in ${input.scopeLabel.toLowerCase()}.`
  }

  static scopeDescription(packageId: PackageName | null): string {
    return packageId === null
      ? "Search guides, API reference, examples, release history, and verification commands across the full package library."
      : `Search guides, API reference, examples, release history, and verification commands inside ${packageId}.`
  }

  static scopeLabel(packageId: PackageName | null): string {
    return packageId === null ? "Package library" : `${packageId} guide`
  }
}

export const classifyPackageDocsSearchIntent = (query: string): PackageDocsSearchIntent => {
  const terms = tokenizeSearchIntent(query)
  const apiScore = terms.filter((term) => packageDocsSearchIntentKeywords.api.includes(term)).length
  const exampleScore = terms.filter((term) => packageDocsSearchIntentKeywords.example.includes(term)).length
  const guideScore = terms.filter((term) => packageDocsSearchIntentKeywords.guide.includes(term)).length
  const releaseHistoryScore =
    terms.filter((term) => packageDocsSearchIntentKeywords["release-history"].includes(term)).length
  const verificationScore = terms.filter((term) => packageDocsSearchIntentKeywords.verification.includes(term)).length

  return exampleScore > 0
      && exampleScore >= apiScore
      && exampleScore >= guideScore
      && exampleScore >= releaseHistoryScore
      && exampleScore >= verificationScore
    ? "example"
    : verificationScore > 0
        && verificationScore >= apiScore
        && verificationScore >= guideScore
        && verificationScore >= releaseHistoryScore
    ? "verification"
    : apiScore > 0
        && apiScore >= guideScore
        && apiScore >= releaseHistoryScore
    ? "api"
    : guideScore > 0 && guideScore >= releaseHistoryScore
    ? "guide"
    : releaseHistoryScore > 0
    ? "release-history"
    : "mixed"
}

export const packageDocsSearchSuggestionsFromBundle = (
  bundle: RootPackageDocsBundle
): ReadonlyArray<PackageDocsSearchItem> =>
  uniqueSearchItems(
    Arr.appendAll(
      [PackageDocsSearchItem.fromPackageBundle(bundle)],
      Arr.appendAll(
        bundle.examples.slice(0, 4).map(PackageDocsSearchItem.fromExample),
        Arr.appendAll(
          bundle.proofCommands.slice(0, 3).map(PackageDocsSearchItem.fromProofCommand),
          Arr.appendAll(
            bundle.readme.blocks.slice(0, 2).map((block) =>
              PackageDocsSearchItem.fromSectionBlock(bundle.packageId, block)
            ),
            bundle.releaseSnapshots.slice().reverse().slice(0, 2).map(PackageDocsSearchItem.fromReleaseSnapshot)
          )
        )
      )
    )
  )

export const packageDocsSearchSuggestionsFromCatalog = (
  entries: ReadonlyArray<RootPackageDocsCatalogEntry>
): ReadonlyArray<PackageDocsSearchItem> =>
  entries
    .slice()
    .sort((left, right) =>
      (right.exampleCount * 3 + right.proofCommandCount * 2 + right.moduleDocCount)
        - (left.exampleCount * 3 + left.proofCommandCount * 2 + left.moduleDocCount)
      || left.packageId.localeCompare(right.packageId)
    )
    .slice(0, 6)
    .map(PackageDocsSearchItem.fromCatalogEntry)
