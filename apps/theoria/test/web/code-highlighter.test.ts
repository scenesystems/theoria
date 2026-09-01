import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import { highlightCode, makeSyntaxHighlighter } from "../../app/web/view/primitives/code/highlighter.js"

describe("Theoria Code Highlighter", () => {
  it.effect("classifies keywords, types, numbers, strings, and comments", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const highlighter = yield* makeSyntaxHighlighter
        const lines = highlightCode(
          highlighter,
          "const value: NumberBox = 42; const label = \"answer\" // note",
          "typescript"
        )
        const firstLine = lines[0] ?? []

        expect(Arr.some(firstLine, (token) => token.kind === "keyword" && token.value === "const")).toBe(true)
        expect(Arr.some(firstLine, (token) => token.kind === "type" && token.value === "NumberBox")).toBe(true)
        expect(Arr.some(firstLine, (token) => token.kind === "number" && token.value === "42")).toBe(true)
        expect(Arr.some(firstLine, (token) => token.kind === "string" && token.value.includes("answer"))).toBe(true)
        expect(Arr.some(firstLine, (token) => token.kind === "comment" && token.value.startsWith("//"))).toBe(true)
      })
    ))

  it.effect("keeps source line count stable including blank lines", () =>
    Effect.scoped(
      Effect.gen(function*() {
        const highlighter = yield* makeSyntaxHighlighter
        const source = "const a = 1\n\nconst b = \"two\""
        const lines = highlightCode(highlighter, source, "typescript")

        expect(lines.length).toBe(3)
        expect(lines[1]?.length).toBeGreaterThan(0)
      })
    ))
})
