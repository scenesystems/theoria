import { Option, Order } from "effect"
import * as Arr from "effect/Array"

import type { HighlightToken } from "./highlighter.js"

/**
 * A symbol in a code sample that links somewhere: `text` is matched in the
 * code exactly as written (`Study.open`, `seal`), `href` is where it goes.
 */
export type CodeLink = {
  readonly text: string
  readonly href: string
}

/** A run of tokens, either plain or wrapped in one link. */
export type LineSegment =
  | { readonly _tag: "Tokens"; readonly tokens: ReadonlyArray<HighlightToken> }
  | { readonly _tag: "Link"; readonly link: CodeLink; readonly tokens: ReadonlyArray<HighlightToken> }

type Positioned = { readonly token: HighlightToken; readonly start: number; readonly end: number }

type Span = { readonly start: number; readonly end: number; readonly link: CodeLink }

const position = (tokens: ReadonlyArray<HighlightToken>): ReadonlyArray<Positioned> =>
  Arr.mapAccum(tokens, 0, (offset, token) => [
    offset + token.value.length,
    { token, start: offset, end: offset + token.value.length }
  ])[1]

const identifierChar = /[A-Za-z0-9_$.]/

/** A match must be a whole identifier path: not a suffix of `unseal`, not a member of something else. */
const wholeIdentifier = (text: string, start: number, end: number): boolean =>
  !identifierChar.test(text.slice(Math.max(0, start - 1), start)) && !identifierChar.test(text.slice(end, end + 1))

/** Comments and strings may mention a symbol; only code is a reference. */
const inCode = (positioned: ReadonlyArray<Positioned>, start: number, end: number): boolean =>
  Arr.every(
    Arr.filter(positioned, (p) => p.start < end && p.end > start),
    (p) => p.token.kind !== "comment" && p.token.kind !== "string"
  )

const overlaps = (spans: ReadonlyArray<Span>, start: number, end: number): boolean =>
  Arr.some(spans, (span) => span.start < end && span.end > start)

const occurrences = (text: string, needle: string, from: number): ReadonlyArray<number> => {
  const index = text.indexOf(needle, from)
  return index < 0 || needle.length === 0 ? [] : Arr.prepend(occurrences(text, needle, index + needle.length), index)
}

/** Longest link text first, so `Study.open` claims its span before a shorter `Study` could. */
const byLength = Order.reverse(Order.mapInput(Order.number, (link: CodeLink) => link.text.length))

const spansFor = (text: string, positioned: ReadonlyArray<Positioned>, links: ReadonlyArray<CodeLink>) =>
  Arr.sort(
    Arr.reduce(Arr.sort(links, byLength), Arr.empty<Span>(), (claimed, link) =>
      Arr.reduce(occurrences(text, link.text, 0), claimed, (spans, start) => {
        const end = start + link.text.length
        return wholeIdentifier(text, start, end) && inCode(positioned, start, end) && !overlaps(spans, start, end)
          ? Arr.append(spans, { start, end, link })
          : spans
      })),
    Order.mapInput(Order.number, (span: Span) =>
      span.start)
  )

/** Cut one token wherever a span begins or ends inside it. */
const cut = (p: Positioned, cuts: ReadonlyArray<number>): ReadonlyArray<Positioned> => {
  const inside = Arr.filter(cuts, (at) => at > p.start && at < p.end)
  const bounds = Arr.append(Arr.prepend(inside, p.start), p.end)
  return Arr.zipWith(bounds, Arr.drop(bounds, 1), (start, end) => ({
    token: { kind: p.token.kind, value: p.token.value.slice(start - p.start, end - p.start) },
    start,
    end
  }))
}

const spanContaining = (spans: ReadonlyArray<Span>, p: Positioned): Option.Option<Span> =>
  Arr.findFirst(spans, (span) => p.start >= span.start && p.end <= span.end)

type Piece = { readonly p: Positioned; readonly span: Option.Option<Span> }

const sameSpan = Option.getEquivalence<Span>((a, b) => a.start === b.start)

/**
 * Splits one highlighted line into plain runs and linked runs. Link texts are
 * matched on the line's characters, so a symbol split across tokens
 * (`Study`, `.`, `open`) or glued to leading whitespace still links.
 */
export const segmentLine = (
  tokens: ReadonlyArray<HighlightToken>,
  links: ReadonlyArray<CodeLink>
): ReadonlyArray<LineSegment> => {
  const positioned = position(tokens)
  const spans = spansFor(Arr.join(Arr.map(tokens, (token) => token.value), ""), positioned, links)
  const cuts = Arr.flatMap(spans, (span) => [span.start, span.end])
  const pieces: ReadonlyArray<Piece> = Arr.map(
    Arr.flatMap(positioned, (p) => cut(p, cuts)),
    (p) => ({ p, span: spanContaining(spans, p) })
  )

  return Arr.match(pieces, {
    onEmpty: (): ReadonlyArray<LineSegment> => [],
    onNonEmpty: (nonEmpty) =>
      Arr.map(
        Arr.groupWith(nonEmpty, (a, b) => sameSpan(a.span, b.span)),
        (group): LineSegment => {
          const run = Arr.map(group, ({ p }) => p.token)
          return Option.match(Arr.headNonEmpty(group).span, {
            onNone: (): LineSegment => ({ _tag: "Tokens", tokens: run }),
            onSome: (span): LineSegment => ({ _tag: "Link", link: span.link, tokens: run })
          })
        }
      )
  })
}
