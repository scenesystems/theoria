import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Equal, Number as Num, Option, Order, Tuple } from "effect"
import * as Arr from "effect/Array"
import * as Chunk from "effect/Chunk"
import * as Str from "effect/String"

import {
  codeColor,
  CodePaint,
  ColorMode,
  composite,
  contrast,
  dangerColor,
  DangerRole,
  DiscSlot,
  discSlotRole,
  inSrgbGamut,
  linearSrgb,
  luminance,
  neutralColor,
  NeutralRole,
  neutralSlotRole,
  Oklch,
  paintedContrast,
  toneColor,
  ToneRole,
  toneSlotRole,
  toneTextSlots,
  toSrgb,
  Translucency,
  translucencyAlpha,
  translucentLevels
} from "../../app/contracts/palette.js"
import { CardTone } from "../../app/contracts/theme.js"
import { paletteClassCandidates, paletteTokens, renderPaletteTokensCss } from "../../app/web/palette/paletteTokens.js"
import { HighlightTokenKind, highlightTokenPaint } from "../../app/web/view/primitives/code/highlighter.js"
import {
  discSlotClassName,
  neutralToneClasses,
  toneClassCandidates,
  toneClassesFor
} from "../../app/web/view/primitives/designSystem.js"

/** The app's `app/web` directory, from this file rather than the working directory: the root test run starts elsewhere. */
const webRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path
  return yield* path.fromFileUrl(yield* Url.fromString("../../app/web/", import.meta.url))
}).pipe(Effect.orDie)

const white = new Oklch({ l: 1, c: 0, h: 0 })
const black = new Oklch({ l: 0, c: 0, h: 0 })

/** WCAG 2.x AA for body text, and the bound for graphical objects and component boundaries. */
const textMinimum = 4.5
const graphicMinimum = 3

const neutralSurfaces: ReadonlyArray<NeutralRole> = ["canvas", "paper", "instrument"]
const neutralInks: ReadonlyArray<NeutralRole> = ["ink-tertiary", "ink-secondary", "ink", "ink-strong"]
const toneOrder: ReadonlyArray<ToneRole> = ["surface", "wash", "edge", "accent-soft", "accent", "ink", "ink-strong"]

const lightnessDescends = (values: ReadonlyArray<number>): boolean =>
  Arr.every(Arr.zip(values, Arr.drop(values, 1)), ([above, below]) => Order.greaterThan(Num.Order)(above, below))

const toneTexts: ReadonlyArray<ToneRole> = ["accent", "ink", "ink-strong"]
/** The tone roles a focused control may stand on: a chosen pill's fill, a changed value's wash, a toggle's edge. */
const toneGrounds: ReadonlyArray<ToneRole> = ["surface", "wash", "edge"]
const bandStrokes: ReadonlyArray<DiscSlot> = ["bandStroke", "bandFocusedStroke"]

const pairs = <A, B>(as: ReadonlyArray<A>, bs: ReadonlyArray<B>): ReadonlyArray<readonly [A, B]> =>
  Arr.flatMap(as, (a) => Arr.map(bs, (b) => Tuple.make(a, b)))

