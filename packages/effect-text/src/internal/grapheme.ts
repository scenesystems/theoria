/**
 * Unicode 17.0 default extended grapheme clusters (UAX #29, revision 47).
 * Property lookup and the boundary automaton consume public Effect APIs only.
 *
 * @since 0.4.3
 */
import {
  Array as Arr,
  Boolean,
  Chunk,
  Iterable,
  Match,
  Number,
  Option,
  Order,
  RedBlackTree,
  Schema,
  String,
  Tuple
} from "effect"

import rawData from "./graphemeData.json" with { type: "json" }
import type { CodePointRange, Graphemes } from "./graphemeSchema.js"
import { ConjunctBreak, GraphemeBreak, GraphemeData } from "./graphemeSchema.js"

const data = Schema.decodeUnknownSync(GraphemeData)(rawData)
const graphemeRanges = RedBlackTree.fromIterable(
  Arr.map(data.grapheme, (range) => Tuple.make(range.start, range)),
  Order.number
)
const conjunctRanges = RedBlackTree.fromIterable(
  Arr.map(data.conjunct, (range) => Tuple.make(range.start, range)),
  Order.number
)
const pictographicRanges = RedBlackTree.fromIterable(
  Arr.map(data.pictographic, (range) => Tuple.make(range.start, range)),
  Order.number
)

// The UCD ranges are disjoint. The nearest preceding start is the only range
// that can contain this code point; the end check distinguishes gaps.
const rangeAt = <A extends typeof CodePointRange.Type>(
  ranges: RedBlackTree.RedBlackTree<number, A>,
  codePoint: number
) =>
  Iterable.head(RedBlackTree.lessThanEqualReversed(ranges, codePoint)).pipe(
    Option.map(Tuple.getSecond),
    Option.filter((range) => Number.lessThanOrEqualTo(codePoint, range.end))
  )

const Character = Schema.Struct({
  text: Schema.String,
  grapheme: GraphemeBreak,
  conjunct: ConjunctBreak,
  pictographic: Schema.Boolean
})
type Character = typeof Character.Type

const character = (text: string): Character => {
  // String iteration supplies a non-empty code-point string, including isolated surrogates.
  const codePoint = Option.getOrThrow(String.codePointAt(text, 0))
  return {
    text,
    grapheme: rangeAt(graphemeRanges, codePoint).pipe(
      Option.map((range) => range.value),
      Option.getOrElse((): typeof GraphemeBreak.Type => "Other")
    ),
    conjunct: rangeAt(conjunctRanges, codePoint).pipe(
      Option.map((range) => range.value),
      Option.getOrElse((): typeof ConjunctBreak.Type => "None")
    ),
    pictographic: Option.isSome(rangeAt(pictographicRanges, codePoint))
  }
}

const Scan = Schema.Struct({
  completed: Schema.ChunkFromSelf(Schema.String),
  current: Schema.String,
  previous: GraphemeBreak,
  oddRegionalIndicators: Schema.Boolean,
  emoji: Schema.Literal("none", "pictographic", "zwj"),
  conjunct: Schema.Literal("none", "consonant", "linked")
})
type Scan = typeof Scan.Type

const initial: Scan = {
  completed: Chunk.empty(),
  current: "",
  previous: "Other",
  oddRegionalIndicators: false,
  emoji: "none",
  conjunct: "none"
}

