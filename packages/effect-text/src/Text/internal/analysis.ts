/**
 * Grapheme segmentation, whitespace classification, direction detection, and break markers.
 *
 * @since 0.1.0
 */
import { Boolean, Match, Number, Option, Schema, String, Tuple } from "effect"
import * as Arr from "effect/Array"

import { type BaseTextDirectionType, TextSegment, type WhiteSpaceModeType } from "../schema.js"
import { graphemeClusters } from "./grapheme.js"

export { graphemeClusters } from "./grapheme.js"

/** Author-provided discretionary hyphen marker preserved through preparation. */
export const SOFT_HYPHEN = "\u00ad"

/** Non-breaking space character treated as glue by the segment classifier. */
export const NO_BREAK_SPACE = "\u00a0"

/** Word-joiner control character that suppresses breaks inside a run. */
export const WORD_JOINER = "\u2060"

/** Zero-width break marker preserved as an explicit break opportunity. */
export const ZERO_WIDTH_SPACE = "\u200b"

const TAB = "\t"
const LINE_FEED = "\n"

const isRtlCharacter = Schema.is(Schema.String.pipe(Schema.pattern(/[\u0590-\u08ff\uFB1D-\uFDFD\uFE70-\uFEFC]/u)))
const isStrongCharacter = Schema.is(Schema.String.pipe(Schema.pattern(/\p{Letter}|\p{Number}/u)))
const isLetter = Schema.is(Schema.String.pipe(Schema.pattern(/\p{Letter}/u)))
const isNumber = Schema.is(Schema.String.pipe(Schema.pattern(/\p{Number}/u)))
const isEmoji = Schema.is(Schema.String.pipe(Schema.pattern(/\p{Extended_Pictographic}/u)))
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
export const TextDirection = Schema.Literal("ltr", "rtl", "neutral")

/** Internal logical direction classification used by preparation and bidi projection. */
export type TextDirection = typeof TextDirection.Type

const WhitespaceTokenKind = Schema.Literal("space", "tab")

/** Grouped spaces or one tab emitted for preparation-time measurement. */
export class WhitespaceToken extends Schema.Class<WhitespaceToken>("effect-text/WhitespaceToken")({
  kind: WhitespaceTokenKind,
  text: Schema.String
}) {}

/** One non-empty soft-hyphen-delimited piece and its break ownership. */
export class SoftHyphenPiece extends Schema.Class<SoftHyphenPiece>("effect-text/SoftHyphenPiece")({
  breakAfter: Schema.Boolean,
  text: Schema.String
}) {}

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

class TextAtomicToken extends Schema.Class<TextAtomicToken>("effect-text/TextAtomicToken")({
  breakClass: TextBreakClass,
  kind: Schema.Literal("text"),
  text: Schema.String
}) {}

class HardBreakAtomicToken extends Schema.Class<HardBreakAtomicToken>("effect-text/HardBreakAtomicToken")({
  kind: Schema.Literal("hard-break"),
  text: Schema.String
}) {}

class SpaceAtomicToken extends Schema.Class<SpaceAtomicToken>("effect-text/SpaceAtomicToken")({
  kind: Schema.Literal("space"),
  text: Schema.String
}) {}

class TabAtomicToken extends Schema.Class<TabAtomicToken>("effect-text/TabAtomicToken")({
  kind: Schema.Literal("tab"),
  text: Schema.String
}) {}

const AtomicToken = Schema.Union(TextAtomicToken, HardBreakAtomicToken, SpaceAtomicToken, TabAtomicToken)
type AtomicToken = typeof AtomicToken.Type
const AtomicTokens = Schema.Array(AtomicToken)
type AtomicTokens = typeof AtomicTokens.Type
const AtomicTokenGroup = Schema.NonEmptyArray(AtomicToken)
const AtomicTokenGroups = Schema.Array(AtomicTokenGroup)
type AtomicTokenGroups = typeof AtomicTokenGroups.Type
const TextAtomicTokens = Schema.Array(TextAtomicToken)
type TextAtomicTokens = typeof TextAtomicTokens.Type
const TextSegments = Schema.Array(TextSegment)
type TextSegments = typeof TextSegments.Type
const WhitespaceTokens = Schema.Array(WhitespaceToken)
type WhitespaceTokens = typeof WhitespaceTokens.Type
const SoftHyphenPieces = Schema.Array(SoftHyphenPiece)
type SoftHyphenPieces = typeof SoftHyphenPieces.Type

class GroupedTextAtomicToken extends Schema.Class<GroupedTextAtomicToken>("effect-text/GroupedTextAtomicToken")({
  group: Schema.Number,
  token: TextAtomicToken
}) {}

