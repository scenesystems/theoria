import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Equal, Match, Number as Num, Option, Order, Tuple } from "effect"
import * as Arr from "effect/Array"
import * as Chunk from "effect/Chunk"
import * as Str from "effect/String"

import type { DiscSlot, Family, ToneSlot } from "../../app/contracts/palette.js"
import {
  codeColor,
  CodePaint,
  ColorMode,
  composite,
  contrast,
  dangerColor,
  DangerRole,
  discSlotRole,
  familyColor,
  inSrgbGamut,
  linearSrgb,
  luminance,
  neutralColor,
  NeutralRole,
  neutralSlotRole,
  Oklch,
  paintedContrast,
  Srgb,
  toneColor,
  ToneRole,
  toneSlotRole,
  toneTextSlots,
  toSrgb,
  Translucency,
  translucencyAlpha,
  translucentLevels
} from "../../app/contracts/palette.js"
import { Tone } from "../../app/contracts/theme.js"
import { paletteTokens, renderPaletteTokensCss } from "../../app/web/palette/paletteTokens.js"
import { HighlightTokenKind, highlightTokenPaint } from "../../app/web/view/primitives/code/highlighter.js"
import { discSlotClassName, neutralToneClasses, toneClassesFor } from "../../app/web/view/primitives/designSystem.js"

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

const toneTexts: ReadonlyArray<ToneRole> = ["ink", "ink-strong"]
/** The roles that carry a tone's voice: its marks and its text. Pale grounds sit too near white to read a saturation. */
const toneVoiced: ReadonlyArray<ToneRole> = ["accent-soft", "accent", "ink"]
/**
 * The neutral rungs a control at rest climbs: its ground, then the fill under
 * the pointer and pressed on paper, which are in turn the ground and the two
 * steps on an instrument rail.
 */
const pointerRungs: ReadonlyArray<NeutralRole> = ["paper", "instrument", "hairline", "hairline-strong"]
/**
 * The least contrast between a fill and the same fill one state on for the
 * change to be seen at all: a glass of the next rung over its own ground
 * stays under it, a solid rung clears it.
 */
