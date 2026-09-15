import * as LinearAlgebra from "@scenesystems/effect-math/LinearAlgebra"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Boolean as Bool, Match, Number as Num, Option, Schema, Tuple } from "effect"
import * as Arr from "effect/Array"
import * as Chunk from "effect/Chunk"

import type { Tone } from "./theme.js"

/**
 * The palette: every colour the site paints with, named for its job and
 * defined once, in OKLCH, for both modes. `scripts/generate-palette-tokens.ts`
 * renders it to `app/web/palette-tokens.generated.css`; nothing else in the
 * app holds a colour value. Contrast is a property of the contract, held by
 * `test/contracts/palette.contract.test.ts`: every ink on every surface it
 * may sit on, every accent that marks a boundary, and every syntax paint.
 *
 * One hue, and roles along it. The reference is a light blue and four teals
 * beneath it — muted teal, pine blue, pine teal, dark teal — and every colour
 * the site paints keeps to their hue. It is held as two families that meet
 * at the light blue: the brand is the teals at their own chroma, and the grey
 * is the same hue at a whisper of it, run up to a white and down to an ink
 * black. A role names what a colour does — the canvas under the page, the
 * ink of body text, the hairline between things — and is one lightness per
 * mode; its family's ramp lends it chroma and hue at that lightness, so no
 * role carries a colour of its own and a ghost white canvas, a light blue
 * hairline and an ink black heading are the one grey at three lightnesses.
 *
 * Every tone is a saturation of the brand: the three tones share one ladder
 * of roles, so a disc in `primary` and a disc in `secondary` are the same
 * lightness apart from their surfaces, and are told apart by how much of the
 * colour they carry, not by a hue of their own. The focus ring and the code's
 * paint are shades of the same two families. Danger alone is a third, because
 * an error is not a voice.
 */

export const ColorMode = Schema.Literal("light", "dark")

export type ColorMode = typeof ColorMode.Type

const Unit = Schema.Number.pipe(Schema.between(0, 1))

const Chroma = Schema.Number.pipe(Schema.nonNegative())

const Hue = Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThan(360))

/** A colour in OKLCH: perceptual lightness in `[0, 1]`, chroma, and hue in degrees. */
export class Oklch extends Schema.Class<Oklch>("Oklch")({ l: Unit, c: Chroma, h: Hue }) {}

const Channel = Schema.Number.pipe(Schema.int(), Schema.between(0, 255))

/** A colour as the browser paints it: 8-bit sRGB. */
export class Srgb extends Schema.Class<Srgb>("Srgb")({ r: Channel, g: Channel, b: Channel }) {}

// ---------------------------------------------------------------------------
// Ramps
// ---------------------------------------------------------------------------

/**
 * A ramp: the colours a family passes through, lightest first. The family's
 * colour at a lightness lies between the two stops about it — chroma and hue
 * each drawn straight from the one to the next, hue the short way round — and
 * beyond the ramp's ends it keeps the end's chroma and hue.
 */
const Ramp = Schema.NonEmptyArray(Oklch)

type Ramp = typeof Ramp.Type

const stop = (l: number, c: number, h: number): Oklch => new Oklch({ l, c, h })

const lerp = (from: number, to: number, t: number): number => Num.sum(from, Num.multiply(t, Num.subtract(to, from)))

/** The degrees from one hue to another the short way round, in `[-180, 180)`. */
const hueArc = (from: number, to: number): number =>
  Num.subtract(Num.remainder(Num.sum(Num.subtract(to, from), 540), 360), 180)

/** A hue brought back onto the circle, in `[0, 360)`. */
const turn = (hue: number): number => Num.remainder(Num.sum(hue, 360), 360)

const rampColor = (ramp: Ramp, l: number): Oklch => {
  const held = Num.clamp(l, { minimum: Arr.lastNonEmpty(ramp).l, maximum: Arr.headNonEmpty(ramp).l })
  const about = Arr.findFirst(
    Arr.zip(ramp, Arr.drop(ramp, 1)),
    ([upper, lower]) => Num.between(held, { minimum: lower.l, maximum: upper.l })
  )
  return Option.match(about, {
    onNone: () => stop(l, Arr.headNonEmpty(ramp).c, Arr.headNonEmpty(ramp).h),
    onSome: ([upper, lower]) => {
      const t = Numeric.unsafeDivide(Num.subtract(upper.l, held), Num.subtract(upper.l, lower.l))
      return stop(l, lerp(upper.c, lower.c, t), turn(Num.sum(upper.h, Num.multiply(t, hueArc(upper.h, lower.h)))))
    }
  })
}

