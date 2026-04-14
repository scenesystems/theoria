import { Array as Arr, HashMap, HashSet, Match, Option, Schema } from "effect"

import {
  PackageDocsExcerptKindSchema,
  PackageDocsPackageIdSchema,
  PackageDocsRichTextDocument,
  PackageDocsRichTextTextNode,
  PackageDocsSearchResultSchema,
  PackageDocsSourceKindSchema,
  PackageDocsSourceRefSchema
} from "./packageDocsSchema.js"
import type {
  PackageDocsBundle,
  PackageDocsCorpus,
  PackageDocsExcerptKind,
  PackageDocsQuery,
  PackageDocsSearchResult,
  PackageDocsSectionBlock,
  PackageDocsSourceKind
} from "./packageDocsSchema.js"

const compactWhitespace = (value: string): string => value.replace(/\s+/gu, " ").trim()

const normalizeSearchText = (value: string): string => compactWhitespace(value).toLowerCase()

const normalizeSearchTokensText = (value: string): string =>
  compactWhitespace(value)
    .replace(/([a-z\d])([A-Z])/gu, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
    .replace(/[@/_-]+/gu, " ")
    .toLowerCase()

const tokenize = (value: string): ReadonlyArray<string> =>
  normalizeSearchTokensText(value)
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter((term) => term.length > 0)

const uniqueTokens = (value: string): ReadonlyArray<string> => Arr.fromIterable(HashSet.fromIterable(tokenize(value)))

const uniqueStrings = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  Arr.fromIterable(HashSet.fromIterable(values))

const uniqueIndexes = (values: ReadonlyArray<number>): ReadonlyArray<number> =>
  Arr.fromIterable(HashSet.fromIterable(values))

const tokenPrefixes = (token: string): ReadonlyArray<string> =>
  token.length < 2
    ? []
    : Arr.makeBy(token.length - 1, (prefixIndex) => token.slice(0, prefixIndex + 2))

const boundedExcerpt = (value: string): string => {
  const compact = compactWhitespace(value)

  return compact.length <= 240
    ? compact
    : `${compact.slice(0, 237)}...`
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

const excerptDocumentFromBlock = (input: {
  readonly block: PackageDocsSectionBlock
  readonly excerpt: string
}): PackageDocsRichTextDocument => {
  const sourceText = input.block.content.length > 0 ? input.block.content : input.block.title

  return input.block.contentDocument === null || compactWhitespace(sourceText) !== input.excerpt
    ? textDocument(input.excerpt)
    : inlineExcerptDocumentFromContentDocument(
      input.block.contentDocument,
      input.excerpt
    ) ?? textDocument(input.excerpt)
}

const searchableBlocks = (bundle: PackageDocsBundle): ReadonlyArray<PackageDocsSectionBlock> =>
  Arr.appendAll(
    Arr.appendAll(
      Arr.appendAll(
        Arr.appendAll(bundle.readme.blocks, Arr.flatMap(bundle.moduleDocs, (document) => document.blocks)),
        Arr.map(bundle.examples, (example) => example.block)
      ),
      Arr.map(bundle.releaseSnapshots, (snapshot) => snapshot.block)
    ),
    Arr.map(bundle.proofCommands, (command) => command.block)
  )

const PackageDocsSearchIntent = Schema.Literal(
  "api",
  "example",
  "guide",
  "mixed",
  "release-history",
  "verification"
)

type PackageDocsSearchIntent = typeof PackageDocsSearchIntent.Type

const PackageDocsSearchPlan = Schema.Struct({
  candidateTerms: Schema.Array(Schema.String),
  intent: PackageDocsSearchIntent,
  synonymTerms: Schema.Array(Schema.String),
  terms: Schema.Array(Schema.String)
})

type PackageDocsSearchPlan = typeof PackageDocsSearchPlan.Type

const querySynonyms: Readonly<Record<string, ReadonlyArray<string>>> = {
  api: ["reference", "module", "symbol"],
  changelog: ["release", "version", "snapshot"],
  check: ["verify", "validate", "proof"],
  demo: ["example", "usage"],
  docs: ["guide", "readme", "reference"],
  example: ["demo", "usage", "quick", "start"],
  guide: ["docs", "readme", "reference"],
  readme: ["guide", "docs", "overview"],
  reference: ["api", "guide", "docs"],
  release: ["snapshot", "version", "changelog"],
  restore: ["resume", "snapshot", "recover"],
  resume: ["restore", "snapshot", "recover"],
  run: ["study", "trial", "objective"],
  snapshot: ["resume", "restore", "checkpoint"],
  study: ["run", "trial", "objective"],
  validate: ["verify", "check", "proof"],
  verify: ["proof", "check", "validate"]
}

const searchIntentKeywords: Readonly<Record<Exclude<PackageDocsSearchIntent, "mixed">, ReadonlyArray<string>>> = {
  api: ["api", "class", "constructor", "function", "interface", "module", "reference", "schema", "symbol", "type"],
  example: ["demo", "example", "quick", "start", "tutorial", "usage"],
  guide: ["docs", "guide", "intro", "overview", "readme"],
  "release-history": ["changelog", "release", "version"],
  verification: ["build", "check", "command", "lint", "proof", "publish", "script", "test", "validate", "verify"]
}

const buildSearchPlan = (trimmedQuery: string): PackageDocsSearchPlan => {
  const terms = tokenize(trimmedQuery)
  const synonymTerms = uniqueStrings(Arr.flatMap(terms, (term) => querySynonyms[term] ?? []))
  const apiScore = terms.filter((term) => searchIntentKeywords.api.includes(term)).length
  const exampleScore = terms.filter((term) => searchIntentKeywords.example.includes(term)).length
  const guideScore = terms.filter((term) => searchIntentKeywords.guide.includes(term)).length
  const releaseHistoryScore = terms.filter((term) => searchIntentKeywords["release-history"].includes(term)).length
  const verificationScore = terms.filter((term) => searchIntentKeywords.verification.includes(term)).length

  return Schema.decodeUnknownSync(PackageDocsSearchPlan)({
    candidateTerms: uniqueStrings(Arr.appendAll(terms, synonymTerms)),
    intent: exampleScore > 0
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
      : apiScore > 0 && apiScore >= guideScore && apiScore >= releaseHistoryScore
      ? "api"
      : guideScore > 0 && guideScore >= releaseHistoryScore
      ? "guide"
      : releaseHistoryScore > 0
      ? "release-history"
      : "mixed",
    synonymTerms,
    terms
  })
}

const isSingleEditDistance = (left: string, right: string): boolean => {
  if (left === right) {
    return false
  }

  if (Math.abs(left.length - right.length) > 1) {
    return false
  }

  const walk = (leftIndex: number, rightIndex: number, remainingEdits: number): boolean =>
    remainingEdits < 0
      ? false
      : leftIndex === left.length || rightIndex === right.length
      ? left.length - leftIndex + (right.length - rightIndex) <= remainingEdits
      : left[leftIndex] === right[rightIndex]
      ? walk(leftIndex + 1, rightIndex + 1, remainingEdits)
      : remainingEdits === 0
      ? false
      : left.length === right.length
      ? walk(leftIndex + 1, rightIndex + 1, remainingEdits - 1)
      : left.length > right.length
      ? walk(leftIndex + 1, rightIndex, remainingEdits - 1)
      : walk(leftIndex, rightIndex + 1, remainingEdits - 1)

  return walk(0, 0, 1)
}

const isSingleTransposition = (left: string, right: string): boolean => {
  if (left.length !== right.length || left === right) {
    return false
  }

  const mismatchIndexes = Arr.makeBy(left.length, (index) => index).filter((index) => left[index] !== right[index])
  const firstMismatch = mismatchIndexes[0] ?? -1
  const secondMismatch = mismatchIndexes[1] ?? -1

  return mismatchIndexes.length === 2
    && secondMismatch === firstMismatch + 1
    && left[firstMismatch] === right[secondMismatch]
    && left[secondMismatch] === right[firstMismatch]
}

const isBoundedTypoMatch = (token: string, term: string): boolean =>
  term.length >= 4
  && !token.startsWith(term)
  && !term.startsWith(token)
  && (isSingleEditDistance(token, term) || isSingleTransposition(token, term))

export class PackageDocsSearchIndexDocument extends Schema.Class<PackageDocsSearchIndexDocument>(
  "PackageDocsSearchIndexDocument"
)({
  blockKind: PackageDocsExcerptKindSchema,
  contentSearchable: Schema.String,
  contentTokens: Schema.Array(Schema.String),
  excerpt: Schema.String,
  excerptDocument: PackageDocsRichTextDocument,
  packageId: PackageDocsPackageIdSchema,
  packageSearchable: Schema.String,
  packageTokens: Schema.Array(Schema.String),
  pathSearchable: Schema.String,
  pathTokens: Schema.Array(Schema.String),
  searchable: Schema.String,
  source: PackageDocsSourceRefSchema,
  sourceKind: PackageDocsSourceKindSchema,
  title: Schema.String,
  titleDocument: PackageDocsRichTextDocument,
  titleSearchable: Schema.String,
  titleTokens: Schema.Array(Schema.String),
  tokens: Schema.Array(Schema.String)
}) {
  static fromBlock(bundle: PackageDocsBundle, block: PackageDocsSectionBlock): PackageDocsSearchIndexDocument {
    const titleSearchable = normalizeSearchText(block.title)
    const contentSearchable = normalizeSearchText(block.content)
    const pathSearchable = normalizeSearchText(block.source.path)
    const packageSearchable = normalizeSearchText(bundle.packageId)
    const titleTokens = uniqueTokens(block.title)
    const contentTokens = uniqueTokens(block.content)
    const pathTokens = uniqueTokens(block.source.path)
    const packageTokens = uniqueTokens(bundle.packageId)
    const excerpt = boundedExcerpt(block.content.length > 0 ? block.content : block.title)

    return PackageDocsSearchIndexDocument.make({
      blockKind: block.kind,
      contentSearchable,
      contentTokens,
      excerpt,
      excerptDocument: excerptDocumentFromBlock({ block, excerpt }),
      packageId: bundle.packageId,
      packageSearchable,
      packageTokens,
      pathSearchable,
      pathTokens,
      searchable: normalizeSearchText(`${bundle.packageId}\n${block.title}\n${block.content}\n${block.source.path}`),
      source: block.source,
      sourceKind: block.source.kind,
      title: block.title,
      titleDocument: block.titleDocument,
      titleSearchable,
      titleTokens,
      tokens: Arr.fromIterable(
        HashSet.fromIterable(
          Arr.appendAll(Arr.appendAll(titleTokens, contentTokens), Arr.appendAll(pathTokens, packageTokens))
        )
      )
    })
  }
}

export class PackageDocsSearchIndex extends Schema.Class<PackageDocsSearchIndex>("PackageDocsSearchIndex")({
  documents: Schema.Array(PackageDocsSearchIndexDocument),
  keywordTokens: Schema.Array(Schema.String),
  prefixIndex: Schema.HashMap({
    key: Schema.String,
    value: Schema.Array(Schema.Number)
  }),
  tokenIndex: Schema.HashMap({
    key: Schema.String,
    value: Schema.Array(Schema.Number)
  })
}) {}

const appendTokenIndex = (
  state: HashMap.HashMap<string, ReadonlyArray<number>>,
  token: string,
  documentIndex: number
): HashMap.HashMap<string, ReadonlyArray<number>> =>
  HashMap.set(
    state,
    token,
    Arr.append(HashMap.get(state, token).pipe(Option.getOrElse(() => Arr.empty<number>())), documentIndex)
  )

export const buildPackageDocsSearchIndex = (corpus: PackageDocsCorpus): PackageDocsSearchIndex => {
  const documents = corpus.bundles.flatMap((bundle) =>
    searchableBlocks(bundle).map((block) => PackageDocsSearchIndexDocument.fromBlock(bundle, block))
  )

  return PackageDocsSearchIndex.make({
    documents,
    keywordTokens: uniqueStrings(
      Arr.flatMap(
        documents,
        (document) => Arr.appendAll(document.titleTokens, Arr.appendAll(document.packageTokens, document.pathTokens))
      )
    ),
    prefixIndex: Arr.reduce(
      documents,
      HashMap.empty<string, ReadonlyArray<number>>(),
      (index, document, documentIndex) =>
        Arr.reduce(
          document.tokens,
          index,
          (nextIndex, token) =>
            Arr.reduce(
              tokenPrefixes(token),
              nextIndex,
              (prefixIndex, prefix) => appendTokenIndex(prefixIndex, prefix, documentIndex)
            )
        )
    ),
    tokenIndex: Arr.reduce(
      documents,
      HashMap.empty<string, ReadonlyArray<number>>(),
      (index, document, documentIndex) =>
        Arr.reduce(
          document.tokens,
          index,
          (nextIndex, token) => appendTokenIndex(nextIndex, token, documentIndex)
        )
    )
  })
}

const candidateDocumentIndexes = (
  index: PackageDocsSearchIndex,
  plan: PackageDocsSearchPlan
): ReadonlyArray<number> =>
  plan.terms.length === 0
    ? Arr.makeBy(index.documents.length, (documentIndex) => documentIndex)
    : uniqueIndexes(
      Arr.flatMap(
        plan.candidateTerms,
        (term) =>
          Arr.appendAll(
            HashMap.get(index.tokenIndex, term).pipe(Option.getOrElse(() => Arr.empty<number>())),
            HashMap.get(index.prefixIndex, term).pipe(Option.getOrElse(() => Arr.empty<number>()))
          )
      ).concat(
        Arr.flatMap(
          plan.terms,
          (term) =>
            Arr.flatMap(
              index.keywordTokens,
              (token) =>
                isBoundedTypoMatch(token, term)
                  ? HashMap.get(index.tokenIndex, token).pipe(Option.getOrElse(() => Arr.empty<number>()))
                  : Arr.empty<number>()
            )
        )
      )
    )

const tokenMatchesExactly = (tokens: ReadonlyArray<string>, term: string): boolean => tokens.includes(term)

const tokenMatchesByPrefix = (tokens: ReadonlyArray<string>, term: string): boolean =>
  !tokenMatchesExactly(tokens, term) && tokens.some((token) => token.startsWith(term))

const tokenMatchesByTypo = (tokens: ReadonlyArray<string>, term: string): boolean =>
  !tokenMatchesExactly(tokens, term)
  && !tokenMatchesByPrefix(tokens, term)
  && tokens.some((token) => isBoundedTypoMatch(token, term))

const exactMatchCount = (tokens: ReadonlyArray<string>, terms: ReadonlyArray<string>): number =>
  terms.filter((term) => tokenMatchesExactly(tokens, term)).length

const prefixMatchCount = (tokens: ReadonlyArray<string>, terms: ReadonlyArray<string>): number =>
  terms.filter((term) => tokenMatchesByPrefix(tokens, term)).length

const typoMatchCount = (tokens: ReadonlyArray<string>, terms: ReadonlyArray<string>): number =>
  terms.filter((term) => tokenMatchesByTypo(tokens, term)).length

const coveredMatchCount = (tokens: ReadonlyArray<string>, terms: ReadonlyArray<string>): number =>
  terms.filter((term) => tokenMatchesExactly(tokens, term) || tokenMatchesByPrefix(tokens, term)).length

const sourceKindIntentBoost = (
  sourceKind: PackageDocsSourceKind,
  intent: PackageDocsSearchIntent
): number => {
  if (intent === "mixed") {
    return Match.value(sourceKind).pipe(
      Match.when("example", () => 8),
      Match.when("module-doc", () => 8),
      Match.when("package-manifest", () => 2),
      Match.when("proof-command", () => 6),
      Match.when("readme", () => 7),
      Match.when("release-snapshot", () => 4),
      Match.exhaustive
    )
  }

  return Match.value(intent).pipe(
    Match.when("api", () =>
      Match.value(sourceKind).pipe(
        Match.when("module-doc", () => 26),
        Match.when("readme", () => 10),
        Match.when("example", () => 6),
        Match.when("proof-command", () => 2),
        Match.when("release-snapshot", () => 2),
        Match.when("package-manifest", () => 0),
        Match.exhaustive
      )),
    Match.when("example", () =>
      Match.value(sourceKind).pipe(
        Match.when("example", () => 26),
        Match.when("readme", () => 8),
        Match.when("module-doc", () => 6),
        Match.when("proof-command", () => 0),
        Match.when("release-snapshot", () => 2),
        Match.when("package-manifest", () => 0),
        Match.exhaustive
      )),
    Match.when("guide", () =>
      Match.value(sourceKind).pipe(
        Match.when("readme", () => 24),
        Match.when("module-doc", () => 8),
        Match.when("example", () => 6),
        Match.when("proof-command", () => 0),
        Match.when("release-snapshot", () => 2),
        Match.when("package-manifest", () => 0),
        Match.exhaustive
      )),
    Match.when("release-history", () =>
      Match.value(sourceKind).pipe(
        Match.when("release-snapshot", () => 28),
        Match.when("readme", () => 6),
        Match.when("module-doc", () => 4),
        Match.when("example", () => 2),
        Match.when("proof-command", () => 0),
        Match.when("package-manifest", () => 0),
        Match.exhaustive
      )),
    Match.when("verification", () =>
      Match.value(sourceKind).pipe(
        Match.when("proof-command", () => 30),
        Match.when("example", () => 8),
        Match.when("module-doc", () => 6),
        Match.when("readme", () => 4),
        Match.when("release-snapshot", () => 2),
        Match.when("package-manifest", () => 0),
        Match.exhaustive
      )),
    Match.exhaustive
  )
}

const blockKindBoost = (
  blockKind: PackageDocsExcerptKind,
  intent: PackageDocsSearchIntent
): number =>
  intent === "example" && blockKind === "example-code"
    ? 10
    : intent === "verification" && blockKind === "proof-command"
    ? 10
    : intent === "release-history" && blockKind === "release-snapshot-summary"
    ? 10
    : intent === "guide" && blockKind === "readme-section"
    ? 6
    : intent === "api" && blockKind === "module-doc-section"
    ? 6
    : 0

const searchResult = (input: {
  readonly document: PackageDocsSearchIndexDocument
  readonly score: number
}): PackageDocsSearchResult =>
  Schema.decodeUnknownSync(PackageDocsSearchResultSchema)({
    excerpt: input.document.excerpt,
    excerptDocument: input.document.excerptDocument,
    packageId: input.document.packageId,
    score: input.score,
    source: input.document.source,
    title: input.document.title,
    titleDocument: input.document.titleDocument
  })

const searchScore = (
  document: PackageDocsSearchIndexDocument,
  trimmedQuery: string,
  plan: PackageDocsSearchPlan
): number => {
  const exactTitle = exactMatchCount(document.titleTokens, plan.terms)
  const prefixTitle = prefixMatchCount(document.titleTokens, plan.terms)
  const typoTitle = typoMatchCount(document.titleTokens, plan.terms)
  const synonymTitle = coveredMatchCount(document.titleTokens, plan.synonymTerms)
  const exactPackage = exactMatchCount(document.packageTokens, plan.terms)
  const prefixPackage = prefixMatchCount(document.packageTokens, plan.terms)
  const typoPackage = typoMatchCount(document.packageTokens, plan.terms)
  const synonymPackage = coveredMatchCount(document.packageTokens, plan.synonymTerms)
  const exactPath = exactMatchCount(document.pathTokens, plan.terms)
  const prefixPath = prefixMatchCount(document.pathTokens, plan.terms)
  const typoPath = typoMatchCount(document.pathTokens, plan.terms)
  const synonymPath = coveredMatchCount(document.pathTokens, plan.synonymTerms)
  const exactContent = exactMatchCount(document.contentTokens, plan.terms)
  const prefixContent = prefixMatchCount(document.contentTokens, plan.terms)
  const synonymContent = coveredMatchCount(document.contentTokens, plan.synonymTerms)
  const coveredTerms = coveredMatchCount(document.tokens, plan.terms)
  const titlePhraseBoost = document.titleSearchable.includes(trimmedQuery) ? 18 : 0
  const packagePhraseBoost = document.packageSearchable.includes(trimmedQuery) ? 14 : 0
  const pathPhraseBoost = document.pathSearchable.includes(trimmedQuery) ? 10 : 0
  const contentPhraseBoost = document.contentSearchable.includes(trimmedQuery) ? Math.max(4, plan.terms.length * 4) : 0
  const allTermsBoost = coveredTerms === plan.terms.length ? 16 : 0
  const intentBoost = sourceKindIntentBoost(document.sourceKind, plan.intent) +
    blockKindBoost(document.blockKind, plan.intent)

  return exactTitle * 20
    + prefixTitle * 14
    + typoTitle * 10
    + synonymTitle * 6
    + exactPackage * 18
    + prefixPackage * 12
    + typoPackage * 9
    + synonymPackage * 5
    + exactPath * 12
    + prefixPath * 8
    + typoPath * 7
    + synonymPath * 4
    + exactContent * 6
    + prefixContent * 3
    + synonymContent * 2
    + titlePhraseBoost
    + packagePhraseBoost
    + pathPhraseBoost
    + contentPhraseBoost
    + allTermsBoost
    + intentBoost
}

export const searchPackageDocsIndex = (
  index: PackageDocsSearchIndex,
  query: PackageDocsQuery
): ReadonlyArray<PackageDocsSearchResult> => {
  const trimmedQuery = normalizeSearchText(query.query)

  if (trimmedQuery.length === 0) {
    return []
  }

  const plan = buildSearchPlan(trimmedQuery)
  const boundedLimit = Math.max(1, Math.floor(query.limit))

  return candidateDocumentIndexes(index, plan)
    .flatMap((documentIndex) =>
      Option.fromNullable(index.documents[documentIndex]).pipe(
        Option.match({
          onNone: () => [],
          onSome: (document) => [document]
        })
      )
    )
    .filter((document) => query.packageId === null || document.packageId === query.packageId)
    .flatMap((document) => {
      const score = searchScore(document, trimmedQuery, plan)

      if (score === 0) {
        return []
      }

      return [searchResult({ document, score })]
    })
    .sort((left, right) =>
      right.score - left.score
      || left.packageId.localeCompare(right.packageId)
      || left.source.path.localeCompare(right.source.path)
      || left.title.localeCompare(right.title)
    )
    .slice(0, boundedLimit)
}