const joinsPrevious = (state: Scan, next: Character): boolean => {
  const afterControl = Boolean.or(
    String.Equivalence(state.previous, "CR"),
    Boolean.or(String.Equivalence(state.previous, "LF"), String.Equivalence(state.previous, "Control"))
  )
  // GB9b, GB9c, GB11 and GB12/13 depend on the preceding context.
  const contextualJoin = Boolean.or(
    String.Equivalence(state.previous, "Prepend"),
    Boolean.or(
      Boolean.and(String.Equivalence(next.conjunct, "Consonant"), String.Equivalence(state.conjunct, "linked")),
      Boolean.or(
        Boolean.and(next.pictographic, String.Equivalence(state.emoji, "zwj")),
        Boolean.and(String.Equivalence(next.grapheme, "Regional_Indicator"), state.oddRegionalIndicators)
      )
    )
  )
  return Match.value(next.grapheme).pipe(
    // GB3–GB5: only CR × LF crosses a control boundary.
    Match.when("LF", () => String.Equivalence(state.previous, "CR")),
    Match.when(Match.is("CR", "Control"), () => false),
    // GB9 and GB9a: extensions join unless GB4 already broke the pair.
    Match.when(Match.is("Extend", "ZWJ", "SpacingMark"), () => Boolean.not(afterControl)),
    // GB6–GB8: Hangul syllable joins, in addition to the context rules.
    Match.when(Match.is("L", "LV", "LVT"), () =>
      Boolean.and(
        Boolean.not(afterControl),
        Boolean.or(contextualJoin, String.Equivalence(state.previous, "L"))
      )),
    Match.when("V", () =>
      Boolean.and(
        Boolean.not(afterControl),
        Boolean.or(
          contextualJoin,
          Boolean.or(
            String.Equivalence(state.previous, "L"),
            Boolean.or(String.Equivalence(state.previous, "LV"), String.Equivalence(state.previous, "V"))
          )
        )
      )),
    Match.when("T", () =>
      Boolean.and(
        Boolean.not(afterControl),
        Boolean.or(
          contextualJoin,
          Boolean.or(
            Boolean.or(String.Equivalence(state.previous, "LV"), String.Equivalence(state.previous, "V")),
            Boolean.or(String.Equivalence(state.previous, "LVT"), String.Equivalence(state.previous, "T"))
          )
        )
      )),
    // GB999: remaining pairs break unless a context rule joins them.
    Match.when(
      Match.is("Other", "Regional_Indicator", "Prepend"),
      () => Boolean.and(Boolean.not(afterControl), contextualJoin)
    ),
    Match.exhaustive
  )
}

const nextEmoji = (state: Scan, next: Character): Scan["emoji"] =>
  Boolean.match(next.pictographic, {
    onTrue: (): Scan["emoji"] => "pictographic",
    onFalse: () =>
      Match.value(state.emoji).pipe(
        Match.withReturnType<Scan["emoji"]>(),
        Match.when("pictographic", () =>
          Match.value(next.grapheme).pipe(
            Match.withReturnType<Scan["emoji"]>(),
            Match.when("Extend", () => "pictographic"),
            Match.when("ZWJ", () => "zwj"),
            Match.when(
              Match.is(
                "CR",
                "Control",
                "L",
                "LF",
                "LV",
                "LVT",
                "Other",
                "Prepend",
                "Regional_Indicator",
                "SpacingMark",
                "T",
                "V"
              ),
              () => "none"
            ),
            Match.exhaustive
          )),
        Match.when(Match.is("none", "zwj"), () => "none"),
        Match.exhaustive
      )
  })

const nextConjunct = (state: Scan, next: Character): Scan["conjunct"] =>
  Match.value(next.conjunct).pipe(
    Match.withReturnType<Scan["conjunct"]>(),
    Match.when("Consonant", () => "consonant"),
    Match.when("Extend", () => state.conjunct),
    Match.when("Linker", () =>
      Match.value(state.conjunct).pipe(
        Match.withReturnType<Scan["conjunct"]>(),
        Match.when("none", () => "none"),
        Match.when(Match.is("consonant", "linked"), () => "linked"),
        Match.exhaustive
      )),
    Match.when("None", () => "none"),
    Match.exhaustive
  )

const finish = (state: Scan) =>
  Boolean.match(String.isEmpty(state.current), {
    onTrue: () => state.completed,
    onFalse: () => Chunk.append(state.completed, state.current)
  })

/** Segments without normalizing or replacing the original UTF-16 text. */
export const graphemeClusters = (text: string): typeof Graphemes.Type => {
  const state = Arr.reduce(Arr.fromIterable(text), initial, (current, text): Scan => {
    const next = character(text)
    const joined = joinsPrevious(current, next)
    return {
      completed: Boolean.match(joined, { onTrue: () => current.completed, onFalse: () => finish(current) }),
      current: Boolean.match(joined, { onTrue: () => String.concat(current.current, text), onFalse: () => text }),
      previous: next.grapheme,
      oddRegionalIndicators: Boolean.and(
        String.Equivalence(next.grapheme, "Regional_Indicator"),
        Boolean.not(current.oddRegionalIndicators)
      ),
      emoji: nextEmoji(current, next),
      conjunct: nextConjunct(current, next)
    }
  })
  return Chunk.toReadonlyArray(finish(state))
}