/** The reference's colour, in OKLCH: `#BCD1D4`, `#80AAA9`, `#45847E`, `#095D53`, `#0A3639`. */
const lightBlue = stop(0.8459, 0.023, 207.1)
const mutedTeal = stop(0.7073, 0.0453, 194.3)
const pineBlue = stop(0.5695, 0.0659, 187.5)
const pineTeal = stop(0.4306, 0.0743, 182)
const darkTeal = stop(0.3056, 0.0461, 201.8)

/**
 * The grey's ends, and the stops between: the light blue's hue carried at a
 * whisper of chroma up to a white and down to an ink black, so a canvas, a
 * hairline and a heading are the one teal-cast grey and never a lavender or
 * a navy beside the colour. The ink black leans a little bluer than the dark
 * teal above it, as the reference's does.
 */
const white = stop(1, 0, 210)
const ghostWhite = stop(0.9784, 0.006, 210)
const midGrey = stop(0.55, 0.02, 205)
const duskGrey = stop(darkTeal.l, 0.03, 205)
const inkBlack = stop(0.1729, 0.028, 235)

/**
 * The three families a colour belongs to: the grey the neutrals are drawn
 * from, the brand every tone is a saturation of, and danger.
 */
export const Family = Schema.Literal("grey", "brand", "danger")

export type Family = typeof Family.Type

/** The grey: one ramp for both modes, so the dark canvas is a step above the ink black and its ink the ghost white. */
const greyRamp: Ramp = Arr.make(white, ghostWhite, lightBlue, midGrey, duskGrey, inkBlack)

/**
 * The brand on light paper is the reference's middle, from the light blue it
 * shares with the grey down to the dark teal. On dark paper the reference is
 * turned over: the same dark teal at the bottom, the colour deepest where a
 * mark must be light enough to read on the ink black, and thinning to a
 * white — the pale end bluer and the deep end greener, as the reference runs.
 */
const brandRamp = (mode: ColorMode): Ramp =>
  Match.value(mode).pipe(
    Match.when("light", () => Arr.make(lightBlue, mutedTeal, pineBlue, pineTeal, darkTeal)),
    Match.when("dark", () =>
      Arr.make(
        stop(1, 0, 207.1),
        stop(0.94, 0.022, 200),
        stop(0.83, 0.06, 190),
        stop(0.74, 0.078, 187.5),
        stop(0.55, 0.066, 187.5),
        stop(0.42, 0.05, 195),
        darkTeal
      )),
    Match.exhaustive
  )

/** Danger: a red, deep where it is a mark and where it is text on light paper, paler as text on dark. */
const dangerRamp = (mode: ColorMode): Ramp =>
  Match.value(mode).pipe(
    Match.when("light", () => Arr.make(stop(0.637, 0.2, 25), stop(0.505, 0.19, 25))),
    Match.when("dark", () => Arr.make(stop(0.808, 0.103, 25), stop(0.657, 0.19, 25))),
    Match.exhaustive
  )

const familyRamp = (family: Family, mode: ColorMode): Ramp =>
  Match.value(family).pipe(
    Match.when("grey", () => greyRamp),
    Match.when("brand", () => brandRamp(mode)),
    Match.when("danger", () => dangerRamp(mode)),
    Match.exhaustive
  )

/** The family's colour at a lightness, in a mode: what its ramp gives there. */
export const familyColor = (family: Family, mode: ColorMode, l: number): Oklch => rampColor(familyRamp(family, mode), l)

/** One role's lightness in each mode: the single definition both stylesheets derive from. */
export class Shade extends Schema.Class<Shade>("Shade")({ light: Unit, dark: Unit }) {}

const shade = (light: number, dark: number): Shade => new Shade({ light, dark })

const lightnessIn = (shade: Shade, mode: ColorMode): number =>
  Match.value(mode).pipe(
    Match.when("light", () => shade.light),
    Match.when("dark", () => shade.dark),
    Match.exhaustive
  )

