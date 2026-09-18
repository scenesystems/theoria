/**
 * Grapheme segmentation, whitespace classification, direction detection, and break markers.
 *
 * @since 0.1.0
 */
import { Boolean, Chunk, Data, Match, Number, Option, Schema, String, Tuple } from "effect"
import * as Arr from "effect/Array"

import * as Text from "../Text.js"
import { graphemeClusters } from "./grapheme.js"

export { graphemeClusters } from "./grapheme.js"

/** Author-provided discretionary hyphen marker preserved through preparation. */
export const softHyphen = "\u00ad"

/** Non-breaking space character treated as glue by the segment classifier. */
export const noBreakSpace = "\u00a0"

/** Word-joiner control character that suppresses breaks inside a run. */
export const wordJoiner = "\u2060"

/** Zero-width break marker preserved as an explicit break opportunity. */
export const zeroWidthSpace = "\u200b"

const tab = "\t"
const lineFeed = "\n"

const isRtlCharacter = Schema.is(Schema.String.pipe(Schema.pattern(/[\u0590-\u08ff\uFB1D-\uFDFD\uFE70-\uFEFC]/u)))
const isStrongCharacter = Schema.is(Schema.String.pipe(Schema.pattern(/\p{Letter}|\p{Number}/u)))
const isLetter = Schema.is(Schema.String.pipe(Schema.pattern(/\p{Letter}/u)))
const isNumber = Schema.is(Schema.String.pipe(Schema.pattern(/\p{Number}/u)))
const isExtendedPictographic = Schema.is(Schema.String.pipe(Schema.pattern(/\p{Extended_Pictographic}/u)))
const isRegionalIndicatorPair = Schema.is(
  Schema.String.pipe(Schema.pattern(/^\p{Regional_Indicator}{2}$/u))
)
const isKeycapSequence = Schema.is(Schema.String.pipe(Schema.pattern(/^[#*0-9]\uFE0F?\u20E3$/u)))
const isEmoji = (cluster: string): boolean =>
  Boolean.or(
    isExtendedPictographic(cluster),
    Boolean.or(isRegionalIndicatorPair(cluster), isKeycapSequence(cluster))
  )
const isCjkScript = Schema.is(
  Schema.String.pipe(Schema.pattern(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u))
)
const isNoSpaceScript = Schema.is(
  Schema.String.pipe(Schema.pattern(/[\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u))
)
const isOpeningPunctuation = Schema.is(
  Schema.String.pipe(
    Schema.pattern(/^[([{\u2018\u201C\u00AB\u2039\u3008\u300A\u300C\u300E\u3010\u3014\uFF08\uFF3B\uFF5B]+$/u)
  )
)
const isClosingPunctuation = Schema.is(
  Schema.String.pipe(
    Schema.pattern(
      /^[)\]}\u2019\u201D\u00BB\u203A\u3001\u3002\u3009\u300B\u300D\u300F\u3011\u3015\uFF09\uFF3D\uFF5D\uFF0C\uFF0E!?;,.:]+$/u
    )
  )
)
const isRunConnector = Schema.is(Schema.String.pipe(Schema.pattern(/^[-._~,/:@?&=#%+]+$/u)))

/** Internal logical direction classification used by preparation and bidi projection. */
export const TextDirection = Schema.Union(Schema.suspend(() => Text.Direction), Schema.Literal("neutral"))

/** Internal logical direction classification used by preparation and bidi projection. */
export type TextDirection = typeof TextDirection.Type

const WhitespaceTokenKind = Schema.Literal("space", "tab")

/** Grouped spaces or one tab emitted for preparation-time measurement. */
export class WhitespaceToken extends Data.Class<{
  readonly kind: typeof WhitespaceTokenKind.Type
  readonly text: string
}> {}

/** One non-empty soft-hyphen-delimited piece and its break ownership. */
export class SoftHyphenPiece extends Data.Class<{
  readonly breakAfter: boolean
  readonly text: string
}> {}

const TextBreakClass = Schema.Literal(
  "alphabetic",
  "cjk",
  "closing-punctuation",
  "connector",
  "glue",
  "no-space-script",
  "numeric",
  "opening-punctuation",
  "other",
  "soft-hyphen",
  "zero-width-break"
)
type TextBreakClass = typeof TextBreakClass.Type

type AtomicToken = Data.TaggedEnum<{
  Text: { readonly breakClass: TextBreakClass; readonly text: string }
  HardBreak: { readonly text: string }
  Space: { readonly text: string }
  Tab: { readonly text: string }
}>
const AtomicToken = Data.taggedEnum<AtomicToken>()
type TextAtomicToken = Data.TaggedEnum.Value<AtomicToken, "Text">
type AtomicTokens = Chunk.Chunk<AtomicToken>
type AtomicTokenGroups = Chunk.Chunk<AtomicTokens>
type TextAtomicTokens = Chunk.Chunk<TextAtomicToken>
type WhitespaceTokens = Chunk.Chunk<WhitespaceToken>
type SoftHyphenPieces = Chunk.Chunk<SoftHyphenPiece>
type SegmentChunk = Chunk.Chunk<Text.Segment>

class GroupedTextAtomicToken extends Data.Class<{
  readonly group: number
  readonly token: TextAtomicToken
}> {}

class TextGroupingCursor extends Data.Class<{
  readonly group: number
  readonly index: number
}> {}

const isTextAtomicToken = AtomicToken.$is("Text")
const isWhitespaceAtomicToken = (token: AtomicToken): boolean =>
  Boolean.or(AtomicToken.$is("Space")(token), AtomicToken.$is("Tab")(token))

/** Text after stripping emoji grapheme clusters, plus the number stripped. */
export class EmojiStripResult extends Data.Class<{
  readonly count: number
  readonly text: string
}> {}

const textSegment = (text: string): Text.Segment => ({ kind: "text", text })
const spaceSegment = (text: string): Text.Segment => ({ kind: "space", text })
const hardBreakSegment = (): Text.Segment => ({ kind: "hard-break", text: lineFeed })

const normalizeLineBreaks = (text: string): string => String.replace(/\r\n?/gu, lineFeed)(text)

const isOrdinaryWhitespaceCharacter: (character: string) => boolean = Match.type<string>().pipe(
  Match.when(" ", () => true),
  Match.when(tab, () => true),
  Match.when(lineFeed, () => true),
  Match.when("\u000b", () => true),
  Match.when("\u000c", () => true),
  Match.orElse(() => false)
)

const isOrdinaryWhitespace = (text: string): boolean =>
  Boolean.and(Boolean.not(String.isEmpty(text)), Arr.every(Arr.fromIterable(text), isOrdinaryWhitespaceCharacter))

const classifyTextCluster: (text: string) => TextBreakClass = Match.type<string>().pipe(
  Match.withReturnType<TextBreakClass>(),
  Match.when(softHyphen, () => "soft-hyphen"),
  Match.when(noBreakSpace, () => "glue"),
  Match.when(wordJoiner, () => "glue"),
  Match.when(zeroWidthSpace, () => "zero-width-break"),
  Match.when(isRunConnector, () => "connector"),
  Match.when(isOpeningPunctuation, () => "opening-punctuation"),
  Match.when(isClosingPunctuation, () => "closing-punctuation"),
  Match.when(isCjkScript, () => "cjk"),
  Match.when(isNoSpaceScript, () => "no-space-script"),
  Match.when(isNumber, () => "numeric"),
  Match.when(isLetter, () => "alphabetic"),
  Match.orElse(() => "other")
)

const textAtomicToken = (text: string): TextAtomicToken =>
  AtomicToken.Text({ breakClass: classifyTextCluster(text), text })

const atomicTokenFor: (cluster: string) => AtomicToken = Match.type<string>().pipe(
  Match.when(lineFeed, (text) => AtomicToken.HardBreak({ text })),
  Match.when(tab, (text) => AtomicToken.Tab({ text })),
  Match.when(isOrdinaryWhitespace, (text) => AtomicToken.Space({ text })),
  Match.orElse(textAtomicToken)
)

const tokenizeText = (text: string): AtomicTokens =>
  Chunk.map(Chunk.fromIterable(graphemeClusters(normalizeLineBreaks(text))), atomicTokenFor)

const isRunEndpoint = (token: TextAtomicToken): boolean =>
  Match.value(token.breakClass).pipe(
    Match.when("alphabetic", () => true),
    Match.when("cjk", () => true),
    Match.when("numeric", () => true),
    Match.when("closing-punctuation", () => false),
    Match.when("connector", () => false),
    Match.when("glue", () => false),
    Match.when("no-space-script", () => false),
    Match.when("opening-punctuation", () => false),
    Match.when("other", () => false),
    Match.when("soft-hyphen", () => false),
    Match.when("zero-width-break", () => false),
    Match.exhaustive
  )

const continuesConnectorRun = (token: TextAtomicToken): boolean =>
  Match.value(token.breakClass).pipe(
    Match.when("alphabetic", () => true),
    Match.when("cjk", () => true),
    Match.when("closing-punctuation", () => true),
    Match.when("connector", () => true),
    Match.when("numeric", () => true),
    Match.when("glue", () => false),
    Match.when("no-space-script", () => false),
    Match.when("opening-punctuation", () => false),
    Match.when("other", () => false),
    Match.when("soft-hyphen", () => false),
    Match.when("zero-width-break", () => false),
    Match.exhaustive
  )

const isBreakBoundary: (breakClass: TextBreakClass) => boolean = Match.type<TextBreakClass>().pipe(
  Match.when("glue", () => true),
  Match.when("zero-width-break", () => true),
  Match.when("alphabetic", () => false),
  Match.when("cjk", () => false),
  Match.when("closing-punctuation", () => false),
  Match.when("connector", () => false),
  Match.when("no-space-script", () => false),
  Match.when("numeric", () => false),
  Match.when("opening-punctuation", () => false),
  Match.when("other", () => false),
  Match.when("soft-hyphen", () => false),
  Match.exhaustive
)

const shouldMergeTextAtoms = (
  previous: TextAtomicToken,
  current: TextAtomicToken,
  next: Option.Option<TextAtomicToken>
): boolean =>
  Boolean.match(Boolean.or(isBreakBoundary(previous.breakClass), isBreakBoundary(current.breakClass)), {
    onTrue: () => false,
    onFalse: () =>
      Boolean.match(String.Equivalence(previous.breakClass, "opening-punctuation"), {
        onTrue: () => true,
        onFalse: () =>
          Boolean.match(String.Equivalence(current.breakClass, "closing-punctuation"), {
            onTrue: () => true,
            onFalse: () =>
              Boolean.match(
                Boolean.or(
                  String.Equivalence(previous.breakClass, "soft-hyphen"),
                  String.Equivalence(current.breakClass, "soft-hyphen")
                ),
                {
                  onTrue: () => true,
                  onFalse: () =>
                    Boolean.match(
                      Boolean.and(
                        String.Equivalence(previous.breakClass, "cjk"),
                        String.Equivalence(current.breakClass, "cjk")
                      ),
                      {
                        onTrue: () => true,
                        onFalse: () =>
                          Boolean.match(
                            Boolean.or(
                              String.Equivalence(previous.breakClass, "no-space-script"),
                              String.Equivalence(current.breakClass, "no-space-script")
                            ),
                            {
                              onTrue: () => false,
                              onFalse: () =>
                                Boolean.match(String.Equivalence(previous.breakClass, "connector"), {
                                  onTrue: () => continuesConnectorRun(current),
                                  onFalse: () =>
                                    Boolean.match(String.Equivalence(current.breakClass, "connector"), {
                                      onTrue: () =>
                                        Boolean.or(
                                          Boolean.or(
                                            isRunEndpoint(previous),
                                            String.Equivalence(previous.breakClass, "closing-punctuation")
                                          ),
                                          Option.exists(next, continuesConnectorRun)
                                        ),
                                      onFalse: () => Boolean.and(isRunEndpoint(previous), isRunEndpoint(current))
                                    })
                                })
                            }
                          )
                      }
                    )
                }
              )
          })
      })
  })

const groupAdjacent = <A>(
  values: Chunk.Chunk<A>,
  equivalent: (self: A, that: A) => boolean
): Chunk.Chunk<Chunk.Chunk<A>> =>
  Arr.match(Chunk.toReadonlyArray(values), {
    onEmpty: Chunk.empty<Chunk.Chunk<A>>,
    onNonEmpty: (nonEmpty) => Chunk.fromIterable(Arr.map(Arr.groupWith(nonEmpty, equivalent), Chunk.fromIterable))
  })

const textSegmentsFromAtoms = (atoms: TextAtomicTokens): SegmentChunk => {
  const grouped = Tuple.getSecond(Chunk.mapAccum<TextGroupingCursor, TextAtomicToken, GroupedTextAtomicToken>(
    atoms,
    new TextGroupingCursor({ group: 0, index: 0 }),
    (cursor, token) => {
      const continues = Chunk.get(atoms, Number.decrement(cursor.index)).pipe(
        Option.exists((previous) =>
          shouldMergeTextAtoms(previous, token, Chunk.get(atoms, Number.increment(cursor.index)))
        )
      )
      const nextGroup = Boolean.match(continues, {
        onTrue: () => cursor.group,
        onFalse: () => Number.increment(cursor.group)
      })
      return Tuple.make(
        new TextGroupingCursor({ group: nextGroup, index: Number.increment(cursor.index) }),
        new GroupedTextAtomicToken({ group: nextGroup, token })
      )
    }
  ))
  return Chunk.map(
    groupAdjacent(grouped, (self, that) => Number.Equivalence(self.group, that.group)),
    (group) => textSegment(Chunk.join(Chunk.map(group, (item) => item.token.text), ""))
  )
}

const spaceSegmentsFromText = (text: string): SegmentChunk =>
  Chunk.map(splitWhitespaceTokens(text), (token) => spaceSegment(token.text))

const isTextTokenGroup = (group: AtomicTokens): boolean => Chunk.head(group).pipe(Option.exists(isTextAtomicToken))

const groupTextAndNonTextTokens = (tokens: AtomicTokens): AtomicTokenGroups =>
  groupAdjacent(tokens, (self, that) => Boolean.Equivalence(isTextAtomicToken(self), isTextAtomicToken(that)))

const trimNonTextTokenGroups = (groups: AtomicTokenGroups): AtomicTokenGroups =>
  Chunk.reverse(
    Chunk.dropWhile(
      Chunk.reverse(Chunk.dropWhile(groups, (group) => Boolean.not(isTextTokenGroup(group)))),
      (group) => Boolean.not(isTextTokenGroup(group))
    )
  )

const segmentNormalText = (text: string): SegmentChunk =>
  Chunk.flatMap(
    trimNonTextTokenGroups(groupTextAndNonTextTokens(tokenizeText(text))),
    (group) =>
      Boolean.match(isTextTokenGroup(group), {
        onFalse: () => Chunk.of(spaceSegment(" ")),
        onTrue: () => textSegmentsFromAtoms(Chunk.filter(group, isTextAtomicToken))
      })
  )

const groupPreWrapTokens = (tokens: AtomicTokens): AtomicTokenGroups =>
  groupAdjacent(tokens, (self, that) =>
    Boolean.or(
      String.Equivalence(self._tag, that._tag),
      Boolean.and(isWhitespaceAtomicToken(self), isWhitespaceAtomicToken(that))
    ))

const segmentPreWrapGroup = (group: AtomicTokens): SegmentChunk =>
  Chunk.head(group).pipe(
    Option.match({
      onNone: Chunk.empty<Text.Segment>,
      onSome: AtomicToken.$match({
        Text: () => textSegmentsFromAtoms(Chunk.filter(group, isTextAtomicToken)),
        HardBreak: () => Chunk.map(group, hardBreakSegment),
        Space: () => spaceSegmentsFromText(Chunk.join(Chunk.map(group, (token) => token.text), "")),
        Tab: () => spaceSegmentsFromText(Chunk.join(Chunk.map(group, (token) => token.text), ""))
      })
    })
  )

const segmentPreWrapText = (text: string): SegmentChunk =>
  Chunk.flatMap(groupPreWrapTokens(tokenizeText(text)), segmentPreWrapGroup)

/** Builds text, space, and hard-break segments from canonical grapheme and break-class analysis. */
export const segmentText = (text: string, whiteSpace: Text.Whitespace): Text.Segments =>
  Match.value(whiteSpace).pipe(
    Match.when("normal", () => segmentNormalText(text)),
    Match.when("pre-wrap", () => segmentPreWrapText(text)),
    Match.exhaustive,
    Chunk.toReadonlyArray
  )

/** Detects the first strong text direction present in a string. */
export const detectTextDirection = (text: string): TextDirection =>
  Chunk.findFirst(
    Chunk.fromIterable(text),
    (character) => Boolean.or(isRtlCharacter(character), isStrongCharacter(character))
  ).pipe(
    Option.match({
      onNone: (): TextDirection => "neutral",
      onSome: (character): TextDirection =>
        Boolean.match(isRtlCharacter(character), { onFalse: () => "ltr", onTrue: () => "rtl" })
    })
  )

/** Resolves the base direction for preparation, falling back when input is neutral. */
export const resolveBaseDirection = (text: string, fallback: Text.Direction): Text.Direction =>
  Match.value(detectTextDirection(text)).pipe(
    Match.withReturnType<Text.Direction>(),
    Match.when("neutral", () => fallback),
    Match.when("ltr", () => "ltr"),
    Match.when("rtl", () => "rtl"),
    Match.exhaustive
  )

/** Maps logical text direction into the line-level bidi level used by the visual projector. */
export const bidiLevelForDirection = (direction: TextDirection, baseDirection: Text.Direction): number =>
  Match.value(direction).pipe(
    Match.when(
      "neutral",
      () => Match.value(baseDirection).pipe(Match.when("ltr", () => 0), Match.when("rtl", () => 1), Match.exhaustive)
    ),
    Match.when(
      "ltr",
      () => Match.value(baseDirection).pipe(Match.when("ltr", () => 0), Match.when("rtl", () => 2), Match.exhaustive)
    ),
    Match.when(
      "rtl",
      () => Match.value(baseDirection).pipe(Match.when("ltr", () => 1), Match.when("rtl", () => 1), Match.exhaustive)
    ),
    Match.exhaustive
  )

/** Splits whitespace into grouped spaces and single tab tokens for later measurement. */
export const splitWhitespaceTokens = (text: string): WhitespaceTokens =>
  Chunk.map(
    Chunk.filter(Chunk.fromIterable(String.split(/(\t)/u)(text)), String.isNonEmpty),
    (part) =>
      new WhitespaceToken({
        kind: Boolean.match(String.Equivalence(part, tab), { onFalse: () => "space", onTrue: () => "tab" }),
        text: part
      })
  )

/** Splits author-provided soft hyphens into pieces while preserving discretionary break ownership. */
export const splitSoftHyphenPieces = (text: string): SoftHyphenPieces => {
  const parts = Chunk.fromIterable(String.split(softHyphen)(text))
  return Chunk.filter(
    Chunk.map(
      parts,
      (part, index) =>
        new SoftHyphenPiece({ breakAfter: Number.lessThan(index, Number.decrement(parts.length)), text: part })
    ),
    (piece) => String.isNonEmpty(piece.text)
  )
}

/** Detects whether a string contains a supported complete emoji grapheme. */
export const containsEmoji = (text: string): boolean => Arr.some(graphemeClusters(text), isEmoji)

/** Removes emoji grapheme clusters while counting how many clusters were stripped. */
export const stripEmojiClusters = (text: string): EmojiStripResult =>
  Chunk.reduce(
    Chunk.fromIterable(graphemeClusters(text)),
    new EmojiStripResult({ count: 0, text: "" }),
    (state, cluster) =>
      Boolean.match(isEmoji(cluster), {
        onTrue: () => new EmojiStripResult({ count: Number.increment(state.count), text: state.text }),
        onFalse: () => new EmojiStripResult({ count: state.count, text: String.concat(cluster)(state.text) })
      })
  )