const stateStepMinimum = 1.1
/** A filled action's fill at rest, under the pointer and pressed. */
const emphasisStates: ReadonlyArray<NeutralRole> = ["emphasis", "emphasis-hover", "emphasis-pressed"]
/** The slots a control wears under the pointer, each beside the slot it deepens. */
const hoverSteps: ReadonlyArray<readonly [rest: ToneSlot, hover: ToneSlot]> = [
  ["bg", "bgHover"],
  ["border", "borderHover"],
  ["bgTinted", "bgTintedHover"]
]
/** Further from the paper: darker in light mode, lighter in dark. */
const deeperThan = (mode: ColorMode) =>
  Match.value(mode).pipe(
    Match.when("light", () => Order.lessThan(Num.Order)),
    Match.when("dark", () => Order.greaterThan(Num.Order)),
    Match.exhaustive
  )
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
          pairs(Tone.literals, ToneRole.literals),
          ([tone, role]) => expect(inSrgbGamut(toneColor(tone, role, mode))).toBe(true)
        )
        Arr.forEach(DangerRole.literals, (role) => expect(inSrgbGamut(dangerColor(role, mode))).toBe(true))
        Arr.forEach(CodePaint.literals, (kind) => expect(inSrgbGamut(codeColor(kind, mode))).toBe(true))
      })
    }))

  it.effect("the ramps pass through the reference: each of its colours is painted back at its own lightness", () =>
    Effect.sync(() => {
      const painted = (family: Family, mode: ColorMode, l: number) => toSrgb(familyColor(family, mode, l))
      expect(painted("grey", "light", 1)).toStrictEqual(new Srgb({ r: 255, g: 255, b: 255 }))
      expect(painted("grey", "light", 0.8459), "light blue").toStrictEqual(new Srgb({ r: 188, g: 209, b: 212 }))
      expect(painted("brand", "light", 0.8459), "light blue, where the brand meets the grey").toStrictEqual(
        new Srgb({ r: 188, g: 209, b: 212 })
      )
      expect(painted("brand", "light", 0.7073), "muted teal").toStrictEqual(new Srgb({ r: 128, g: 170, b: 169 }))
      expect(painted("brand", "light", 0.5695), "pine blue").toStrictEqual(new Srgb({ r: 69, g: 132, b: 126 }))
      expect(painted("brand", "light", 0.4306), "pine teal").toStrictEqual(new Srgb({ r: 9, g: 93, b: 83 }))
      expect(painted("brand", "light", 0.3056), "dark teal").toStrictEqual(new Srgb({ r: 10, g: 54, b: 57 }))
      expect(painted("brand", "dark", 0.3056), "dark teal, the dark ramp's foot").toStrictEqual(
        new Srgb({ r: 10, g: 54, b: 57 })
      )
    }))

  it.effect("between two stops a family lies between them in chroma and hue, and beyond its ends it keeps the end's colour", () =>
    Effect.sync(() => {
      const within = (value: number, a: number, b: number) =>
        Num.between(value, { minimum: Num.min(a, b), maximum: Num.max(a, b) })
      // Between the pine blue (L .5695, c .0659, h 187.5) and the pine teal (L .4306, c .0743, h 182).
      const midTeal = familyColor("brand", "light", 0.5)
      expect(midTeal.l).toBe(0.5)
      expect(within(midTeal.c, 0.0659, 0.0743), `chroma ${midTeal.c}`).toBe(true)
      expect(within(midTeal.h, 182, 187.5), `hue ${midTeal.h}`).toBe(true)
      // Between the ghost white (c .006) and the light blue (c .023) the grey gathers chroma as it darkens.
      const paleGrey = familyColor("grey", "light", 0.9)
      expect(within(paleGrey.c, 0.006, 0.023), `chroma ${paleGrey.c}`).toBe(true)
      expect(Order.greaterThan(Num.Order)(paleGrey.c, familyColor("grey", "light", 0.95).c)).toBe(true)
      // Above the light blue the brand's light ramp ends: a paler brand keeps the light blue's chroma and hue.
      const aboveTop = familyColor("brand", "light", 0.95)
      expect(aboveTop).toStrictEqual(new Oklch({ l: 0.95, c: 0.023, h: 207.1 }))
      // The dark canvas lies just above the ink black on the grey: bluer than the dusk above it, not yet the ink black.
      const nearInk = familyColor("grey", "dark", 0.2)
      expect(nearInk.l).toBe(0.2)
      const dusk = familyColor("grey", "dark", 0.3056)
      const inkBlack = familyColor("grey", "dark", 0.1729)
      expect(within(nearInk.h, dusk.h, inkBlack.h)).toBe(true)
      expect(Order.greaterThan(Num.Order)(nearInk.h, dusk.h), `hue ${nearInk.h} leans towards the ink black's`).toBe(
        true
      )
      expect(Order.lessThan(Num.Order)(nearInk.h, inkBlack.h), `hue ${nearInk.h} is not yet the ink black's`).toBe(true)
    }))

  it.effect("the grey never competes with the colour: every neutral keeps to the teal's hue band and carries less chroma than the brand at its lightness", () =>
    Effect.sync(() => {
      // The brand's hues run from the pine teal (182) to the light blue (207); a grey may lean a little bluer, never to a lavender or a navy.
      const tealBand = { minimum: 180, maximum: 240 }
      Arr.forEach(pairs(ColorMode.literals, NeutralRole.literals), ([mode, role]) => {
        const color = neutralColor(role, mode)
        expect(Num.between(color.h, tealBand), `${role} ${mode}: hue ${color.h}`).toBe(true)
      })
      Arr.forEach(pairs(ColorMode.literals, ToneRole.literals), ([mode, role]) => {
        const program = toneColor("tertiary", role, mode)
        expect(Num.between(program.h, tealBand), `${role} ${mode}: hue ${program.h}`).toBe(true)
      })
      // Where a tone is read — its marks and its text — the three voices step down in colour: reader, neighbor, program.
      Arr.forEach(pairs(ColorMode.literals, toneVoiced), ([mode, role]) => {
        const reader = toneColor("primary", role, mode)
        const neighbor = toneColor("secondary", role, mode)
        const program = toneColor("tertiary", role, mode)
        expect(
          Order.greaterThan(Num.Order)(neighbor.c, program.c),
          `${role} ${mode}: the neighbor carries more colour than the program`
        )
          .toBe(true)
        expect(
          Order.greaterThan(Num.Order)(reader.c, neighbor.c),
          `${role} ${mode}: the reader carries more colour than the neighbor`
        )
          .toBe(true)
      })
    }))

  it.effect("no role carries a colour of its own: every neutral is the grey at its lightness, every tone and syntax paint the brand or the grey at theirs", () =>
    Effect.sync(() => {
      const onFamily = (family: Family, mode: ColorMode) => (color: Oklch) =>
        Equal.equals(color, familyColor(family, mode, color.l))
      Arr.forEach(ColorMode.literals, (mode) => {
        const grey = onFamily("grey", mode)
        const brand = onFamily("brand", mode)
        Arr.forEach(NeutralRole.literals, (role) =>
          expect(
            Match.value(role).pipe(
              Match.when("focus", () => brand(neutralColor(role, mode))),
              Match.orElse(() => grey(neutralColor(role, mode)))
            ),
            `${role} ${mode}`
          ).toBe(true))
        Arr.forEach(ToneRole.literals, (role) => {
          expect(brand(toneColor("primary", role, mode)), `primary ${role} ${mode}`).toBe(true)
          expect(grey(toneColor("tertiary", role, mode)), `tertiary ${role} ${mode}`).toBe(true)
        })
        Arr.forEach(CodePaint.literals, (kind) =>
          expect(
            Match.value(kind).pipe(
              Match.whenOr("comment", "operator", () => grey(codeColor(kind, mode))),
              Match.whenOr("keyword", "type", "function", () => brand(codeColor(kind, mode))),
              Match.whenOr("string", "number", () => {
                const color = codeColor(kind, mode)
                const full = familyColor("brand", mode, color.l)
                return Equal.equals(color, new Oklch({ l: full.l, c: Num.multiply(full.c, 0.5), h: full.h }))
              }),
              Match.exhaustive
            ),
            `${kind} ${mode}`
          ).toBe(true))
      })
    }))

  it.effect("a voice is told from another by saturation alone: one lightness per role, the reader's deepest in colour", () =>
    Effect.sync(() => {
      Arr.forEach(pairs(ColorMode.literals, ToneRole.literals), ([mode, role]) => {
        const reader = toneColor("primary", role, mode)
        const neighbor = toneColor("secondary", role, mode)
        const program = toneColor("tertiary", role, mode)
        expect(neighbor.l, `${role} ${mode}: the neighbor stands at the reader's lightness`).toBe(reader.l)
        expect(program.l, `${role} ${mode}: the program stands at the reader's lightness`).toBe(reader.l)
        expect(neighbor.h, `${role} ${mode}: the neighbor speaks in the reader's hue`).toBe(reader.h)
        expect(Order.greaterThan(Num.Order)(reader.c, neighbor.c), `${role} ${mode}: the reader carries more colour`)
          .toBe(
            true
          )
        expect(
          Equal.equals(program, familyColor("grey", mode, reader.l)),
          `${role} ${mode}: the program speaks in the grey`
        )
          .toBe(true)
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

  it.effect("text on an emphasis fill reads at AA at rest, under the pointer and pressed, and each state steps the same way", () =>
    Effect.sync(() => {
      Arr.forEach(ColorMode.literals, (mode) => {
        const onEmphasis = neutralColor("on-emphasis", mode)
        const fills = Arr.map(emphasisStates, (role) => neutralColor(role, mode))
        Arr.forEach(fills, (fill) => expect(contrast(onEmphasis, fill), mode).toBeGreaterThanOrEqual(textMinimum))
        // Rest, pointer, press: each a step towards the text on it, so a press never looks like letting go.
        const towardsText = Arr.map(fills, (fill) => contrast(onEmphasis, fill))
        expect(lightnessDescends(towardsText), `emphasis steps (${mode})`).toBe(true)
      })
    }))

  it.effect("a tone's accent marks a boundary on the neutral surfaces and on the tone's own surface, in both modes", () =>
    Effect.sync(() => {
      Arr.forEach(pairs(ColorMode.literals, Tone.literals), ([mode, tone]) => {
        const grounds = Arr.append(
          Arr.map(neutralSurfaces, (surface) => neutralColor(surface, mode)),
          toneColor(tone, "surface", mode)
        )
        Arr.forEach(grounds, (ground) => {
          expect(contrast(toneColor(tone, "accent", mode), ground), `${tone} accent (${mode})`)
            .toBeGreaterThanOrEqual(graphicMinimum)
        })
      })
    }))

  it.effect("a chosen fill is at least as far from the rail it sits in as the rail is from the paper", () =>
    Effect.sync(() => {
      Arr.forEach(pairs(ColorMode.literals, Tone.literals), ([mode, tone]) => {
        const rail = neutralColor("instrument", mode)
        const railStep = contrast(rail, neutralColor("paper", mode))
        const chosen = toneColor(tone, toneSlotRole("bgTinted"), mode)
        expect(contrast(chosen, rail), `${tone} chosen fill on the rail (${mode})`).toBeGreaterThanOrEqual(railStep)
        expect(contrast(chosen, neutralColor("paper", mode)), `${tone} chosen fill on paper (${mode})`)
          .toBeGreaterThanOrEqual(railStep)
      })
    }))

  it.effect("under the pointer a slot steps deeper into its tone, never back towards the paper", () =>
    Effect.sync(() => {
      Arr.forEach(pairs(ColorMode.literals, hoverSteps), ([mode, [rest, hover]]) => {
        const deeper = deeperThan(mode)
        Arr.forEach(Tone.literals, (tone) => {
          const atRest = luminance(toneColor(tone, toneSlotRole(rest), mode))
          const underPointer = luminance(toneColor(tone, toneSlotRole(hover), mode))
          expect(deeper(underPointer, atRest), `${tone} ${hover} (${mode})`).toBe(true)
        })
        const neutralRest = luminance(neutralColor(neutralSlotRole(rest), mode))
        const neutralHover = luminance(neutralColor(neutralSlotRole(hover), mode))
        expect(deeper(neutralHover, neutralRest), `neutral ${hover} (${mode})`).toBe(true)
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
        Arr.forEach(pairs(Tone.literals, toneGrounds), ([tone, role]) => {
          expect(contrast(focus, toneColor(tone, role, mode)), `focus on ${tone} ${role} (${mode})`)
            .toBeGreaterThanOrEqual(graphicMinimum)
        })
      })
    }))

  it.effect("a tone's accent and inks read at AA on the neutral surfaces and on the tone's own surface", () =>
    Effect.sync(() => {
      Arr.forEach(pairs(ColorMode.literals, Tone.literals), ([mode, tone]) => {
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
        Arr.forEach(Tone.literals, (tone) => {
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
      Arr.forEach(pairs(ColorMode.literals, Tone.literals), ([mode, tone]) => {
        const fill = toneColor(tone, discSlotRole("bandFill"), mode)
        Arr.forEach(bandStrokes, (slot) => {
          const ratio = contrast(toneColor(tone, discSlotRole(slot), mode), fill)
          expect(ratio, `${tone} ${slot} on bandFill (${mode})`).toBeGreaterThanOrEqual(graphicMinimum)
        })
      })
    }))

  it.effect("a control at rest climbs the neutral ladder under the pointer: each rung is deeper than the last, and the step shows", () =>
    Effect.sync(() => {
      Arr.forEach(ColorMode.literals, (mode) => {
        const deeper = deeperThan(mode)
        const rungs = Arr.map(pointerRungs, (role) => neutralColor(role, mode))
        Arr.forEach(Arr.zip(rungs, Arr.drop(rungs, 1)), ([ground, step]) => {
          expect(deeper(luminance(step), luminance(ground)), mode).toBe(true)
          expect(contrast(step, ground), mode).toBeGreaterThanOrEqual(stateStepMinimum)
        })
      })
    }))

  it.effect("a tone's ladder runs from surface to ink in lightness order, and the order inverts between modes", () =>
    Effect.sync(() => {
      Arr.forEach(Tone.literals, (tone) => {
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
      Arr.forEach(pairs(Tone.literals, pairs(ToneRole.literals, translucentLevels)), ([tone, [role, level]]) => {
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

  it.effect("a slot's class is the utility for the slot in the tone's role: a recipe, not a literal per tone", () =>
    Effect.sync(() => {
      expect(toneClassesFor("primary").text).toBe("text-tone-primary-ink")
      expect(toneClassesFor("primary").bgHover).toBe("hover:bg-tone-primary-ink")
      expect(toneClassesFor("secondary").bgTintedHover).toBe("hover:bg-tone-secondary-wash")
      expect(neutralToneClasses.borderHover).toBe("hover:border-ink-secondary")
      expect(toneClassesFor("secondary").borderSubtle).toBe("border-tone-secondary-wash-veil")
      expect(toneClassesFor("tertiary").bgTinted).toBe("bg-tone-tertiary-surface")
      expect(discSlotClassName("primary", "ring")).toBe("ring-tone-primary-edge-glass")
      expect(neutralToneClasses.textStrong).toBe("text-ink")
      expect(discSlotClassName("tertiary", "bandFocusedStroke")).toBe("stroke-tone-tertiary-ink")
    }))

  it.effect("the committed palette tokens equal the palette authority's rendering", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* webRoot
      const generated = yield* fileSystem.readFileString(path.join(root, "palette-tokens.generated.css"))

      expect(generated).toBe(renderPaletteTokensCss())
    }).pipe(Effect.provide(BunContext.layer)))
})