const saturate = (color: Oklch, saturation: number): Oklch =>
  new Oklch({ l: color.l, c: Num.multiply(color.c, saturation), h: color.h })

/** A paint: a family, how much of its colour is carried in `[0, 1]`, and a lightness per mode. */
class Paint extends Schema.Class<Paint>("Paint")({ family: Family, saturation: Unit, shade: Shade }) {}

const paintColor = (p: Paint, mode: ColorMode): Oklch =>
  saturate(familyColor(p.family, mode, lightnessIn(p.shade, mode)), p.saturation)

/** A neutral's paint: the grey at a lightness per mode. */
const grey = (light: number, dark: number): Paint =>
  new Paint({ family: "grey", saturation: 1, shade: shade(light, dark) })

/** The brand at a saturation, at a lightness per mode. */
const brand = (saturation: number) => (light: number, dark: number): Paint =>
  new Paint({ family: "brand", saturation, shade: shade(light, dark) })

// ---------------------------------------------------------------------------
// Neutrals
// ---------------------------------------------------------------------------

/**
 * The neutral roles, from the ground up:
 *
 * - `canvas`: the page itself, under everything.
 * - `paper`: a sheet on the canvas — a card, an overlay, a dialog.
 * - `instrument`: the fill of a control at rest, and a focused line of code.
 * - `hairline`, `hairline-strong`: the rules between things, and the firmer edge of a control.
 * - `accent`: a neutral mark — a dot, an underline, a focused border — so it must hold 3:1 on every surface.
 * - `ink-tertiary` … `ink-strong`: text, from the quietest label that is still read (AA on every surface) to a heading.
 * - `emphasis`, `emphasis-hover`, `emphasis-pressed`, `on-emphasis`: a filled control, the fill under the
 *   pointer, the fill while pressed — each a step further from the ink — and its text.
 * - `focus`: the one ring every focused control wears. Focus is an affordance,
 *   so it is the same in every tone — the one colour at full saturation — and holds 3:1 on every
 *   ground a control may stand on — each neutral surface and each tone's surface, wash and edge.
 */
export const NeutralRole = Schema.Literal(
  "canvas",
  "paper",
  "instrument",
  "hairline",
  "hairline-strong",
  "accent",
  "ink-tertiary",
  "ink-secondary",
  "ink",
  "ink-strong",
  "emphasis",
  "emphasis-hover",
  "emphasis-pressed",
  "on-emphasis",
  "focus"
)

export type NeutralRole = typeof NeutralRole.Type

/**
 * The ladder, in lightness alone. On light paper it runs from the white of a
 * sheet and the ghost white of the canvas, through the light blue of the
 * rules, to an ink a step above the ink black and a heading that is the ink
 * black itself; on dark paper it is turned over — the paper the ink black,
 * the canvas and the controls a step above it, the text the whites.
 */
const paperPaint = grey(white.l, inkBlack.l)
const inkPaint = grey(0.25, 0.957)
const inkHoverPaint = grey(0.343, 0.863)

const neutralPaint = (role: NeutralRole): Paint =>
  Match.value(role).pipe(
    Match.when("canvas", () => grey(ghostWhite.l, 0.2)),
    Match.when("paper", () => paperPaint),
    Match.when("instrument", () => grey(0.957, 0.228)),
    Match.when("hairline", () => grey(0.916, 0.265)),
    Match.when("hairline-strong", () => grey(0.863, 0.31)),
    Match.when("accent", () => grey(0.63, 0.56)),
    Match.when("ink-tertiary", () => grey(0.525, 0.661)),
    Match.when("ink-secondary", () => grey(0.442, 0.775)),
    Match.when("ink", () => inkPaint),
    Match.when("ink-strong", () => grey(inkBlack.l, white.l)),
    Match.when("emphasis", () => inkPaint),
    Match.when("emphasis-hover", () => inkHoverPaint),
    Match.when("emphasis-pressed", () => grey(0.4, 0.8)),
    Match.when("on-emphasis", () => paperPaint),
    Match.when("focus", () => brand(1)(0.47, 0.82)),
    Match.exhaustive
  )

