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
  Data,
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
import * as MutableRef from "effect/MutableRef"

import rawData from "./graphemeData.json" with { type: "json" }
import type {
  CodePointRange,
  ConjunctBreak,
  ConjunctRange,
  GraphemeBreak,
  GraphemeRange,
  Graphemes
} from "./graphemeSchema.js"
import { GraphemeData } from "./graphemeSchema.js"

const data = Schema.decodeUnknownSync(GraphemeData)(rawData)

class CharacterProperties extends Data.Class<{
  readonly grapheme: typeof GraphemeBreak.Type
  readonly conjunct: typeof ConjunctBreak.Type
  readonly pictographic: boolean
}> {}

const initialCharacterProperties = new CharacterProperties({
  grapheme: "Other",
  conjunct: "None",
  pictographic: false
})

type PropertyEvent = Data.TaggedEnum<{
  GraphemeStart: { readonly point: number; readonly value: typeof GraphemeBreak.Type }
  GraphemeEnd: { readonly point: number }
  ConjunctStart: { readonly point: number; readonly value: typeof ConjunctBreak.Type }
  ConjunctEnd: { readonly point: number }
  PictographicStart: { readonly point: number }
  PictographicEnd: { readonly point: number }
}>
const PropertyEvent = Data.taggedEnum<PropertyEvent>()

const graphemeEvents = (range: typeof GraphemeRange.Type): ReadonlyArray<PropertyEvent> =>
  Arr.make(
    PropertyEvent.GraphemeStart({ point: range.start, value: range.value }),
    PropertyEvent.GraphemeEnd({ point: Number.increment(range.end) })
  )

const conjunctEvents = (range: typeof ConjunctRange.Type): ReadonlyArray<PropertyEvent> =>
  Arr.make(
    PropertyEvent.ConjunctStart({ point: range.start, value: range.value }),
    PropertyEvent.ConjunctEnd({ point: Number.increment(range.end) })
  )

const pictographicEvents = (range: typeof CodePointRange.Type): ReadonlyArray<PropertyEvent> =>
  Arr.make(
    PropertyEvent.PictographicStart({ point: range.start }),
    PropertyEvent.PictographicEnd({ point: Number.increment(range.end) })
  )

const eventPriority: (event: PropertyEvent) => number = PropertyEvent.$match({
  GraphemeEnd: () => 0,
  ConjunctEnd: () => 0,
  PictographicEnd: () => 0,
  GraphemeStart: () => 1,
  ConjunctStart: () => 1,
  PictographicStart: () => 1
})

const applyPropertyEvent: (properties: CharacterProperties, event: PropertyEvent) => CharacterProperties = (
  properties,
  event
) =>
  PropertyEvent.$match({
    GraphemeStart: ({ value }) => new CharacterProperties({ ...properties, grapheme: value }),
    GraphemeEnd: () => new CharacterProperties({ ...properties, grapheme: "Other" }),
    ConjunctStart: ({ value }) => new CharacterProperties({ ...properties, conjunct: value }),
    ConjunctEnd: () => new CharacterProperties({ ...properties, conjunct: "None" }),
    PictographicStart: () => new CharacterProperties({ ...properties, pictographic: true }),
    PictographicEnd: () => new CharacterProperties({ ...properties, pictographic: false })
  })(event)

const propertyEvents: ReadonlyArray<PropertyEvent> = Arr.sortBy(
  Order.mapInput(Order.number, (event: PropertyEvent) => event.point),
  Order.mapInput(Order.number, eventPriority)
)(Arr.appendAll(
  Arr.appendAll(Arr.flatMap(data.grapheme, graphemeEvents), Arr.flatMap(data.conjunct, conjunctEvents)),
  Arr.flatMap(data.pictographic, pictographicEvents)
))

// Apply all events at each boundary in a single pass, without copying suffixes.
const propertyBoundaries = Tuple.getSecond(Arr.mapAccum(
  Iterable.groupWith(propertyEvents, (self, that) => Number.Equivalence(self.point, that.point)),
  initialCharacterProperties,
  (properties, events) => {
    const next = Arr.reduce(events, properties, applyPropertyEvent)
    return Tuple.make(next, Tuple.make(Arr.headNonEmpty(events).point, next))
  }
))

const propertiesByCodePoint = RedBlackTree.fromIterable(propertyBoundaries, Order.number)

const propertiesAt = (codePoint: number): CharacterProperties =>
  Iterable.head(RedBlackTree.lessThanEqualReversed(propertiesByCodePoint, codePoint)).pipe(
    Option.map(Tuple.getSecond),
    Option.getOrElse(() => initialCharacterProperties)
  )

