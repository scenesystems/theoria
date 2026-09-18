import { argmaxIndex } from "@scenesystems/effect-math/Numeric"
import { Boolean, Chunk, Match, Number as Num, Option, Order, pipe, Schema, String as Str } from "effect"
import * as Arr from "effect/Array"
import * as HashMap from "effect/HashMap"
import * as HashSet from "effect/HashSet"
import { slice as sliceString } from "effect/String"

import { type DocsSearchEntry, DocsSearchEntrySchema, type DocsSearchIndex } from "./docs-data.js"

const SearchTokens = Schema.Array(Schema.String)
type SearchTokens = typeof SearchTokens.Type

const SearchScores = Schema.Array(Schema.Number)
type SearchScores = typeof SearchScores.Type

const DocumentIndexes = Schema.Array(Schema.NonNegativeInt)
type DocumentIndexes = typeof DocumentIndexes.Type

class PreparedSearchField extends Schema.Class<PreparedSearchField>("PreparedSearchField")({
  text: Schema.String,
  words: SearchTokens,
  weight: Schema.Number
}) {}

class PreparedSearchDocument extends Schema.Class<PreparedSearchDocument>("PreparedSearchDocument")({
  entry: DocsSearchEntrySchema,
  name: PreparedSearchField,
  qualifiedName: PreparedSearchField,
  fields: Schema.Array(PreparedSearchField)
}) {}

export class PreparedDocsSearchIndex extends Schema.Class<PreparedDocsSearchIndex>("PreparedDocsSearchIndex")({
  documents: Schema.Array(PreparedSearchDocument),
  postings: Schema.HashMapFromSelf({
    key: Schema.String,
    value: Schema.HashSetFromSelf(Schema.NonNegativeInt)
  }),
  vocabulary: SearchTokens
}) {}

class SubsequenceState extends Schema.Class<SubsequenceState>("SubsequenceState")({
  cursor: Schema.NonNegativeInt,
  matched: Schema.Boolean
}) {}

class ScoredCandidate extends Schema.Class<ScoredCandidate>("ScoredCandidate")({
  document: PreparedSearchDocument,
  score: Schema.Number
}) {}

export const DocsSearchOptions = Schema.Struct({
  limit: Schema.Number,
  packageSlug: Schema.OptionFromNullOr(Schema.String)
})

export type DocsSearchOptions = typeof DocsSearchOptions.Type

const normalizeSearchText = (value: string): string =>
  pipe(
    value,
    Str.normalize("NFKD"),
    Str.replace(/([a-z0-9])([A-Z])/gu, "$1 $2"),
    Str.toLocaleLowerCase("en-US"),
    Str.replace(/\p{Mark}/gu, ""),
    Str.replace(/[^a-z0-9]+/gu, " "),
    Str.trim
  )

const prepareField = (value: string, weight: number): PreparedSearchField => {
  const text = normalizeSearchText(value)
  return new PreparedSearchField({
    text,
    weight,
    words: Boolean.match(Str.isEmpty(text), {
      onFalse: () => Str.split(text, /\s+/u),
      onTrue: Arr.empty
    })
  })
}

const isSubsequence = (shorter: string, longer: string): boolean =>
  Arr.reduce(
    Arr.fromIterable(shorter),
    new SubsequenceState({ cursor: 0, matched: true }),
    (state, character) =>
      Boolean.match(state.matched, {
        onFalse: () => state,
        onTrue: () =>
          pipe(
            longer,
            sliceString(state.cursor),
            Str.indexOf(character),
            Option.match({
              onNone: () => new SubsequenceState({ cursor: state.cursor, matched: false }),
              onSome: (index) =>
                new SubsequenceState({
                  cursor: Num.sum(state.cursor, Num.increment(index)),
                  matched: true
                })
            })
          )
      })
  ).matched

const ratio = (dividend: number, divisor: number): number => Option.getOrElse(Num.divide(dividend, divisor), () => 0)

const maximum = (values: SearchScores): number =>
  Option.getOrElse(Option.flatMap(argmaxIndex(Chunk.fromIterable(values)), (index) => Arr.get(values, index)), () => 0)

