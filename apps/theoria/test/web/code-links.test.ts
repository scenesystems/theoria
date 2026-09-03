import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import { type CodeLink, type LineSegment, segmentLine } from "../../app/web/view/primitives/code/codeLinks.js"
import { highlightCode, makeSyntaxHighlighter } from "../../app/web/view/primitives/code/highlighter.js"
import type { HighlightToken } from "../../app/web/view/primitives/code/highlighter.js"

const text = (segment: LineSegment): string => Arr.join(Arr.map(segment.tokens, (token) => token.value), "")

const linked = (segments: ReadonlyArray<LineSegment>): ReadonlyArray<string> =>
  Arr.filterMap(segments, (segment) => segment._tag === "Link" ? Option.some(text(segment)) : Option.none())

const plain = (value: string): HighlightToken => ({ kind: "plain", value })

const links: ReadonlyArray<CodeLink> = [
  { text: "Study", href: "/study" },
  { text: "Study.open", href: "/study#open" },
  { text: "seal", href: "/seal" }
]

describe("segmentLine", () => {
  it("links a symbol split across tokens and glued to whitespace", () => {
    const tokens: ReadonlyArray<HighlightToken> = [
      { kind: "keyword", value: "yield*" },
      plain(" Study"),
      { kind: "operator", value: "." },
      { kind: "function", value: "open" },
      { kind: "operator", value: "(" }
    ]
    const segments = segmentLine(tokens, links)

    expect(Arr.map(segments, text)).toEqual(["yield* ", "Study.open", "("])
    expect(linked(segments)).toEqual(["Study.open"])
    expect(Arr.join(Arr.map(segments, text), "")).toBe("yield* Study.open(")
  })

  it("prefers the longest link and never links a suffix or a member of something else", () => {
    const segments = segmentLine(
      [plain("unseal(x); other.seal(y); "), { kind: "function", value: "seal" }, plain("(z)")],
      links
    )
    expect(linked(segments)).toEqual(["seal"])
  })

  it("skips mentions inside comments and strings", () => {
    const segments = segmentLine(
      [{ kind: "comment", value: "// seal it" }, plain(" "), { kind: "string", value: "\"seal\"" }],
      links
    )
    expect(linked(segments)).toEqual([])
    expect(segments.length).toBe(1)
  })

  it("keeps an empty line as one empty token", () => {
    expect(segmentLine([plain("")], links)).toEqual([{ _tag: "Tokens", tokens: [plain("")] }])
  })

  it.effect("links real shiki output for the demo's code", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const highlighter = yield* makeSyntaxHighlighter
        const lines = highlightCode(
          highlighter,
          "const envelope = yield* seal(\"xchacha20-poly1305\", key, utf8ToBytes(note)) // seal",
          "typescript"
        )
        const segments = segmentLine(lines[0] ?? [], [
          { text: "seal", href: "/seal" },
          { text: "utf8ToBytes", href: "/utf8" }
        ])
        expect(linked(segments)).toEqual(["seal", "utf8ToBytes"])
      })
    ))
})
