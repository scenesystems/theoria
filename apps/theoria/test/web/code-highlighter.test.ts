import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import { highlightCode } from "../../app/web/view/primitives/code/highlighter.js"

describe("Theoria Code Highlighter", () => {
  it.effect("classifies keywords, types, numbers, strings, and comments", () =>
    Effect.gen(function*() {
      const lines = highlightCode("const value: NumberBox = 42 // note")
      const firstLine = lines[0] ?? []

      expect(Arr.some(firstLine, (token) => token.kind === "keyword" && token.value === "const")).toBe(true)
      expect(Arr.some(firstLine, (token) => token.kind === "type" && token.value === "NumberBox")).toBe(true)
      expect(Arr.some(firstLine, (token) => token.kind === "number" && token.value === "42")).toBe(true)
      expect(Arr.some(firstLine, (token) => token.kind === "comment" && token.value.startsWith("//"))).toBe(true)
    }))

  it.effect("keeps source line count stable including blank lines", () =>
    Effect.gen(function*() {
      const source = "const a = 1\n\nconst b = \"two\""
      const lines = highlightCode(source)

      expect(lines.length).toBe(3)
      expect(lines[1]?.length).toBeGreaterThan(0)
    }))
})