export const neutralColor = (role: NeutralRole, mode: ColorMode): Oklch => paintColor(neutralPaint(role), mode)

// ---------------------------------------------------------------------------
// Translucency
// ---------------------------------------------------------------------------

/**
 * How much of what lies under a colour shows through it. Four levels, and no
 * other alpha anywhere: a view names the level (`bg-paper-veil`), never a
 * percentage, and a lint rule holds that.
 *
 * - `solid`: the colour as it is.
 * - `veil`: a sheet that lets the page glow through — a sticky header, a chosen nav link, a control's paper.
 * - `glass`: a wash — a control lit under the pointer, a ring on a disc, a soft rule.
 * - `mist`: a tint — a chip's ground, a disabled fill, the scrim that dims the page under a sheet.
 */
export const Translucency = Schema.Literal("solid", "veil", "glass", "mist")

export type Translucency = typeof Translucency.Type

/** The alpha of a translucency, in `[0, 1]`. */
export const translucencyAlpha = (translucency: Translucency): number =>
  Match.value(translucency).pipe(
    Match.when("solid", () => 1),
    Match.when("veil", () => 0.86),
    Match.when("glass", () => 0.62),
    Match.when("mist", () => 0.38),
    Match.exhaustive
  )

/** The translucencies that are not the colour itself, and so are painted as tokens of their own. */
export const translucentLevels: ReadonlyArray<Translucency> = ["veil", "glass", "mist"]

// ---------------------------------------------------------------------------
// Tones
// ---------------------------------------------------------------------------

/**
 * The roles a tone plays, one ladder shared by the three hues:
 *
 * - `surface`: a tinted fill — a chosen pill, a chosen segment, a chip's ground — a visible step from the paper.
 * - `wash`: the fill a changed value is lit with before it settles, and a chosen fill under the pointer.
 * - `edge`: a tinted hairline.
 * - `accent-soft`: a quiet mark beside text — a dot, a muted fill.
 * - `accent`: the tone's mark — a filled track, a rule, a plotted line — so it marks a boundary (3:1) on
 *   every surface it sits on. It is never text.
 * - `ink`, `ink-strong`: the tone's text and its heading, each unmistakably the tone's and AA wherever it stands;
 *   the ink is also a filled mark deepened under the pointer.
 */
export const ToneRole = Schema.Literal("surface", "wash", "edge", "accent-soft", "accent", "ink", "ink-strong")

export type ToneRole = typeof ToneRole.Type

/**
 * The ladder, in lightness alone: the grounds nearest the paper, the marks
 * where the brand's ramp is deepest in colour — the pine blue and the pine
 * teal on light paper — and the inks a step beyond them.
 */
const toneShade = (role: ToneRole): Shade =>
  Match.value(role).pipe(
    Match.when("surface", () => shade(0.905, 0.345)),
    Match.when("wash", () => shade(0.865, 0.42)),
    Match.when("edge", () => shade(0.79, 0.49)),
    Match.when("accent-soft", () => shade(0.7, 0.55)),
    Match.when("accent", () => shade(0.555, 0.74)),
    Match.when("ink", () => shade(0.45, 0.83)),
    Match.when("ink-strong", () => shade(0.34, 0.94)),
    Match.exhaustive
  )

/** A voice: the family a tone speaks in and how much of its colour it carries, in `[0, 1]` of the ramp's chroma. */
class Voice extends Schema.Class<Voice>("Voice")({ family: Family, saturation: Unit }) {}

/**
 * Each tone's voice. The ladder's lightness is the same in every tone, so
 * every contrast the contract holds is held once for all three; a voice is
 * told from another by its saturation. The reader speaks in the brand at
 * full saturation; the neighbor in the brand muted to half; the program in
 * the neutrals' own grey, a voice with no colour of its own.
 */
export const toneVoice = (tone: Tone): Voice =>
  Match.value(tone).pipe(
    Match.when("primary", () => new Voice({ family: "brand", saturation: 1 })),
    Match.when("secondary", () => new Voice({ family: "brand", saturation: 0.5 })),
    Match.when("tertiary", () => new Voice({ family: "grey", saturation: 1 })),
    Match.exhaustive
  )

