import { describe, expect, it } from "@effect/vitest"
import { Array, Effect, Schema } from "effect"
import { renderToStaticMarkup } from "react-dom/server"

import { GuideInlineSchema } from "@theoria/docs-model"
import { DocsRichText } from "../../app/web/view/docs/DocsRichText.js"

const renderMath = (text: string, display: boolean) =>
  Schema.decodeUnknown(GuideInlineSchema)({ kind: "math", text, display }).pipe(
    Effect.map((part) => renderToStaticMarkup(<DocsRichText parts={Array.of(part)} />))
  )

describe("mathematical documentation", () => {
  it.effect("renders fractions and roots as accessible MathML with distinct inline and display placement", () =>
    Effect.gen(function*() {
      const inline = yield* renderMath("\\frac{1}{\\sqrt{3}}", false)
      const display = yield* renderMath("\\sum_{i=1}^{n} i^2", true)

      expect(inline).toContain("xmlns=\"http://www.w3.org/1998/Math/MathML\"")
      expect(inline).toContain("<mfrac>")
      expect(inline).toContain("<msqrt>")
      expect(inline).toContain("<annotation encoding=\"application/x-tex\">\\frac{1}{\\sqrt{3}}</annotation>")
      expect(inline).not.toContain("display=\"block\"")
      expect(display).toContain("display=\"block\"")
      expect(display).toContain("<munderover>")
      expect(display).not.toContain("aria-hidden=\"true\"")
      expect(display).not.toContain("style=")
    }))

  it.effect("shows malformed LaTeX as escaped source without breaking surrounding prose", () =>
    Effect.gen(function*() {
      const parts = yield* Schema.decodeUnknown(Schema.Array(GuideInlineSchema))(Array.make(
        { kind: "text", text: "Before " },
        { kind: "math", text: "\\frac{<img src=x onerror=alert(1)>}", display: false },
        { kind: "text", text: " after." }
      ))
      const content = renderToStaticMarkup(<DocsRichText parts={parts} />)

      expect(content).toContain("Before ")
      expect(content).toContain(" after.")
      expect(content).toContain("Invalid LaTeX")
      expect(content).toContain("&lt;img")
      expect(content).not.toContain("<img")
      expect(content).not.toContain("<math")
    }))

  it.effect("does not admit TeX commands that inject HTML or load external resources", () =>
    Effect.gen(function*() {
      const html = yield* renderMath("\\htmlStyle{background:url(https://example.com/probe)}{x}", false)
      const image = yield* renderMath("\\includegraphics{https://example.com/probe}", true)
      const text = yield* renderMath("\\text{<script>alert(1)</script>}", false)

      expect(html).not.toContain("style=")
      expect(image).not.toContain("<img")
      expect(image).not.toContain("<mglyph")
      expect(text).not.toContain("<script>")
      expect(text).toContain("&lt;script&gt;")
    }))

  it.effect("isolates macro definitions between expressions and bounds recursive expansion", () =>
    Effect.gen(function*() {
      const defining = yield* renderMath("\\gdef\\local{7}\\local", false)
      const separate = yield* renderMath("\\local", false)
      const recursive = yield* renderMath("\\def\\loop{\\loop}\\loop", false)
      const following = yield* renderMath("x^2", false)

      expect(defining).toContain("<mn>7</mn>")
      expect(separate).toContain("Invalid LaTeX")
      expect(recursive).toContain("Invalid LaTeX")
      expect(following).toContain("<msup>")
      expect(following).not.toContain("Invalid LaTeX")
    }))
})
