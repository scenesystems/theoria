import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import { projectText } from "../../app/web/view/text/authority.js"

describe("Typography contract", () => {
  it.effect("projectText produces glyph-aware line breaks", () =>
    Effect.gen(function*() {
      const longText =
        "This is a long sentence that should wrap across multiple lines when constrained to a narrow measure."

      const projection = yield* projectText({
        role: "row-label",
        variant: "compact",
        text: longText
      })

      expect(projection.summary.lineCount).toBeGreaterThan(1)

      Arr.forEach(projection.lines, (line) => {
        expect(line.width).toBeLessThanOrEqual(projection.layout.maxWidth)
        expect(line.width).toBeGreaterThan(0)
      })
    }))

  it.effect("projectText preserves explicit newlines in code blocks", () =>
    Effect.gen(function*() {
      const codeText = "const x = 1;\nconst y = 2;"

      const projection = yield* projectText({
        role: "code-block",
        variant: "expanded",
        text: codeText
      })

      expect(Arr.map(projection.lines, (line) => line.text)).toEqual(["const x = 1;", "const y = 2;"])
    }))
})