export const toneColor = (tone: Tone, role: ToneRole, mode: ColorMode): Oklch => {
  const voice = toneVoice(tone)
  return saturate(familyColor(voice.family, mode, lightnessIn(toneShade(role), mode)), voice.saturation)
}

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

/**
 * The slots a component offers to a tone — the parts of a chip, a pill, a
 * toggle, a legend entry that take the tone's colour — and, for each, the one
 * role it reads. A view never names a colour: it names the slot, and the
 * slot's role decides the colour in every tone and both modes. The neutral
 * fills the same slots from its own roles, so a component in no tone is drawn
 * by the same recipe.
 *
 * - `border`, `bg`, `dot`, `stroke`: the tone's marks — a filled track, a status dot, a plotted line.
 * - `borderHover`, `bgHover`: the filled mark's edge and fill under the pointer, a step deeper into the tone.
 * - `borderSubtle`, `bgTinted`, `wash`: the tone's quiet grounds — a chosen pill's edge and fill, a changed value's wash.
 * - `bgTintedHover`: the chosen fill under the pointer, a step deeper than at rest.
 * - `text`, `textStrong`: the tone's words and its heading; each holds AA on every surface it may stand on.
 *
 * A slot may carry its state: `bgHover` is worn as `hover:bg-…`, so a control names the slot for each state it
 * has and never composes a variant of its own.
 *
 * Focus is not a slot: every control wears the neutral `focus` ring, whatever its tone.
 */
export const ToneSlot = Schema.Literal(
  "border",
  "borderHover",
  "borderSubtle",
  "dot",
  "text",
  "textStrong",
  "stroke",
  "bg",
  "bgHover",
  "bgTinted",
  "bgTintedHover",
  "wash"
)

export type ToneSlot = typeof ToneSlot.Type

/** The slots read as text, whose roles are held to AA. */
export const toneTextSlots: ReadonlyArray<ToneSlot> = ["text", "textStrong"]

export const toneSlotRole = (slot: ToneSlot): ToneRole =>
  Match.value(slot).pipe(
    Match.withReturnType<ToneRole>(),
    Match.when("border", () => "accent"),
    Match.when("borderHover", () => "ink"),
    Match.when("borderSubtle", () => "wash"),
    Match.when("dot", () => "accent-soft"),
    Match.when("text", () => "ink"),
    Match.when("textStrong", () => "ink-strong"),
    Match.when("stroke", () => "accent"),
    Match.when("bg", () => "accent"),
    Match.when("bgHover", () => "ink"),
    Match.when("bgTinted", () => "surface"),
    Match.when("bgTintedHover", () => "wash"),
    Match.when("wash", () => "wash"),
    Match.exhaustive
  )

export const neutralSlotRole = (slot: ToneSlot): NeutralRole =>
  Match.value(slot).pipe(
    Match.withReturnType<NeutralRole>(),
    Match.when("border", () => "accent"),
    Match.when("borderHover", () => "ink-secondary"),
    Match.when("borderSubtle", () => "hairline"),
    Match.when("dot", () => "accent"),
    Match.when("text", () => "ink-secondary"),
    Match.when("textStrong", () => "ink"),
    Match.when("stroke", () => "ink-secondary"),
    Match.when("bg", () => "accent"),
    Match.when("bgHover", () => "ink-secondary"),
    Match.when("bgTinted", () => "instrument"),
    Match.when("bgTintedHover", () => "hairline"),
    Match.when("wash", () => "hairline"),
    Match.exhaustive
  )

/** The translucency a slot is painted at: a chosen pill's edge veils the paper; the rest, its fill among them, are solid, so a chosen thing is the same colour on any ground. */
export const toneSlotTranslucency = (slot: ToneSlot): Translucency =>
  Match.value(slot).pipe(
    Match.withReturnType<Translucency>(),
    Match.when("borderSubtle", () => "veil"),
    Match.whenOr(
      "border",
      "borderHover",
      "dot",
      "text",
      "textStrong",
      "stroke",
      "bg",
      "bgHover",
      "bgTinted",
      "bgTintedHover",
      "wash",
      () => "solid"
    ),
    Match.exhaustive
  )