const fuzzySimilarity = (query: string, candidate: string): number => {
  const queryLength = Str.length(query)
  const candidateLength = Str.length(candidate)
  return Match.value(Boolean.or(Num.lessThan(queryLength, 3), Num.lessThan(candidateLength, 3))).pipe(
    Match.when(true, () => 0),
    Match.when(false, () => {
      const sameSize = Num.Equivalence(queryLength, candidateLength)
      const characterEquivalence = Option.getEquivalence(Str.Equivalence)
      const mismatches = Boolean.match(sameSize, {
        onFalse: Arr.empty,
        onTrue: () =>
          Arr.filter(
            Arr.range(0, Num.decrement(queryLength)),
            (index) => Boolean.not(characterEquivalence(Str.at(query, index), Str.at(candidate, index)))
          )
      })
      const first = Option.getOrElse(Arr.get(mismatches, 0), () => -1)
      const second = Option.getOrElse(Arr.get(mismatches, 1), () => -1)
      const transposed = Boolean.match(Num.Equivalence(Arr.length(mismatches), 2), {
        onFalse: () => false,
        onTrue: () =>
          Boolean.match(characterEquivalence(Str.at(query, first), Str.at(candidate, second)), {
            onFalse: () => false,
            onTrue: () => characterEquivalence(Str.at(query, second), Str.at(candidate, first))
          })
      })
      const sameLength = Boolean.match(sameSize, {
        onFalse: () => 0,
        onTrue: () =>
          Boolean.match(transposed, {
            onFalse: () => Num.subtract(1, ratio(Arr.length(mismatches), queryLength)),
            onTrue: () => 0.92
          })
      })
      const queryIsShorter = Num.lessThanOrEqualTo(queryLength, candidateLength)
      const shorter = Boolean.match(queryIsShorter, { onFalse: () => candidate, onTrue: () => query })
      const longer = Boolean.match(queryIsShorter, { onFalse: () => query, onTrue: () => candidate })
      const subsequence = Boolean.match(
        Num.lessThanOrEqualTo(Num.subtract(Str.length(longer), Str.length(shorter)), 2),
        {
          onFalse: () => 0,
          onTrue: () =>
            Boolean.match(isSubsequence(shorter, longer), {
              onFalse: () => 0,
              onTrue: () => ratio(Str.length(shorter), Str.length(longer))
            })
        }
      )

      return maximum(Arr.make(sameLength, subsequence))
    }),
    Match.exhaustive
  )
}

const tokenSimilarity = (field: PreparedSearchField, query: string): number =>
  Match.value(query).pipe(
    Match.when((token) => Arr.contains(field.words, token), () => 1),
    Match.when((token) => Arr.some(field.words, Str.startsWith(token)), () => 0.9),
    Match.when((token) => Str.includes(token)(field.text), () => 0.75),
    Match.orElse((token) => {
      const similarity = maximum(Arr.map(field.words, (word) => fuzzySimilarity(token, word)))
      return Boolean.match(Num.greaterThanOrEqualTo(similarity, 0.72), {
        onFalse: () => -1,
        onTrue: () => Num.multiply(similarity, 0.65)
      })
    })
  )

