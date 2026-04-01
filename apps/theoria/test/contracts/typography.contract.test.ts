import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import { layoutRequestFor, prepareInputFor, semanticsFor, textSemantics } from "../../app/contracts/text.js"
import { projectText } from "../../app/web/view/text/authority.js"

describe("Typography contract", () => {
  it("every role has weight, tracking, and family", () => {
    expect(textSemantics.length).toBe(12)

    Arr.forEach(textSemantics, (semantics) => {
      expect(semantics.weight).toBeDefined()
      expect(semantics.tracking).toBeDefined()
      expect(semantics.family).toBeDefined()
    })
  })

  it("display roles use negative or zero tracking", () => {
    const displayRoles = Arr.filter(textSemantics, (s) => s.family === "display")
    expect(displayRoles.length).toBeGreaterThan(0)

    Arr.forEach(displayRoles, (semantics) => {
      expect(semantics.tracking).toBeLessThanOrEqual(0)
    })
  })

  it("small body text roles use non-negative tracking", () => {
    const smallRoles = Arr.filter(
      textSemantics,
      (s) => s.fontSize <= 12 && s.family === "body"
    )

    Arr.forEach(smallRoles, (semantics) => {
      expect(semantics.tracking).toBeGreaterThanOrEqual(0)
    })
  })

  it("prepareInputFor produces valid effect-text input", () => {
    const input = prepareInputFor("hero-title", "Test heading")
    expect(input.text).toBe("Test heading")
    expect(input.font.size).toBe(38)
    expect(input.whiteSpace).toBe("normal")
  })

  it("layoutRequestFor respects variant measure constraints", () => {
    const compact = layoutRequestFor("card-summary", "compact")
    const expanded = layoutRequestFor("card-summary", "expanded")

    expect(expanded.maxWidth).toBeGreaterThan(compact.maxWidth)
    expect(compact.lineHeight).toBe(expanded.lineHeight)
  })

  it.effect("projectText produces glyph-aware line breaks", () =>
    Effect.gen(function*() {
      const longText =
        "This is a long sentence that should wrap across multiple lines when constrained to a narrow measure."

      const projection = yield* projectText({
        role: "row-label",
        variant: "compact",
        text: longText
      })

      const rowLabelSemantics = semanticsFor("row-label")
      expect(projection.summary.lineCount).toBeGreaterThan(1)
      expect(projection.layout.maxWidth).toBe(rowLabelSemantics.maxWidth.compact)
      expect(projection.layout.lineHeight).toBe(rowLabelSemantics.lineHeight)

      Arr.forEach(projection.lines, (line) => {
        expect(line.width).toBeLessThanOrEqual(projection.layout.maxWidth)
        expect(line.width).toBeGreaterThan(0)
      })
    }))

  it.effect("code-block uses pre-wrap white space mode", () =>
    Effect.gen(function*() {
      const codeText = "const x = 1;\nconst y = 2;"

      const projection = yield* projectText({
        role: "code-block",
        variant: "expanded",
        text: codeText
      })

      expect(projection.summary.lineCount).toBeGreaterThanOrEqual(2)
      expect(semanticsFor("code-block").whiteSpace).toBe("pre-wrap")
      expect(semanticsFor("code-block").family).toBe("mono")
    }))
})