const basicMultilingualPlaneLimit = 0x10000
const basicMultilingualPlaneBoundaries = Arr.takeWhile(
  propertyBoundaries,
  (boundary) => Number.lessThan(Tuple.getFirst(boundary), basicMultilingualPlaneLimit)
)
// Expand the disjoint intervals once, rather than perform a tree lookup for
// every code point during module initialization. Entries share their property record.
const basicMultilingualPlaneProperties = Arr.flatMap(basicMultilingualPlaneBoundaries, (boundary, index) => {
  const end = Option.getOrElse(
    Option.map(Arr.get(basicMultilingualPlaneBoundaries, Number.increment(index)), Tuple.getFirst),
    () => basicMultilingualPlaneLimit
  )
  return Arr.replicate(Tuple.getSecond(boundary), Number.subtract(end, Tuple.getFirst(boundary)))
})
const propertiesForCodePoint = (codePoint: number): CharacterProperties =>
  Boolean.match(Number.lessThan(codePoint, basicMultilingualPlaneLimit), {
    onFalse: () => propertiesAt(codePoint),
    onTrue: () => Arr.unsafeGet(basicMultilingualPlaneProperties, codePoint)
  })

const character = (text: string): CharacterProperties =>
  // String iteration supplies a non-empty code-point string, including isolated surrogates.
  propertiesForCodePoint(Option.getOrThrow(String.codePointAt(text, 0)))

const EmojiState = Schema.Literal("none", "pictographic", "zwj")
const ConjunctState = Schema.Literal("none", "consonant", "linked")
type EmojiState = typeof EmojiState.Type
type ConjunctState = typeof ConjunctState.Type

class Scan extends Data.Class<{
  readonly completed: MutableRef.MutableRef<Chunk.Chunk<string>>
  readonly current: MutableRef.MutableRef<string>
  readonly previous: MutableRef.MutableRef<typeof GraphemeBreak.Type>
  readonly oddRegionalIndicators: MutableRef.MutableRef<boolean>
  readonly emoji: MutableRef.MutableRef<EmojiState>
  readonly conjunct: MutableRef.MutableRef<ConjunctState>
}> {}

const initialScan = (): Scan =>
  new Scan({
    completed: MutableRef.make(Chunk.empty()),
    current: MutableRef.make(""),
    previous: MutableRef.make("Other"),
    oddRegionalIndicators: MutableRef.make(false),
    emoji: MutableRef.make("none"),
    conjunct: MutableRef.make("none")
  })

const followsControl = (state: Scan): boolean =>
  Boolean.or(
    String.Equivalence(MutableRef.get(state.previous), "CR"),
    Boolean.or(
      String.Equivalence(MutableRef.get(state.previous), "LF"),
      String.Equivalence(MutableRef.get(state.previous), "Control")
    )
  )

const joinsContext = (state: Scan, next: CharacterProperties): boolean =>
  Boolean.or(
    String.Equivalence(MutableRef.get(state.previous), "Prepend"),
    Boolean.or(
      Boolean.and(
        String.Equivalence(next.conjunct, "Consonant"),
        String.Equivalence(MutableRef.get(state.conjunct), "linked")
      ),
      Boolean.or(
        Boolean.and(next.pictographic, String.Equivalence(MutableRef.get(state.emoji), "zwj")),
        Boolean.and(
          String.Equivalence(next.grapheme, "Regional_Indicator"),
          MutableRef.get(state.oddRegionalIndicators)
        )
      )
    )
  )

type JoinRule = (state: Scan, next: CharacterProperties) => boolean

const joinsLineFeed: JoinRule = (state) => String.Equivalence(MutableRef.get(state.previous), "CR")
const neverJoins: JoinRule = () => false
const joinsExtension: JoinRule = (state) => Boolean.not(followsControl(state))
const joinsL: JoinRule = (state, next) =>
  Boolean.and(
    Boolean.not(followsControl(state)),
    Boolean.or(joinsContext(state, next), String.Equivalence(MutableRef.get(state.previous), "L"))
  )
const joinsV: JoinRule = (state, next) =>
  Boolean.and(
    Boolean.not(followsControl(state)),
    Boolean.or(
      joinsContext(state, next),
      Boolean.or(
        String.Equivalence(MutableRef.get(state.previous), "L"),
        Boolean.or(
          String.Equivalence(MutableRef.get(state.previous), "LV"),
          String.Equivalence(MutableRef.get(state.previous), "V")
        )
      )
    )
  )
const joinsT: JoinRule = (state, next) =>
  Boolean.and(
    Boolean.not(followsControl(state)),
    Boolean.or(
      joinsContext(state, next),
      Boolean.or(
        Boolean.or(
          String.Equivalence(MutableRef.get(state.previous), "LV"),
          String.Equivalence(MutableRef.get(state.previous), "V")
        ),
        Boolean.or(
          String.Equivalence(MutableRef.get(state.previous), "LVT"),
          String.Equivalence(MutableRef.get(state.previous), "T")
        )
      )
    )
  )
const joinsRemaining: JoinRule = (state, next) =>
  Boolean.and(Boolean.not(followsControl(state)), joinsContext(state, next))