/**
 * What a disc of the imagined place wears in its contributor's tone, on the
 * stage and in the band's miniature:
 *
 * - `ring`: the inset ring round the disc's soft fill.
 * - `actOutline`: the outline an act in view lights it with.
 * - `focusRing`: the ring it wears while the code line that placed it is under the pointer.
 * - `ghost`: the dashed edge of a declined proposal's ghost.
 * - `bandArrivingStroke`: the dashed ring the band draws while the search still makes room for it.
 * - `bandFill`, `bandStroke`, `bandFocusedStroke`: the band's flat disc, its edge, and the edge deepened under focus — each stroke a boundary (3:1) on the fill.
 */
export const DiscSlot = Schema.Literal(
  "ring",
  "actOutline",
  "focusRing",
  "ghost",
  "bandArrivingStroke",
  "bandFill",
  "bandStroke",
  "bandFocusedStroke"
)

export type DiscSlot = typeof DiscSlot.Type

export const discSlotRole = (slot: DiscSlot): ToneRole =>
  Match.value(slot).pipe(
    Match.withReturnType<ToneRole>(),
    Match.when("ring", () => "edge"),
    Match.when("actOutline", () => "accent-soft"),
    Match.when("focusRing", () => "edge"),
    Match.when("ghost", () => "accent-soft"),
    Match.when("bandArrivingStroke", () => "accent-soft"),
    Match.when("bandFill", () => "wash"),
    Match.when("bandStroke", () => "accent"),
    Match.when("bandFocusedStroke", () => "ink"),
    Match.exhaustive
  )

/** A disc's ring, act outline and ghost are glass over the disc's own fill; the band's flat paint is solid. */
export const discSlotTranslucency = (slot: DiscSlot): Translucency =>
  Match.value(slot).pipe(
    Match.withReturnType<Translucency>(),
    Match.whenOr("ring", "actOutline", "ghost", () => "glass"),
    Match.whenOr("focusRing", "bandArrivingStroke", "bandFill", "bandStroke", "bandFocusedStroke", () => "solid"),
    Match.exhaustive
  )

// ---------------------------------------------------------------------------
// Danger
// ---------------------------------------------------------------------------

/** Danger plays two roles: a mark (a status dot) and the text beside it. */
export const DangerRole = Schema.Literal("accent", "ink")

export type DangerRole = typeof DangerRole.Type

const dangerPaint = (role: DangerRole): Paint =>
  Match.value(role).pipe(
    Match.when("accent", () => new Paint({ family: "danger", saturation: 1, shade: shade(0.637, 0.657) })),
    Match.when("ink", () => new Paint({ family: "danger", saturation: 1, shade: shade(0.505, 0.808) })),
    Match.exhaustive
  )

export const dangerColor = (role: DangerRole, mode: ColorMode): Oklch => paintColor(dangerPaint(role), mode)

// ---------------------------------------------------------------------------
// Code
// ---------------------------------------------------------------------------

/** The kinds of token the highlighter paints in a colour of their own; `plain` is the ink. */
export const CodePaint = Schema.Literal("comment", "keyword", "string", "number", "type", "function", "operator")

export type CodePaint = typeof CodePaint.Type

/**
 * The brand and the grey: the language's own words — keywords deepest,
 * then the types and the functions called — in the brand at full saturation,
 * the values written into it — strings and numbers — in the brand muted to
 * half, and a comment and an operator in the neutral ink beside them.
 * Deeper on light paper, paler on dark; every kind reads at AA on paper,
 * canvas and a focused line.
 */
const codePaint = (kind: CodePaint): Paint =>
  Match.value(kind).pipe(
    Match.when("comment", () => neutralPaint("ink-tertiary")),
    Match.when("keyword", () => brand(1)(0.42, 0.8)),
    Match.when("string", () => brand(0.5)(0.48, 0.84)),
    Match.when("number", () => brand(0.5)(0.48, 0.84)),
    Match.when("type", () => brand(1)(0.5, 0.86)),
    Match.when("function", () => brand(1)(0.5, 0.86)),
    Match.when("operator", () => grey(0.442, 0.854)),
    Match.exhaustive
  )

export const codeColor = (kind: CodePaint, mode: ColorMode): Oklch => paintColor(codePaint(kind), mode)

// ---------------------------------------------------------------------------
// Shadows
// ---------------------------------------------------------------------------

