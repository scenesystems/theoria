import { Boolean as Bool, Equal, Option, Order, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Num from "effect/Number"
import * as Str from "effect/String"
import * as Tuple from "effect/Tuple"

import { HighlightToken } from "./highlighter.js"

/**
 * A symbol in a code sample that links somewhere: `text` is matched in the
 * code exactly as written (`Study.open`, `seal`), `href` is where it goes.
 */
export const CodeLink = Schema.Struct({
  text: Schema.String,
  href: Schema.String
})
export type CodeLink = typeof CodeLink.Type

/** A plain run of highlighted tokens. */
export class TokensSegment extends Schema.TaggedClass<TokensSegment>("@theoria/app/web/view/CodeLinks/TokensSegment")(
  "Tokens",
  {
    tokens: Schema.Array(HighlightToken)
  }
) {}

/** A run of highlighted tokens wrapped in an API link. */
export class LinkSegment
  extends Schema.TaggedClass<LinkSegment>("@theoria/app/web/view/CodeLinks/LinkSegment")("Link", {
    link: CodeLink,
    tokens: Schema.Array(HighlightToken)
  })
{}

/** A run of tokens, either plain or wrapped in one link. */
export const LineSegment = Schema.Union(TokensSegment, LinkSegment)
export type LineSegment = typeof LineSegment.Type

const Positioned = Schema.Struct({ token: HighlightToken, start: Schema.Number, end: Schema.Number })
type Positioned = typeof Positioned.Type

const Span = Schema.Struct({ start: Schema.Number, end: Schema.Number, link: CodeLink })
type Span = typeof Span.Type

const position = (tokens: Iterable<HighlightToken>) =>
  Tuple.getSecond(
    Arr.mapAccum(tokens, 0, (offset, token) => {
      const end = Num.sum(offset, Str.length(token.value))
      return Tuple.make(end, Positioned.make({ token, start: offset, end }))
    })
  )

const identifierChar = /[A-Za-z0-9_$.]/

/** A match must be a whole identifier path: not a suffix of `unseal`, not a member of something else. */
const wholeIdentifier = (text: string, start: number, end: number): boolean =>
  Bool.and(
    Option.isNone(Str.match(identifierChar)(Str.slice(Num.max(0, Num.decrement(start)), start)(text))),
    Option.isNone(Str.match(identifierChar)(Str.slice(end, Num.increment(end))(text)))
  )

/** Comments and strings may mention a symbol; only code is a reference. */
const inCode = (positioned: Iterable<Positioned>, start: number, end: number): boolean =>
  Arr.every(
    Arr.filter(positioned, (position) =>
      Bool.and(Num.lessThan(position.start, end), Num.greaterThan(position.end, start))),
    (position) =>
      Bool.and(
        Bool.not(Equal.equals(position.token.kind, "comment")),
        Bool.not(Equal.equals(position.token.kind, "string"))
      )
  )

const overlaps = (spans: Iterable<Span>, start: number, end: number): boolean =>
  Arr.some(
    Arr.fromIterable(spans),
    (span) => Bool.and(Num.lessThan(span.start, end), Num.greaterThan(span.end, start))
  )

const occurrences = (text: string, needle: string) =>
  Bool.match(Str.isEmpty(needle), {
    onTrue: Arr.empty<number>,
    onFalse: () =>
      Arr.unfold(0, (from) =>
        Option.map(Str.indexOf(needle)(Str.slice(from)(text)), (relative) => {
          const index = Num.sum(from, relative)
          return Tuple.make(index, Num.sum(index, Str.length(needle)))
        }))
  })

/** Longest link text first, so `Study.open` claims its span before a shorter `Study` could. */
const byLength = Order.reverse(Order.mapInput(Order.number, (link: CodeLink) => Str.length(link.text)))

const spansFor = (text: string, positioned: Iterable<Positioned>, links: Iterable<CodeLink>) =>
  Arr.sort(
    Arr.reduce(Arr.sort(Arr.fromIterable(links), byLength), Arr.empty<Span>(), (claimed, link) =>
      Arr.reduce(occurrences(text, link.text), claimed, (spans, start) => {
        const end = Num.sum(start, Str.length(link.text))
        return Bool.match(
          Bool.and(
            Bool.and(wholeIdentifier(text, start, end), inCode(positioned, start, end)),
            Bool.not(overlaps(spans, start, end))
          ),
          {
            onTrue: () =>
              Arr.append(spans, Span.make({ start, end, link })),
            onFalse: () =>
              spans
          }
        )
      })),
    Order.mapInput(Order.number, (span: Span) =>
      span.start)
  )

/** Cut one token wherever a span begins or ends inside it. */
const cut = (p: Positioned, cuts: Iterable<number>) => {
  const inside = Arr.filter(cuts, (at) => Bool.and(Num.greaterThan(at, p.start), Num.lessThan(at, p.end)))
  const bounds = Arr.append(Arr.prepend(inside, p.start), p.end)
  return Arr.zipWith(bounds, Arr.drop(bounds, 1), (start, end) =>
    Positioned.make({
      token: HighlightToken.make({
        kind: p.token.kind,
        value: Str.slice(Num.subtract(start, p.start), Num.subtract(end, p.start))(p.token.value)
      }),
      start,
      end
    }))
}

const spanContaining = (spans: Iterable<Span>, positioned: Positioned): Option.Option<Span> =>
  Arr.findFirst(spans, (span) =>
    Bool.and(
      Num.greaterThanOrEqualTo(positioned.start, span.start),
      Num.lessThanOrEqualTo(positioned.end, span.end)
    ))

const Piece = Schema.Struct({ p: Positioned, span: Schema.OptionFromSelf(Span) })

const sameSpan = Option.getEquivalence<Span>((left, right) => Equal.equals(left.start, right.start))

/**
 * Splits one highlighted line into plain runs and linked runs. Link texts are
 * matched on the line's characters, so a symbol split across tokens
 * (`Study`, `.`, `open`) or glued to leading whitespace still links.
 */
export const segmentLine = (
  tokens: Iterable<HighlightToken>,
  links: Iterable<CodeLink>
) => {
  const tokenArray = Arr.fromIterable(tokens)
  const positioned = position(tokenArray)
  const spans = spansFor(Arr.join(Arr.map(tokenArray, (token) => token.value), ""), positioned, links)
  const cuts = Arr.flatMap(spans, (span) => Arr.make(span.start, span.end))
  const pieces = Arr.map(
    Arr.flatMap(positioned, (p) => cut(p, cuts)),
    (p) => Piece.make({ p, span: spanContaining(spans, p) })
  )

  return Arr.match(pieces, {
    onEmpty: Arr.empty<LineSegment>,
    onNonEmpty: (nonEmpty) =>
      Arr.map(
        Arr.groupWith(nonEmpty, (a, b) => sameSpan(a.span, b.span)),
        (group): LineSegment => {
          const run = Arr.map(group, ({ p }) => p.token)
          return Option.match(Arr.headNonEmpty(group).span, {
            onNone: (): LineSegment => new TokensSegment({ tokens: run }),
            onSome: (span): LineSegment => new LinkSegment({ link: span.link, tokens: run })
          })
        }
      )
  })
}