const fieldScore = (field: PreparedSearchField, query: SearchTokens): number => {
  const scores = Arr.map(query, (token) => tokenSimilarity(field, token))
  return Boolean.match(Arr.some(scores, Num.lessThan(0)), {
    onFalse: () => Num.multiply(ratio(Num.sumAll(scores), Arr.length(scores)), field.weight),
    onTrue: () => -1
  })
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
  const packageBoost = Boolean.match(
    Option.exists(packageSlug, (slug) => Str.Equivalence(slug, document.entry.packageSlug)),
    { onFalse: () => 0, onTrue: () => 8 }
  )

  return Match.value(term).pipe(
    Match.when(Str.isEmpty, () => Num.sum(emptyQueryScore(document.entry), packageBoost)),
    Match.orElse((searchTerm) => {
      const tokens = Str.split(searchTerm, /\s+/u)
      const phraseScore = Match.value(searchTerm).pipe(
        Match.when((candidate) => Str.Equivalence(document.name.text, candidate), () => 180),
        Match.when((candidate) => Str.startsWith(candidate)(document.name.text), () => 150),
        Match.when((candidate) => Str.includes(candidate)(document.qualifiedName.text), () => 120),
        Match.orElse(() => 0)
      )
      const primaryScore = fieldScore(document.name, tokens)
      const coherentFieldScore = maximum(Arr.map(document.fields, (field) => fieldScore(field, tokens)))
      const primaryBoost = Boolean.match(
        Boolean.and(
          Num.Equivalence(Arr.length(tokens), Arr.length(document.name.words)),
          Num.greaterThanOrEqualTo(primaryScore, 0)
        ),
        { onFalse: () => 0, onTrue: () => 50 }
      )

      return Boolean.match(Num.lessThan(coherentFieldScore, 0), {
        onFalse: () => Num.sumAll(Arr.make(phraseScore, primaryBoost, coherentFieldScore, packageBoost)),
        onTrue: () => -1
      })
    })
  )
}

const scoreOrder = Order.reverse(Order.mapInput(
  Order.number,
  (entry: ScoredCandidate) => entry.score
))

const buildPostings = (
  documents: PreparedDocsSearchIndex["documents"]
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
  entries: DocsSearchIndex["entries"]
): PreparedDocsSearchIndex => {
  const documents = Arr.map(entries, (entry) => {
    const name = prepareField(entry.name, 120)
    const qualifiedName = prepareField(entry.qualifiedName, 100)
    return new PreparedSearchDocument({
      entry,
      name,
      qualifiedName,
      fields: Arr.make(
        name,
        qualifiedName,
        prepareField(entry.package, 80),
        prepareField(Option.getOrElse(entry.category, () => ""), 70),
        prepareField(entry.summary, 50)
      )
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
): DocumentIndexes => {
  const term = normalizeSearchText(query)
  return Match.value(term).pipe(
    Match.when(Str.isEmpty, () =>
      Boolean.match(Arr.isEmptyReadonlyArray(index.documents), {
        onFalse: () => Arr.range(0, Num.decrement(Arr.length(index.documents))),
        onTrue: Arr.empty
      })),
    Match.orElse((searchTerm) => {
      const matchesByToken = Arr.map(Str.split(searchTerm, /\s+/u), (token) => {
        return Arr.reduce(index.vocabulary, HashSet.empty<number>(), (matches, word) => {
          const wordMatches = Match.value(word).pipe(
            Match.when((candidate) => Str.Equivalence(candidate, token), () => true),
            Match.when(Str.startsWith(token), () => true),
            Match.when(Str.includes(token), () => true),
            Match.orElse((candidate) => Num.greaterThanOrEqualTo(fuzzySimilarity(token, candidate), 0.72))
          )
          return Boolean.match(wordMatches, {
            onFalse: () => matches,
            onTrue: () =>
              Option.match(HashMap.get(index.postings, word), {
                onNone: () => matches,
                onSome: (documents) => HashSet.union(matches, documents)
              })
          })
        })
      })

      return Option.match(Arr.head(matchesByToken), {
        onNone: Arr.empty,
        onSome: (first) =>
          Arr.filter(
            Arr.fromIterable(first),
            (documentIndex) => Arr.every(matchesByToken, (matches) => HashSet.has(matches, documentIndex))
          )
      })
    })
  )
}

export const searchDocs = (
  index: PreparedDocsSearchIndex,
  query: string,
  options: DocsSearchOptions
): DocsSearchIndex["entries"] =>
  Arr.take(
    Arr.map(
      Arr.sort(
        Arr.filterMap(
          candidateDocumentIndexes(index, query),
          (documentIndex) =>
            Option.flatMap(Arr.get(index.documents, documentIndex), (document) => {
              const score = matchScore(document, query, options.packageSlug)
              return Boolean.match(Num.lessThan(score, 0), {
                onFalse: () => Option.some(new ScoredCandidate({ document, score })),
                onTrue: Option.none
              })
            })
        ),
        scoreOrder
      ),
      ({ document }) => document.entry
    ),
    options.limit
  )
