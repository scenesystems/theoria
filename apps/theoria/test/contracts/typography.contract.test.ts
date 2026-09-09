import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import { SurfaceVariant } from "../../app/contracts/presentation.js"
import {
  fontSizeCss,
  lineHeightCss,
  maxWidthFor,
  metricsAt,
  metricsOverride,
  TextRole,
  textSemantics,
  textSemanticsByRole,
  viewports
} from "../../app/contracts/text.js"
import { deterministicTextLayoutLive } from "../../app/web/text/browserTextLayout.js"
import { projectText } from "../../app/web/view/text/authority.js"

describe("Typography contract", () => {
  it.effect("every role has a measure for every surface variant, and the measure is the one the table gives", () =>
    Effect.gen(function*() {
      // The table is keyed by the variant itself, so a variant added to `SurfaceVariant` is a width owed by every
      // role before the app compiles; nothing falls through to another variant's measure.
      Arr.forEach(TextRole.literals, (role) =>
        Arr.forEach(SurfaceVariant.literals, (variant) => {
          expect(maxWidthFor(role, variant)).toBe(textSemanticsByRole[role].maxWidth[variant])
        }))
      expect(maxWidthFor("display", "compact")).toBe(720)
      expect(maxWidthFor("display", "expanded")).toBe(1040)
    }))

  it.effect("display type is fluid on narrow viewports, in size and leading together", () =>
    Effect.gen(function*() {
      // At 320 the title stands five lines; fixed 36/40 leading pushes the hero's second action below
      // a 568 px fold. Size and leading both follow the width between their bounds, so the title keeps
      // one ratio and no width sees a step.
      const narrow = metricsAt("display", Option.some("narrow"))
      expect(fontSizeCss(narrow.fontSize)).toBe("clamp(32px, 10vw, 36px)")
      expect(lineHeightCss(narrow.lineHeight)).toBe("clamp(36px, 11.25vw, 40px)")
      // Fixed metrics still render as fixed pixels.
      expect(fontSizeCss(metricsAt("display", Option.none()).fontSize)).toBe("44px")
      expect(lineHeightCss(metricsAt("display", Option.none()).lineHeight)).toBe("50px")
    }))

  it.effect("keeps projected typography independent of responsive metrics", () =>
    Effect.gen(function*() {
      const base = metricsAt("stage-prose", Option.none())
      expect(metricsAt("stage-prose", Option.some("narrow"))).toEqual(base)
      expect(metricsAt("stage-prose", Option.some("wide"))).toEqual(base)

      const responsive = Arr.filter(
        textSemantics,
        (semantics) => Arr.some(viewports, (viewport) => Option.isSome(metricsOverride(semantics, viewport)))
      )
      expect(responsive.length).toBeGreaterThan(0)
      Arr.forEach(responsive, (semantics) => expect(semantics.wrapAuthority).toBe("native-browser"))
    }))

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
    }).pipe(Effect.provide(deterministicTextLayoutLive)))

  it.effect("projectText preserves explicit newlines in code blocks", () =>
    Effect.gen(function*() {
      const codeText = "const x = 1;\nconst y = 2;"

      const projection = yield* projectText({
        role: "code-block",
        variant: "expanded",
        text: codeText
      })

      expect(Arr.map(projection.lines, (line) => line.text)).toEqual(["const x = 1;", "const y = 2;"])
    }).pipe(Effect.provide(deterministicTextLayoutLive)))
})