describe("palette contract", () => {
  it.effect("contrast is the WCAG ratio: 21 between white and black, 1 for a colour against itself, and symmetric", () =>
    Effect.sync(() => {
      expect(contrast(white, black)).toBeCloseTo(21, 5)
      expect(contrast(black, white)).toBeCloseTo(21, 5)
      const canvas = neutralColor("canvas", "light")
      expect(contrast(canvas, canvas)).toBeCloseTo(1, 5)
      const ink = neutralColor("ink", "light")
      expect(contrast(ink, canvas)).toBeCloseTo(contrast(canvas, ink), 10)
    }))

  it.effect("OKLCH converts to the sRGB the browser paints", () =>
    Effect.sync(() => {
      // #ef4444, a reference red, measured in OKLCH.
      const red = toSrgb(new Oklch({ l: 0.637, c: 0.208, h: 25.3 }))
      expect(Num.between(red.r, { minimum: 238, maximum: 240 })).toBe(true)
      expect(Num.between(red.g, { minimum: 67, maximum: 69 })).toBe(true)
      expect(Num.between(red.b, { minimum: 67, maximum: 69 })).toBe(true)
      expect(toSrgb(white)).toEqual({ r: 255, g: 255, b: 255 })
      expect(toSrgb(black)).toEqual({ r: 0, g: 0, b: 0 })
      // The pure primaries sit on the gamut's corners, so a colour just beyond them is out and one just inside is in.
      expect(inSrgbGamut(new Oklch({ l: 0.9, c: 0.3, h: 145 }))).toBe(false)
      expect(inSrgbGamut(new Oklch({ l: 0.5, c: 0.05, h: 145 }))).toBe(true)
      expect(Chunk.size(linearSrgb(white))).toBe(3)
    }))

  it.effect("every colour the palette names is inside the sRGB gamut, so what is painted is what was measured", () =>
    Effect.sync(() => {
      Arr.forEach(ColorMode.literals, (mode) => {
        Arr.forEach(NeutralRole.literals, (role) => expect(inSrgbGamut(neutralColor(role, mode))).toBe(true))
        Arr.forEach(
          pairs(CardTone.literals, ToneRole.literals),
          ([tone, role]) => expect(inSrgbGamut(toneColor(tone, role, mode))).toBe(true)
        )
        Arr.forEach(DangerRole.literals, (role) => expect(inSrgbGamut(dangerColor(role, mode))).toBe(true))
        Arr.forEach(CodePaint.literals, (kind) => expect(inSrgbGamut(codeColor(kind, mode))).toBe(true))
      })
    }))

  it.effect("every neutral ink reads at AA on every neutral surface, in both modes", () =>
    Effect.sync(() => {
      Arr.forEach(ColorMode.literals, (mode) =>
        Arr.forEach(pairs(neutralInks, neutralSurfaces), ([ink, surface]) => {
          const ratio = contrast(neutralColor(ink, mode), neutralColor(surface, mode))
          expect(ratio, `${ink} on ${surface} (${mode})`).toBeGreaterThanOrEqual(textMinimum)
        }))
    }))

  it.effect("text on an emphasis fill reads at AA at rest and under the pointer", () =>
    Effect.sync(() => {
      Arr.forEach(ColorMode.literals, (mode) => {
        const onEmphasis = neutralColor("on-emphasis", mode)
        expect(contrast(onEmphasis, neutralColor("emphasis", mode))).toBeGreaterThanOrEqual(textMinimum)
        expect(contrast(onEmphasis, neutralColor("emphasis-hover", mode))).toBeGreaterThanOrEqual(textMinimum)
      })
    }))

  it.effect("the neutral accent marks a boundary on every neutral surface, in both modes", () =>
    Effect.sync(() => {
      Arr.forEach(ColorMode.literals, (mode) =>
        Arr.forEach(neutralSurfaces, (surface) => {
          const ratio = contrast(neutralColor("accent", mode), neutralColor(surface, mode))
          expect(ratio, `accent on ${surface} (${mode})`).toBeGreaterThanOrEqual(graphicMinimum)
        }))
    }))

  it.effect("the focus ring marks a boundary on every neutral surface and on every tone's surface, wash and edge, in both modes", () =>
    Effect.sync(() => {
      Arr.forEach(ColorMode.literals, (mode) => {
        const focus = neutralColor("focus", mode)
        Arr.forEach(neutralSurfaces, (surface) => {
          expect(contrast(focus, neutralColor(surface, mode)), `focus on ${surface} (${mode})`)
            .toBeGreaterThanOrEqual(graphicMinimum)
        })
        Arr.forEach(pairs(CardTone.literals, toneGrounds), ([tone, role]) => {
          expect(contrast(focus, toneColor(tone, role, mode)), `focus on ${tone} ${role} (${mode})`)
            .toBeGreaterThanOrEqual(graphicMinimum)
        })
      })
    }))

  it.effect("a tone's accent and inks read at AA on the neutral surfaces and on the tone's own surface", () =>
    Effect.sync(() => {
      Arr.forEach(pairs(ColorMode.literals, CardTone.literals), ([mode, tone]) => {
        const grounds = Arr.append(
          Arr.map(neutralSurfaces, (surface) => neutralColor(surface, mode)),
          toneColor(tone, "surface", mode)
        )
        Arr.forEach(pairs(toneTexts, grounds), ([role, ground]) => {
          const ratio = contrast(toneColor(tone, role, mode), ground)
          expect(ratio, `${tone} ${role} (${mode})`).toBeGreaterThanOrEqual(textMinimum)
        })
        const wash = toneColor(tone, "wash", mode)
        expect(contrast(toneColor(tone, "ink", mode), wash), `${tone} ink on wash (${mode})`).toBeGreaterThanOrEqual(
          textMinimum
        )
        expect(contrast(toneColor(tone, "ink-strong", mode), wash), `${tone} ink-strong on wash (${mode})`)
          .toBeGreaterThanOrEqual(
            textMinimum
          )
      })
    }))

  it.effect("every slot read as text holds AA on the surfaces it stands on, in every tone and in the neutral", () =>
    Effect.sync(() => {
      Arr.forEach(pairs(ColorMode.literals, toneTextSlots), ([mode, slot]) => {
        const neutralGrounds = Arr.map(neutralSurfaces, (surface) => neutralColor(surface, mode))
        Arr.forEach(neutralGrounds, (ground) => {
          const ratio = contrast(neutralColor(neutralSlotRole(slot), mode), ground)
          expect(ratio, `neutral ${slot} (${mode})`).toBeGreaterThanOrEqual(textMinimum)
        })
        Arr.forEach(CardTone.literals, (tone) => {
          const grounds = Arr.appendAll(neutralGrounds, [
            toneColor(tone, "surface", mode),
            toneColor(tone, toneSlotRole("bgTinted"), mode),
            toneColor(tone, toneSlotRole("wash"), mode)
          ])
          Arr.forEach(grounds, (ground) => {
            const ratio = contrast(toneColor(tone, toneSlotRole(slot), mode), ground)
            expect(ratio, `${tone} ${slot} (${mode})`).toBeGreaterThanOrEqual(textMinimum)
          })
        })
      })
    }))

  it.effect("translucency runs from solid to mist, each level letting more through, and a solid colour is itself", () =>
    Effect.sync(() => {
      const alphas = Arr.map(Translucency.literals, translucencyAlpha)
      expect(lightnessDescends(alphas)).toBe(true)
      expect(translucencyAlpha("solid")).toBe(1)
      expect(translucentLevels).not.toContain("solid")
      const paper = neutralColor("paper", "light")
      const canvas = neutralColor("canvas", "dark")
      expect(composite(paper, "solid", canvas)).toEqual(toSrgb(paper))
      // Half-way maths: white at mist (38%) over black is 38% of 255, rounded, in every channel.
      expect(composite(white, "mist", black)).toEqual({ r: 97, g: 97, b: 97 })
      // A translucent colour lies between itself and its ground, so its contrast to the ground is below the solid's.
      const ink = neutralColor("ink", "light")
      expect(paintedContrast(composite(paper, "veil", canvas), toSrgb(ink))).toBeLessThan(contrast(paper, ink))
      expect(paintedContrast(composite(paper, "veil", canvas), toSrgb(ink))).toBeGreaterThan(
        paintedContrast(composite(paper, "glass", canvas), toSrgb(ink))
      )
    }))

  it.effect("every neutral ink reads at AA on every translucent paper, canvas and instrument over every neutral ground, in both modes", () =>
    Effect.sync(() => {
      Arr.forEach(
        ColorMode.literals,
        (mode) =>
          Arr.forEach(
            pairs(neutralSurfaces, neutralSurfaces),
            ([surface, ground]) =>
              Arr.forEach(pairs(translucentLevels, neutralInks), ([level, ink]) => {
                const painted = composite(neutralColor(surface, mode), level, neutralColor(ground, mode))
                const ratio = paintedContrast(toSrgb(neutralColor(ink, mode)), painted)
                expect(ratio, `${ink} on ${surface}-${level} over ${ground} (${mode})`).toBeGreaterThanOrEqual(
                  textMinimum
                )
              })
          )
      )
    }))

  it.effect("the band's disc strokes mark a boundary on its fill, at rest and under focus, in both modes", () =>
    Effect.sync(() => {
      Arr.forEach(pairs(ColorMode.literals, CardTone.literals), ([mode, tone]) => {
        const fill = toneColor(tone, discSlotRole("bandFill"), mode)
        Arr.forEach(bandStrokes, (slot) => {
          const ratio = contrast(toneColor(tone, discSlotRole(slot), mode), fill)
          expect(ratio, `${tone} ${slot} on bandFill (${mode})`).toBeGreaterThanOrEqual(graphicMinimum)
        })
      })
    }))

  it.effect("a tone's ladder runs from surface to ink in lightness order, and the order inverts between modes", () =>
    Effect.sync(() => {
      Arr.forEach(CardTone.literals, (tone) => {
        const light = Arr.map(toneOrder, (role) => luminance(toneColor(tone, role, "light")))
        const dark = Arr.map(toneOrder, (role) => luminance(toneColor(tone, role, "dark")))
        expect(lightnessDescends(light), `${tone} light`).toBe(true)
        expect(lightnessDescends(Arr.reverse(dark)), `${tone} dark`).toBe(true)
      })
    }))

  it.effect("light mode is bright paper under dark ink; dark mode is the reverse", () =>
    Effect.sync(() => {
      Arr.forEach(pairs(neutralInks, neutralSurfaces), ([ink, surface]) => {
        expect(luminance(neutralColor(ink, "light"))).toBeLessThan(luminance(neutralColor(surface, "light")))
        expect(luminance(neutralColor(ink, "dark"))).toBeGreaterThan(luminance(neutralColor(surface, "dark")))
      })
      expect(luminance(neutralColor("canvas", "light"))).toBeGreaterThan(luminance(neutralColor("canvas", "dark")))
    }))

  it.effect("every syntax paint reads at AA on paper, on the canvas and on a focused line, in both modes", () =>
    Effect.sync(() => {
      Arr.forEach(
        pairs(ColorMode.literals, CodePaint.literals),
        ([mode, kind]) =>
          Arr.forEach(neutralSurfaces, (surface) => {
            const ratio = contrast(codeColor(kind, mode), neutralColor(surface, mode))
            expect(ratio, `${kind} on ${surface} (${mode})`).toBeGreaterThanOrEqual(textMinimum)
          })
      )
    }))

  it.effect("danger's ink reads at AA and its accent marks a boundary on every neutral surface", () =>
    Effect.sync(() => {
      Arr.forEach(pairs(ColorMode.literals, neutralSurfaces), ([mode, surface]) => {
        const ground = neutralColor(surface, mode)
        expect(contrast(dangerColor("ink", mode), ground), `danger ink on ${surface} (${mode})`).toBeGreaterThanOrEqual(
          textMinimum
        )
        expect(contrast(dangerColor("accent", mode), ground), `danger accent on ${surface} (${mode})`)
          .toBeGreaterThanOrEqual(
            graphicMinimum
          )
      })
    }))
})