/** The three depths a surface may sit at: a card, the hero's paper, a chip. */
export const ShadowRole = Schema.Literal("surface", "hero", "chip")

export type ShadowRole = typeof ShadowRole.Type

/** The shadow's geometry — offset, blur, spread — is the same in both modes. */
export const shadowGeometry = (role: ShadowRole): string =>
  Match.value(role).pipe(
    Match.when("surface", () => "0 28px 72px -54px"),
    Match.when("hero", () => "0 42px 110px -72px"),
    Match.when("chip", () => "0 16px 32px -26px"),
    Match.exhaustive
  )

/** Shadows are cast in the strongest ink on light paper and in black on dark, and deeper on dark, where the paper gives them less. */
export const shadowColor = (mode: ColorMode): Oklch =>
  Match.value(mode).pipe(
    Match.when("light", () => neutralColor("ink-strong", "light")),
    Match.when("dark", () => stop(0, 0, inkBlack.h)),
    Match.exhaustive
  )

/** The shadow's opacity, in `[0, 1]`. */
export const shadowAlpha = (role: ShadowRole, mode: ColorMode): number =>
  Match.value(mode).pipe(
    Match.when("light", () =>
      Match.value(role).pipe(
        Match.when("surface", () => 0.3),
        Match.when("hero", () => 0.34),
        Match.when("chip", () => 0.24),
        Match.exhaustive
      )),
    Match.when("dark", () =>
      Match.value(role).pipe(
        Match.when("surface", () => 0.5),
        Match.when("hero", () => 0.55),
        Match.when("chip", () => 0.4),
        Match.exhaustive
      )),
    Match.exhaustive
  )

// ---------------------------------------------------------------------------
// Place discs
// ---------------------------------------------------------------------------

const NeutralStop = Schema.TaggedStruct("Neutral", { role: NeutralRole })

const ToneStop = Schema.TaggedStruct("Tone", { role: ToneRole })

/** A stop of a disc's gradient: a neutral role, or a role of the disc's own tone. */
export const DiscStop = Schema.Union(NeutralStop, ToneStop)

export type DiscStop = typeof DiscStop.Type

/**
 * A feature on the imagined place's stage is a disc lit from the upper left:
 * three stops, highlight to rim. On light paper the highlight is the paper
 * itself; on dark the tone's edge is the brightest the disc gets.
 */
export const discStops = (mode: ColorMode): readonly [DiscStop, DiscStop, DiscStop] =>
  Match.value(mode).pipe(
    Match.when("light", () =>
      Tuple.make(
        NeutralStop.make({ role: "paper" }),
        ToneStop.make({ role: "surface" }),
        ToneStop.make({ role: "wash" })
      )),
    Match.when("dark", () =>
      Tuple.make(
        ToneStop.make({ role: "edge" }),
        ToneStop.make({ role: "wash" }),
        ToneStop.make({ role: "surface" })
      )),
    Match.exhaustive
  )

// ---------------------------------------------------------------------------
// Colour science: OKLCH → sRGB, and WCAG contrast
// ---------------------------------------------------------------------------

const radiansPerDegree = Numeric.unsafeDivide(Numeric.pi, 180)

/** OKLab coordinates `[L, a, b]` from polar OKLCH. */
const oklab = (color: Oklch): Chunk.Chunk<number> => {
  const radians = Num.multiply(color.h, radiansPerDegree)
  return Chunk.make(color.l, Num.multiply(color.c, Numeric.cos(radians)), Num.multiply(color.c, Numeric.sin(radians)))
}

/** OKLab → non-linear LMS (row-major 3×3), from Björn Ottosson's definition of the space. */
const oklabToLms = Chunk.make(
  1,
  0.3963377774,
  0.2158037573,
  1,
  -0.1055613458,
  -0.0638541728,
  1,
  -0.0894841775,
  -1.291485548
)

/** Linear LMS → linear-light sRGB (row-major 3×3). */
const lmsToLinearSrgb = Chunk.make(
  4.0767416621,
  -3.3077115913,
  0.2309699292,
  -1.2684380046,
  2.6097574011,
  -0.3413193965,
  -0.0041960863,
  -0.7034186147,
  1.707614701
)

