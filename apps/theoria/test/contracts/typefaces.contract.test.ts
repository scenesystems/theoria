import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import {
  FontFamily,
  fontFamilyCss,
  measuredFont,
  servedFontFamily,
  typefaceFallbackFaces,
  typefaceFallbacks
} from "../../app/contracts/text.js"

/** The percentage CSS writes for a ratio, to the four decimals the fallback faces carry. */
const percent = (ratio: number): string => `${(Math.round(ratio * 1_000_000) / 10_000).toFixed(4)}%`

describe("Typefaces contract", () => {
  it.effect("every family is set in its served variable face first, then metric-matched stand-ins, then the generic", () =>
    Effect.sync(() => {
      expect(servedFontFamily("body")).toBe("Figtree Variable")
      expect(servedFontFamily("display")).toBe("Figtree Variable")
      expect(servedFontFamily("mono")).toBe("JetBrains Mono Variable")
      expect(fontFamilyCss("body")).toBe(fontFamilyCss("display"))
      expect(Str.startsWith("\"Figtree Variable\", \"Figtree Variable Fallback: ")(fontFamilyCss("body"))).toBe(true)
      expect(Str.endsWith(", sans-serif")(fontFamilyCss("body"))).toBe(true)
      expect(Str.startsWith("\"JetBrains Mono Variable\", \"JetBrains Mono Variable Fallback: ")(fontFamilyCss("mono")))
        .toBe(true)
      expect(Str.endsWith(", monospace")(fontFamilyCss("mono"))).toBe(true)
    }))

  it.effect("each stand-in a stack names has a local face whose ascent and descent are set to the served face's", () =>
    Effect.sync(() => {
      Arr.forEach(FontFamily.literals, (family) => {
        const aliases = Arr.map(typefaceFallbacks(family), (fallback) => fallback.alias)
        expect(aliases.length).toBeGreaterThan(1)
        Arr.forEach(aliases, (alias) => {
          expect(fontFamilyCss(family)).toContain(`"${alias}"`)
          const face = Arr.findFirst(
            Str.split(typefaceFallbackFaces, "@font-face"),
            (block) => Str.includes(`font-family: "${alias}";`)(block)
          )
          expect(face._tag).toBe("Some")
          // `size-adjust` is written only where the stand-in's average advance differs; the overrides always are.
          Arr.forEach(
            ["src: local(", "ascent-override: ", "descent-override: "],
            (descriptor) => expect(face).toMatchObject({ value: expect.stringContaining(descriptor) })
          )
        })
      })
    }))

  it.effect("Arial stands in for Figtree at Figtree's proportions: the CSS metric overrides, from the two fonts' tables", () =>
    Effect.sync(() => {
      // Figtree: 1000 units per em, ascent 950, descent 250, average advance 449.
      // Arial: 2048 units per em, ascent 1854, descent 434, line gap 67, average advance 913.
      const sizeAdjust = (449 / 1000) / (913 / 2048)
      const face = Arr.findFirst(
        Str.split(typefaceFallbackFaces, "@font-face"),
        Str.includes("font-family: \"Figtree Variable Fallback: Arial\";")
      )
      expect(face).toMatchObject({
        value: expect.stringContaining(`size-adjust: ${percent(sizeAdjust)}`)
      })
      expect(face).toMatchObject({
        value: expect.stringContaining(`ascent-override: ${percent(950 / (1000 * sizeAdjust))}`)
      })
      expect(face).toMatchObject({
        value: expect.stringContaining(`descent-override: ${percent(250 / (1000 * sizeAdjust))}`)
      })
      // Figtree has no line gap; Arial's must be overridden away or the stand-in stands taller.
      expect(face).toMatchObject({ value: expect.stringContaining("line-gap-override: 0%") })
    }))

  it.effect("Courier New stands in for JetBrains Mono at the same advance, so code does not rewrap", () =>
    Effect.sync(() => {
      // JetBrains Mono: 600/1000 per character; Courier New: 1229/2048 — 0.6001, the same advance.
      const face = Arr.findFirst(
        Str.split(typefaceFallbackFaces, "@font-face"),
        Str.includes("font-family: \"JetBrains Mono Variable Fallback: Courier New\";")
      )
      expect(face).toMatchObject({
        value: expect.stringContaining(`size-adjust: ${percent((600 / 1000) / (1229 / 2048))}`)
      })
    }))

  it.effect("the faces measured before drawing are the served ones at their normal weight", () =>
    Effect.sync(() => {
      expect(measuredFont("body")).toBe("400 16px \"Figtree Variable\"")
      expect(measuredFont("mono")).toBe("400 16px \"JetBrains Mono Variable\"")
    }))
})