describe("Generated palette tokens", () => {
  it.effect("names every token once, in both modes, and the highlighter's paint reads tokens that exist", () =>
    Effect.sync(() => {
      Arr.forEach(ColorMode.literals, (mode) => {
        const names = Arr.map(paletteTokens(mode), ([name]) => name)
        expect(names).toEqual(Arr.dedupe(names))
      })
      const lightNames = Arr.map(paletteTokens("light"), ([name]) => name)
      const darkNames = Arr.map(paletteTokens("dark"), ([name]) => name)
      expect(darkNames).toEqual(lightNames)
      // Every colour role is painted at every translucent level, as the level's alpha.
      Arr.forEach(pairs(NeutralRole.literals, translucentLevels), ([role, level]) => {
        expect(lightNames).toContain(`--th-${role}-${level}`)
      })
      Arr.forEach(pairs(CardTone.literals, pairs(ToneRole.literals, translucentLevels)), ([tone, [role, level]]) => {
        expect(lightNames).toContain(`--th-tone-${tone}-${role}-${level}`)
      })
      const paperVeil = Arr.findFirst(paletteTokens("light"), ([name]) => Equal.equals(name, "--th-paper-veil"))
      expect(paperVeil).toEqual(Option.some(["--th-paper-veil", "rgb(255 255 255 / 86%)"]))
      Arr.forEach(HighlightTokenKind.literals, (kind) => {
        const variable = highlightTokenPaint[kind].variable
        const token = Str.slice(4, Str.length(variable) - 1)(variable)
        expect(lightNames, `${kind} reads ${variable}`).toContain(token)
      })
    }))

  it.effect("declares every class a tone's slots and a disc's slots compose, so none is purged", () =>
    Effect.sync(() => {
      const composed = Arr.flatten([
        toneClassCandidates(neutralToneClasses),
        Arr.flatMap(CardTone.literals, (tone) => toneClassCandidates(toneClassesFor(tone))),
        Arr.flatMap(CardTone.literals, (tone) => Arr.map(DiscSlot.literals, (slot) => discSlotClassName(tone, slot)))
      ])
      Arr.forEach(composed, (className) => expect(paletteClassCandidates).toContain(className))
      expect(paletteClassCandidates).toEqual(Arr.dedupe(paletteClassCandidates))
      // A slot's class is the utility for that slot in the tone's role: the recipe, not a literal per tone.
      expect(toneClassesFor("math").text).toBe("text-tone-math-ink")
      expect(toneClassesFor("seal").borderSubtle).toBe("border-tone-seal-wash-veil")
      expect(toneClassesFor("dsp").bgTinted).toBe("bg-tone-dsp-surface-mist")
      expect(discSlotClassName("math", "ring")).toBe("ring-tone-math-edge-glass")
      expect(neutralToneClasses.textStrong).toBe("text-ink")
      expect(discSlotClassName("sign", "bandFocusedStroke")).toBe("stroke-tone-sign-ink")
    }))

  it.effect("matches the palette authority, and the stylesheet keeps no colour or colour name of its own", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* webRoot
      const generated = yield* fileSystem.readFileString(path.join(root, "palette-tokens.generated.css"))
      const styles = yield* fileSystem.readFileString(path.join(root, "styles.css"))

      expect(generated).toBe(renderPaletteTokensCss())
      expect(generated).toMatch(/^@source inline\(".*\btext-tone-math-ink\b.*"\);$/mu)
      expect(generated).toMatch(/^\s*\.bg-place-disc-digest\s*\{/mu)
      expect(styles).not.toMatch(/^\s*--th-[a-z-]+:/mu)
      expect(styles).not.toMatch(/^\s*--color-[a-z0-9-]+:/mu)
      expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/iu)
      expect(styles).not.toMatch(/\brgba?\(/u)
      expect(styles).not.toMatch(/\boklch\(/u)
      expect(generated).toMatch(/^@source inline\(".*\bbg-tone-dsp-surface-mist\b.*"\);$/mu)
    }).pipe(Effect.provide(BunContext.layer)))
})
