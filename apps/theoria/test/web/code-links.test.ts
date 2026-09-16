import { describe, expect, it } from "@effect/vitest"
import { Effect, Match, Option } from "effect"
import * as Arr from "effect/Array"

import { CodeLink, type LineSegment, segmentLine, TokensSegment } from "../../app/web/view/primitives/code/codeLinks.js"
import { highlightCode, makeSyntaxHighlighter } from "../../app/web/view/primitives/code/highlighter.js"
import { HighlightToken } from "../../app/web/view/primitives/code/highlighter.js"

const text = (segment: LineSegment): string => Arr.join(Arr.map(segment.tokens, (token) => token.value), "")

const linked = (segments: Iterable<LineSegment>) =>
  Arr.filterMap(segments, (segment) =>
    Match.value(segment).pipe(
      Match.tag("Link", () => Option.some(text(segment))),
      Match.tag("Tokens", () => Option.none()),
      Match.exhaustive
    ))

const plain = (value: string): HighlightToken => HighlightToken.make({ kind: "plain", value })

const links = Arr.make(
  CodeLink.make({ text: "Study", href: "/study" }),
  CodeLink.make({ text: "Study.open", href: "/study#open" }),
  CodeLink.make({ text: "seal", href: "/seal" })
)

describe("segmentLine", () => {
  it.effect("links a symbol split across tokens and glued to whitespace", () =>
    Effect.sync(() => {
      const tokens = Arr.make(
        HighlightToken.make({ kind: "keyword", value: "yield*" }),
        plain(" Study"),
        HighlightToken.make({ kind: "operator", value: "." }),
        HighlightToken.make({ kind: "function", value: "open" }),
        HighlightToken.make({ kind: "operator", value: "(" })
      )
      const segments = segmentLine(tokens, links)

      expect(Arr.map(segments, text)).toEqual(Arr.make("yield* ", "Study.open", "("))
      expect(linked(segments)).toEqual(Arr.make("Study.open"))
      expect(Arr.join(Arr.map(segments, text), "")).toBe("yield* Study.open(")
    }))

  it.effect("prefers the longest link and never links a suffix or a member of something else", () =>
    Effect.sync(() => {
      const segments = segmentLine(
        Arr.make(
          plain("unseal(x); other.seal(y); "),
          HighlightToken.make({ kind: "function", value: "seal" }),
          plain("(z)")
        ),
        links
      )
      expect(linked(segments)).toEqual(Arr.make("seal"))
    }))

  it.effect("links every occurrence and ignores an empty symbol without consuming text", () =>
    Effect.sync(() => {
      const source = "seal(a); seal(b); unseal(c); seal(d)"
      const segments = segmentLine(
        Arr.of(plain(source)),
        Arr.prepend(links, CodeLink.make({ text: "", href: "/empty" }))
      )
      expect(linked(segments)).toEqual(Arr.make("seal", "seal", "seal"))
      expect(Arr.join(Arr.map(segments, text), "")).toBe(source)
    }))

  it.effect("skips mentions inside comments and strings", () =>
    Effect.sync(() => {
      const segments = segmentLine(
        Arr.make(
          HighlightToken.make({ kind: "comment", value: "// seal it" }),
          plain(" "),
          HighlightToken.make({ kind: "string", value: "\"seal\"" })
        ),
        links
      )
      expect(linked(segments)).toEqual(Arr.empty())
      expect(Arr.length(segments)).toBe(1)
    }))

  it.effect("keeps an empty line as one empty token", () =>
    Effect.sync(() => {
      expect(segmentLine(Arr.make(plain("")), links)).toEqual(
        Arr.make(new TokensSegment({ tokens: Arr.make(plain("")) }))
      )
    }))

  it.effect("links real shiki output for the demo's code", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const highlighter = yield* makeSyntaxHighlighter
        const lines = highlightCode(
          highlighter,
          "const envelope = yield* seal(\"xchacha20-poly1305\", key, Bytes.fromString(note)) // seal",
          "typescript"
        )
        const line = yield* Arr.head(lines)
        const segments = segmentLine(
          line,
          Arr.make(
            CodeLink.make({ text: "seal", href: "/seal" }),
            CodeLink.make({ text: "Bytes.fromString", href: "/bytes" })
          )
        )
        expect(linked(segments)).toEqual(Arr.make("seal", "Bytes.fromString"))
      })
    ))
})