const joinRuleFor: (grapheme: typeof GraphemeBreak.Type) => JoinRule = Match.type<typeof GraphemeBreak.Type>().pipe(
  Match.when("LF", () => joinsLineFeed),
  Match.when(Match.is("CR", "Control"), () => neverJoins),
  Match.when(Match.is("Extend", "ZWJ", "SpacingMark"), () => joinsExtension),
  Match.when(Match.is("L", "LV", "LVT"), () => joinsL),
  Match.when("V", () => joinsV),
  Match.when("T", () => joinsT),
  Match.when(Match.is("Other", "Regional_Indicator", "Prepend"), () => joinsRemaining),
  Match.exhaustive
)

const joinsPrevious = (state: Scan, next: CharacterProperties): boolean => joinRuleFor(next.grapheme)(state, next)

const emojiAfterPictographic: (grapheme: typeof GraphemeBreak.Type) => EmojiState = Match.type<
  typeof GraphemeBreak.Type
>().pipe(
  Match.withReturnType<EmojiState>(),
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
)

type EmojiRule = (next: CharacterProperties) => EmojiState

const resetEmoji: EmojiRule = () => "none"
const advancePictographicEmoji: EmojiRule = (next) => emojiAfterPictographic(next.grapheme)
const emojiRuleFor: (emoji: EmojiState) => EmojiRule = Match.type<EmojiState>().pipe(
  Match.when("pictographic", () => advancePictographicEmoji),
  Match.when(Match.is("none", "zwj"), () => resetEmoji),
  Match.exhaustive
)

const nextEmoji = (state: Scan, next: CharacterProperties): EmojiState =>
  Boolean.match(next.pictographic, {
    onTrue: (): EmojiState => "pictographic",
    onFalse: () => emojiRuleFor(MutableRef.get(state.emoji))(next)
  })

type ConjunctRule = (state: Scan) => ConjunctState

const consonantConjunct: ConjunctRule = () => "consonant"
const retainedConjunct: ConjunctRule = (state) => MutableRef.get(state.conjunct)
const resetConjunct: ConjunctRule = () => "none"
const linkedConjunctState: (conjunct: ConjunctState) => ConjunctState = Match.type<ConjunctState>().pipe(
  Match.withReturnType<ConjunctState>(),
  Match.when("none", () => "none"),
  Match.when(Match.is("consonant", "linked"), () => "linked"),
  Match.exhaustive
)
const linkedConjunct: ConjunctRule = (state) => linkedConjunctState(MutableRef.get(state.conjunct))
const conjunctRuleFor: (conjunct: typeof ConjunctBreak.Type) => ConjunctRule = Match.type<typeof ConjunctBreak.Type>()
  .pipe(
    Match.when("Consonant", () => consonantConjunct),
    Match.when("Extend", () => retainedConjunct),
    Match.when("Linker", () => linkedConjunct),
    Match.when("None", () => resetConjunct),
    Match.exhaustive
  )

const nextConjunct = (state: Scan, next: CharacterProperties): ConjunctState => conjunctRuleFor(next.conjunct)(state)

const finish = (state: Scan) =>
  Boolean.match(String.isEmpty(MutableRef.get(state.current)), {
    onTrue: () => MutableRef.get(state.completed),
    onFalse: () => Chunk.append(MutableRef.get(state.completed), MutableRef.get(state.current))
  })

const isAscii = (text: string): boolean => Option.isSome(String.match(/^\p{ASCII}*$/u)(text))

/** Segments without normalizing or replacing the original UTF-16 text. */
export const graphemeClusters = (text: string): typeof Graphemes.Type =>
  Boolean.match(isAscii(text), {
    // UAX #29 GB3 is the only joining rule in ASCII. All other pairs break,
    // including controls; no property-tree lookup or contextual state is needed.
    onTrue: () => Option.getOrElse(String.match(/\r\n|[\s\S]/gu)(text), Arr.empty<string>),
    onFalse: () => {
      const state = initialScan()
      Chunk.forEach(Chunk.fromIterable(text), (text) => {
        const next = character(text)
        const joined = joinsPrevious(state, next)
        const emoji = nextEmoji(state, next)
        const conjunct = nextConjunct(state, next)
        const oddRegionalIndicators = Boolean.and(
          String.Equivalence(next.grapheme, "Regional_Indicator"),
          Boolean.not(MutableRef.get(state.oddRegionalIndicators))
        )
        MutableRef.set(
          state.completed,
          Boolean.match(joined, { onTrue: () => MutableRef.get(state.completed), onFalse: () => finish(state) })
        )
        MutableRef.set(
          state.current,
          Boolean.match(joined, {
            onTrue: () => String.concat(MutableRef.get(state.current), text),
            onFalse: () => text
          })
        )
        MutableRef.set(state.previous, next.grapheme)
        MutableRef.set(state.oddRegionalIndicators, oddRegionalIndicators)
        MutableRef.set(state.emoji, emoji)
        MutableRef.set(state.conjunct, conjunct)
      })
      return Chunk.toReadonlyArray(finish(state))
    }
  })