const WhitespaceAtomicToken = Schema.Union(SpaceAtomicToken, TabAtomicToken)
const isTextAtomicToken = Schema.is(TextAtomicToken)
const isWhitespaceAtomicToken = Schema.is(WhitespaceAtomicToken)

/** Text after stripping emoji grapheme clusters, plus the number stripped. */
export class EmojiStripResult extends Schema.Class<EmojiStripResult>("effect-text/EmojiStripResult")({
  count: Schema.Number,
  text: Schema.String
}) {}

const textSegment = (text: string): typeof TextSegment.Type => ({ kind: "text", text })
const spaceSegment = (text: string): typeof TextSegment.Type => ({ kind: "space", text })
const hardBreakSegment = (): typeof TextSegment.Type => ({ kind: "hard-break", text: LINE_FEED })

const normalizeLineBreaks = (text: string): string => String.replace(/\r\n?/gu, LINE_FEED)(text)

const isOrdinaryWhitespaceCharacter = (character: string): boolean =>
  Match.value(character).pipe(
    Match.when(" ", () => true),
    Match.when(TAB, () => true),
    Match.when(LINE_FEED, () => true),
    Match.when("\u000b", () => true),
    Match.when("\u000c", () => true),
    Match.orElse(() => false)
  )

const isOrdinaryWhitespace = (text: string): boolean =>
  Boolean.and(Boolean.not(String.isEmpty(text)), Arr.every(Arr.fromIterable(text), isOrdinaryWhitespaceCharacter))

