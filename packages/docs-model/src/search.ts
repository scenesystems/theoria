import { argmaxIndex, safeDivide, sum } from "@scenesystems/effect-math/Numeric"
import { Data, Match, Option, Order, Schema } from "effect"
import * as Arr from "effect/Array"
import * as HashMap from "effect/HashMap"
import * as HashSet from "effect/HashSet"

import type { DocsSearchEntry } from "./docs-data.js"

class PreparedSearchField extends Data.Class<{
  readonly text: string
  readonly words: ReadonlyArray<string>
  readonly weight: number
}> {}

class PreparedSearchDocument extends Data.Class<{
  readonly entry: DocsSearchEntry
  readonly name: PreparedSearchField
  readonly qualifiedName: PreparedSearchField
  readonly fields: ReadonlyArray<PreparedSearchField>
}> {}

export class PreparedDocsSearchIndex extends Data.Class<{
  readonly documents: ReadonlyArray<PreparedSearchDocument>
  readonly postings: HashMap.HashMap<string, HashSet.HashSet<number>>
  readonly vocabulary: ReadonlyArray<string>
}> {}

export const DocsSearchOptions = Schema.Struct({
  limit: Schema.Number,
  packageSlug: Schema.OptionFromNullOr(Schema.String)
})

export type DocsSearchOptions = typeof DocsSearchOptions.Type

const normalizeSearchText = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .toLocaleLowerCase("en-US")
    .replace(/\p{Mark}/gu, "")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()

const prepareField = (value: string, weight: number): PreparedSearchField => {
  const text = normalizeSearchText(value)
  return new PreparedSearchField({ text, weight, words: text.length === 0 ? [] : text.split(/\s+/u) })
}

const isSubsequence = (shorter: string, longer: string): boolean =>
  Arr.reduce(
    Arr.fromIterable(shorter),
    { cursor: 0, matched: true },
    (state, character) => {
      if (!state.matched) return state

      const index = longer.indexOf(character, state.cursor)
      return index < 0
        ? { cursor: state.cursor, matched: false }
        : { cursor: index + 1, matched: true }
    }
  ).matched

const ratio = (dividend: number, divisor: number): number => Option.getOrElse(safeDivide(dividend, divisor), () => 0)

const maximum = (values: ReadonlyArray<number>): number =>
  Option.getOrElse(Option.flatMap(argmaxIndex(values), (index) => Arr.get(values, index)), () => 0)

const fuzzySimilarity = (query: string, candidate: string): number => {
  if (query.length < 3 || candidate.length < 3) return 0

  const mismatches = query.length === candidate.length
    ? Arr.filter(Arr.range(0, query.length - 1), (index) => query.at(index) !== candidate.at(index))
    : []
  const first = mismatches.at(0) ?? -1
  const second = mismatches.at(1) ?? -1
  const transposed = mismatches.length === 2
    && query.at(first) === candidate.at(second)
    && query.at(second) === candidate.at(first)
  const sameLength = query.length === candidate.length
    ? transposed ? 0.92 : 1 - ratio(mismatches.length, query.length)
    : 0
  const shorter = query.length <= candidate.length ? query : candidate
  const longer = query.length <= candidate.length ? candidate : query
  const subsequence = longer.length - shorter.length <= 2 && isSubsequence(shorter, longer)
    ? ratio(shorter.length, longer.length)
    : 0

  return maximum([sameLength, subsequence])
}

const tokenSimilarity = (field: PreparedSearchField, query: string): number => {
  if (Arr.contains(field.words, query)) return 1
  if (Arr.some(field.words, (word) => word.startsWith(query))) return 0.9
  if (field.text.includes(query)) return 0.75

  const similarity = maximum(Arr.map(field.words, (word) => fuzzySimilarity(query, word)))
  return similarity >= 0.72 ? similarity * 0.65 : -1
}

const fieldScore = (field: PreparedSearchField, query: ReadonlyArray<string>): number => {
  const scores = Arr.map(query, (token) => tokenSimilarity(field, token))
  return Arr.some(scores, (score) => score < 0)
    ? -1
    : ratio(sum(scores), scores.length) * field.weight
}

const emptyQueryScore = (entry: DocsSearchEntry): number =>
  Match.value(entry.kind).pipe(
    Match.when("package", () => 100),
    Match.when("guide", () => 70),
    Match.when("module", () => 50),
    Match.when("symbol", () => -1),
    Match.exhaustive
  )