/**
 * The colour's linear-light sRGB components `[r, g, b]`, unbounded: a component
 * outside `[0, 1]` means the colour lies outside the sRGB gamut, and a browser
 * would paint something else.
 */
export const linearSrgb = (color: Oklch): Chunk.Chunk<number> =>
  LinearAlgebra.matvec(
    lmsToLinearSrgb,
    3,
    3,
    Chunk.map(LinearAlgebra.matvec(oklabToLms, 3, 3, oklab(color)), (component) => Numeric.pow(component, 3))
  )

/** A hair of tolerance for the arithmetic, so a colour on the gamut's face is inside it. */
const gamutTolerance = 1e-6

export const inSrgbGamut = (color: Oklch): boolean =>
  Chunk.every(linearSrgb(color), Numeric.between({ minimum: -gamutTolerance, maximum: 1 + gamutTolerance }))

/** The sRGB transfer function: linear light to the encoded component. */
const encodeComponent = (linear: number): number =>
  Bool.match(Num.lessThanOrEqualTo(linear, 0.0031308), {
    onTrue: () => Num.multiply(linear, 12.92),
    onFalse: () => Num.subtract(Num.multiply(1.055, Numeric.pow(linear, Numeric.unsafeDivide(1, 2.4))), 0.055)
  })

/** Its inverse: an encoded component back to linear light. */
const decodeComponent = (encoded: number): number =>
  Bool.match(Num.lessThanOrEqualTo(encoded, 0.04045), {
    onTrue: () => Numeric.unsafeDivide(encoded, 12.92),
    onFalse: () => Numeric.pow(Numeric.unsafeDivide(Num.sum(encoded, 0.055), 1.055), 2.4)
  })

const toChannel = (linear: number): number =>
  Num.round(Num.multiply(Num.clamp(encodeComponent(linear), { minimum: 0, maximum: 1 }), 255), 0)

/** The colour as the browser paints it: clipped to the gamut and quantised to 8 bits. */
export const toSrgb = (color: Oklch): Srgb => {
  const channels = Chunk.map(linearSrgb(color), toChannel)
  return new Srgb({
    r: Chunk.unsafeGet(channels, 0),
    g: Chunk.unsafeGet(channels, 1),
    b: Chunk.unsafeGet(channels, 2)
  })
}

const luminanceWeights = Chunk.make(0.2126, 0.7152, 0.0722)

/** WCAG relative luminance of a painted colour. */
export const paintedLuminance = (painted: Srgb): number =>
  LinearAlgebra.dot(
    luminanceWeights,
    Chunk.map(
      Chunk.make(painted.r, painted.g, painted.b),
      (channel) => decodeComponent(Numeric.unsafeDivide(channel, 255))
    )
  )

/**
 * WCAG relative luminance of the colour as painted: from the quantised sRGB,
 * not the OKLCH, so the ratio is the one a reader's screen shows.
 */
export const luminance = (color: Oklch): number => paintedLuminance(toSrgb(color))

/** WCAG 2.x contrast ratio between two painted colours, in `[1, 21]`. */
export const paintedContrast = (a: Srgb, b: Srgb): number => {
  const ya = paintedLuminance(a)
  const yb = paintedLuminance(b)
  return Numeric.unsafeDivide(Num.sum(Num.max(ya, yb), 0.05), Num.sum(Num.min(ya, yb), 0.05))
}

/** WCAG 2.x contrast ratio between two colours, in `[1, 21]`. */
export const contrast = (a: Oklch, b: Oklch): number => paintedContrast(toSrgb(a), toSrgb(b))

const blendChannel = (alpha: number) => (over: number, under: number): number =>
  Num.round(Num.sum(Num.multiply(alpha, over), Num.multiply(Num.subtract(1, alpha), under)), 0)

/**
 * What the browser paints where a translucent colour lies over a ground: the
 * two blended channel by channel in encoded sRGB, as CSS composites a
 * background over what is under it. A solid colour is itself.
 */
export const composite = (over: Oklch, translucency: Translucency, under: Oklch): Srgb => {
  const top = toSrgb(over)
  const ground = toSrgb(under)
  const blend = blendChannel(translucencyAlpha(translucency))
  return new Srgb({ r: blend(top.r, ground.r), g: blend(top.g, ground.g), b: blend(top.b, ground.b) })
}