const classifyTextCluster = (text: string): TextBreakClass =>
  Match.value(text).pipe(
    Match.withReturnType<TextBreakClass>(),
    Match.when(SOFT_HYPHEN, () => "soft-hyphen"),
    Match.when(NO_BREAK_SPACE, () => "glue"),
    Match.when(WORD_JOINER, () => "glue"),
    Match.when(ZERO_WIDTH_SPACE, () => "zero-width-break"),
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
  new TextAtomicToken({ breakClass: classifyTextCluster(text), kind: "text", text })

const atomicTokenFor = (cluster: string): AtomicToken =>
  Match.value(cluster).pipe(
    Match.when(LINE_FEED, (text) => new HardBreakAtomicToken({ kind: "hard-break", text })),
    Match.when(TAB, (text) => new TabAtomicToken({ kind: "tab", text })),
    Match.when(isOrdinaryWhitespace, (text) => new SpaceAtomicToken({ kind: "space", text })),
    Match.orElse(textAtomicToken)
  )

const tokenizeText = (text: string): AtomicTokens =>
  Arr.map(graphemeClusters(normalizeLineBreaks(text)), atomicTokenFor)

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

const isBreakBoundary = (breakClass: TextBreakClass): boolean =>
  Match.value(breakClass).pipe(
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

const textSegmentsFromAtoms = (atoms: TextAtomicTokens): TextSegments => {
  const grouped = Tuple.getSecond(Arr.mapAccum(atoms, 0, (group, token, index) => {
    const continues = Arr.get(atoms, Number.decrement(index)).pipe(
      Option.exists((previous) => shouldMergeTextAtoms(previous, token, Arr.get(atoms, Number.increment(index))))
    )
    const nextGroup = Boolean.match(continues, { onTrue: () => group, onFalse: () => Number.increment(group) })
    return Tuple.make(nextGroup, new GroupedTextAtomicToken({ group: nextGroup, token }))
  }))
  return Arr.match(grouped, {
    onEmpty: () => Arr.empty(),
    onNonEmpty: (nonEmpty) =>
      Arr.map(
        Arr.groupWith(nonEmpty, (self, that) => Number.Equivalence(self.group, that.group)),
        (group) => textSegment(Arr.join(Arr.map(group, (item) => item.token.text), ""))
      )
  })
}

const spaceSegmentsFromText = (text: string): TextSegments =>
  Arr.map(splitWhitespaceTokens(text), (token) => spaceSegment(token.text))

const isTextTokenGroup = (group: typeof AtomicTokenGroup.Type): boolean => isTextAtomicToken(Arr.headNonEmpty(group))

const groupTextAndNonTextTokens = (tokens: AtomicTokens) =>
  Arr.match(tokens, {
    onEmpty: () => Arr.empty(),
    onNonEmpty: (nonEmptyTokens) =>
      Arr.groupWith(
        nonEmptyTokens,
        (self, that) => Boolean.Equivalence(isTextAtomicToken(self), isTextAtomicToken(that))
      )
  })

const trimNonTextTokenGroups = (groups: AtomicTokenGroups) =>
  Arr.reverse(
    Arr.dropWhile(
      Arr.reverse(Arr.dropWhile(groups, (group) => Boolean.not(isTextTokenGroup(group)))),
      (group) => Boolean.not(isTextTokenGroup(group))
    )
  )

const segmentNormalText = (text: string): TextSegments =>
  Arr.flatMap(
    trimNonTextTokenGroups(groupTextAndNonTextTokens(tokenizeText(text))),
    (group) =>
      Boolean.match(isTextTokenGroup(group), {
        onFalse: () => Arr.of(spaceSegment(" ")),
        onTrue: () => textSegmentsFromAtoms(Arr.filter(group, isTextAtomicToken))
      })
  )

const groupPreWrapTokens = (tokens: AtomicTokens) =>
  Arr.match(tokens, {
    onEmpty: () => Arr.empty(),
    onNonEmpty: (nonEmptyTokens) =>
      Arr.groupWith(nonEmptyTokens, (self, that) =>
        Boolean.or(
          String.Equivalence(self.kind, that.kind),
          Boolean.and(isWhitespaceAtomicToken(self), isWhitespaceAtomicToken(that))
        ))
  })

const segmentPreWrapGroup = (group: typeof AtomicTokenGroup.Type): TextSegments =>
  Match.value(Arr.headNonEmpty(group)).pipe(
    Match.discriminatorsExhaustive("kind")({
      text: () => textSegmentsFromAtoms(Arr.filter(group, isTextAtomicToken)),
      "hard-break": () => Arr.map(group, hardBreakSegment),
      space: () => spaceSegmentsFromText(Arr.join(Arr.map(group, (token) => token.text), "")),
      tab: () => spaceSegmentsFromText(Arr.join(Arr.map(group, (token) => token.text), ""))
    })
  )

const segmentPreWrapText = (text: string): TextSegments =>
  Arr.flatMap(groupPreWrapTokens(tokenizeText(text)), segmentPreWrapGroup)

/** Builds text, space, and hard-break segments from canonical grapheme and break-class analysis. */
export const segmentText = (text: string, whiteSpace: WhiteSpaceModeType): TextSegments =>
  Match.value(whiteSpace).pipe(
    Match.when("normal", () => segmentNormalText(text)),
    Match.when("pre-wrap", () => segmentPreWrapText(text)),
    Match.exhaustive
  )

/** Detects the first strong text direction present in a string. */
export const detectTextDirection = (text: string): TextDirection =>
  Arr.findFirst(
    Arr.fromIterable(text),
    (character) => Boolean.or(isRtlCharacter(character), isStrongCharacter(character))
  ).pipe(
    Option.match({
      onNone: (): TextDirection => "neutral",
      onSome: (character): TextDirection =>
        Boolean.match(isRtlCharacter(character), { onFalse: () => "ltr", onTrue: () => "rtl" })
    })
  )

/** Resolves the base direction for preparation, falling back when input is neutral. */
export const resolveBaseDirection = (text: string, fallback: BaseTextDirectionType): BaseTextDirectionType =>
  Match.value(detectTextDirection(text)).pipe(
    Match.withReturnType<BaseTextDirectionType>(),
    Match.when("neutral", () => fallback),
    Match.when("ltr", () => "ltr"),
    Match.when("rtl", () => "rtl"),
    Match.exhaustive
  )

/** Maps logical text direction into the line-level bidi level used by the visual projector. */
export const bidiLevelForDirection = (direction: TextDirection, baseDirection: BaseTextDirectionType): number =>
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
  Arr.map(Arr.filter(String.split(/(\t)/u)(text), String.isNonEmpty), (part) =>
    new WhitespaceToken({
      kind: Boolean.match(String.Equivalence(part, TAB), { onFalse: () => "space", onTrue: () => "tab" }),
      text: part
    }))

/** Splits author-provided soft hyphens into pieces while preserving discretionary break ownership. */
export const splitSoftHyphenPieces = (text: string): SoftHyphenPieces => {
  const parts = String.split(SOFT_HYPHEN)(text)
  return Arr.filter(
    Arr.map(
      parts,
      (part, index) =>
        new SoftHyphenPiece({ breakAfter: Number.lessThan(index, Number.decrement(Arr.length(parts))), text: part })
    ),
    (piece) => String.isNonEmpty(piece.text)
  )
}

/** Detects whether a string contains extended pictographic graphemes. */
export const containsEmoji = isEmoji

/** Removes emoji grapheme clusters while counting how many clusters were stripped. */
export const stripEmojiClusters = (text: string): EmojiStripResult =>
  Arr.reduce(
    graphemeClusters(text),
    new EmojiStripResult({ count: 0, text: "" }),
    (state, cluster) =>
      Boolean.match(isEmoji(cluster), {
        onTrue: () => new EmojiStripResult({ count: Number.increment(state.count), text: state.text }),
        onFalse: () => new EmojiStripResult({ count: state.count, text: String.concat(cluster)(state.text) })
      })
  )