const matchScore = (
  document: PreparedSearchDocument,
  query: string,
  packageSlug: Option.Option<string>
): number => {
  const term = normalizeSearchText(query)
  const packageBoost = Option.exists(packageSlug, (slug) => slug === document.entry.packageSlug) ? 8 : 0

  if (term.length === 0) return emptyQueryScore(document.entry) + packageBoost

  const tokens = term.split(/\s+/u)
  const phraseScore = document.name.text === term
    ? 180
    : document.name.text.startsWith(term)
    ? 150
    : document.qualifiedName.text.includes(term)
    ? 120
    : 0
  const primaryScore = fieldScore(document.name, tokens)
  const coherentFieldScore = maximum(Arr.map(document.fields, (field) => fieldScore(field, tokens)))
  const primaryBoost = tokens.length === document.name.words.length && primaryScore >= 0 ? 50 : 0

  return coherentFieldScore < 0 ? -1 : phraseScore + primaryBoost + coherentFieldScore + packageBoost
}

const scoreOrder = Order.reverse(Order.mapInput(
  Order.number,
  (entry: { readonly score: number; readonly document: PreparedSearchDocument }) => entry.score
))

const buildPostings = (
  documents: ReadonlyArray<PreparedSearchDocument>
): HashMap.HashMap<string, HashSet.HashSet<number>> =>
  HashMap.mutate(
    HashMap.empty<string, HashSet.HashSet<number>>(),
    (postings) =>
      Arr.forEach(documents, (document, documentIndex) =>
        HashSet.forEach(
          HashSet.fromIterable(Arr.flatMap(document.fields, (field) => field.words)),
          (word) =>
            HashMap.set(
              postings,
              word,
              Option.match(HashMap.get(postings, word), {
                onNone: () => HashSet.make(documentIndex),
                onSome: (existing) => HashSet.add(existing, documentIndex)
              })
            )
        ))
  )

export const prepareDocsSearchIndex = (
  entries: ReadonlyArray<DocsSearchEntry>
): PreparedDocsSearchIndex => {
  const documents = Arr.map(entries, (entry) => {
    const name = prepareField(entry.name, 120)
    const qualifiedName = prepareField(entry.qualifiedName, 100)
    return new PreparedSearchDocument({
      entry,
      name,
      qualifiedName,
      fields: [
        name,
        qualifiedName,
        prepareField(entry.package, 80),
        prepareField(Option.getOrElse(entry.category, () => ""), 70),
        prepareField(entry.summary, 50)
      ]
    })
  })
  const postings = buildPostings(documents)

  return new PreparedDocsSearchIndex({
    documents,
    postings,
    vocabulary: Arr.fromIterable(HashMap.keys(postings))
  })
}

const candidateDocumentIndexes = (
  index: PreparedDocsSearchIndex,
  query: string
): ReadonlyArray<number> => {
  const term = normalizeSearchText(query)
  if (term.length === 0) return Arr.range(0, index.documents.length - 1)

  const matchesByToken = Arr.map(term.split(/\s+/u), (token) => {
    return Arr.reduce(index.vocabulary, HashSet.empty<number>(), (matches, word) => {
      const wordMatches = word === token
        || word.startsWith(token)
        || word.includes(token)
        || fuzzySimilarity(token, word) >= 0.72
      return wordMatches
        ? Option.match(HashMap.get(index.postings, word), {
          onNone: () => matches,
          onSome: (documents) => HashSet.union(matches, documents)
        })
        : matches
    })
  })

  return Option.match(Arr.head(matchesByToken), {
    onNone: () => [],
    onSome: (first) =>
      Arr.filter(
        Arr.fromIterable(first),
        (documentIndex) => Arr.every(matchesByToken, (matches) => HashSet.has(matches, documentIndex))
      )
  })
}

export const searchDocs = (
  index: PreparedDocsSearchIndex,
  query: string,
  options: DocsSearchOptions
): ReadonlyArray<DocsSearchEntry> =>
  Arr.take(
    Arr.map(
      Arr.sort(
        Arr.filterMap(
          candidateDocumentIndexes(index, query),
          (documentIndex) =>
            Option.flatMap(Arr.get(index.documents, documentIndex), (document) => {
              const score = matchScore(document, query, options.packageSlug)
              return score < 0 ? Option.none() : Option.some({ document, score })
            })
        ),
        scoreOrder
      ),
      ({ document }) => document.entry
    ),
    options.limit
  )
