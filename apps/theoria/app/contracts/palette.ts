import * as LinearAlgebra from "@scenesystems/effect-math/LinearAlgebra"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Boolean as Bool, Match, Number as Num, Schema, Tuple } from "effect"
import * as Chunk from "effect/Chunk"

import type { CardTone } from "./theme.js"

/**
 * The palette: every colour the site paints with, named for its job and
 * defined once, in OKLCH, for both modes. `scripts/generate-palette-tokens.ts`
 * renders it to `app/web/palette-tokens.generated.css`; nothing else in the
 * app holds a colour value. Contrast is a property of the contract, held by
 * `test/contracts/palette.contract.test.ts`: every ink on every surface it
 * may sit on, every accent that marks a boundary, and every syntax paint.
 *
 * Roles, not ramps. A role names what a colour does — the canvas under the
 * page, the ink of body text, the hairline between things — and each role is
 * one lightness and chroma per mode at its family's hue. The seven tones share
 * one ladder of roles at seven hues, so a chip in `math` and a chip in `seal`
 * are the same lightness apart from their surfaces, and read the same.
 */

export const ColorMode = Schema.Literal("light", "dark")

export type ColorMode = typeof ColorMode.Type

const Unit = Schema.Number.pipe(Schema.between(0, 1))

const Chroma = Schema.Number.pipe(Schema.nonNegative())

const Hue = Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThan(360))

/** A colour in OKLCH: perceptual lightness in `[0, 1]`, chroma, and hue in degrees. */
export class Oklch extends Schema.Class<Oklch>("Oklch")({ l: Unit, c: Chroma, h: Hue }) {}

/** A lightness and chroma, before a family lends its hue. */
export class Tint extends Schema.Class<Tint>("Tint")({ l: Unit, c: Chroma }) {}

/** One role's tint in each mode: the single definition both stylesheets derive from. */
export class Shade extends Schema.Class<Shade>("Shade")({ light: Tint, dark: Tint }) {}

const Channel = Schema.Number.pipe(Schema.int(), Schema.between(0, 255))

/** A colour as the browser paints it: 8-bit sRGB. */
export class Srgb extends Schema.Class<Srgb>("Srgb")({ r: Channel, g: Channel, b: Channel }) {}

const tint = (l: number, c: number): Tint => new Tint({ l, c })

const shade = (light: Tint, dark: Tint): Shade => new Shade({ light, dark })

const tintIn = (shade: Shade, mode: ColorMode): Tint =>
  Match.value(mode).pipe(
    Match.when("light", () => shade.light),
    Match.when("dark", () => shade.dark),
    Match.exhaustive
  )

const at = (hue: number, tint: Tint): Oklch => new Oklch({ l: tint.l, c: tint.c, h: hue })

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
 * - `emphasis`, `emphasis-hover`, `on-emphasis`: a filled control, the fill under the pointer, and its text.
 * - `focus`: the one ring every focused control wears. Focus is an affordance,
 *   not a brand accent, so it is the same in every tone and holds 3:1 on every
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
  "on-emphasis",
  "focus"
)

export type NeutralRole = typeof NeutralRole.Type

/** The cool grey every neutral is tinted towards, so paper and ink belong to one light. */
export const neutralHue = 260

const paperShade = shade(tint(1, 0), tint(0.19, 0.041))
const inkShade = shade(tint(0.257, 0.045), tint(0.957, 0.009))
const inkHoverShade = shade(tint(0.343, 0.045), tint(0.863, 0.025))

const neutralShade = (role: NeutralRole): Shade =>
  Match.value(role).pipe(
    Match.when("canvas", () => shade(tint(0.976, 0.006), tint(0.22, 0.046))),
    Match.when("paper", () => paperShade),
    Match.when("instrument", () => shade(tint(0.957, 0.009), tint(0.247, 0.049))),
    Match.when("hairline", () => shade(tint(0.916, 0.016), tint(0.284, 0.053))),
    Match.when("hairline-strong", () => shade(tint(0.863, 0.025), tint(0.329, 0.052))),
    Match.when("accent", () => shade(tint(0.63, 0.036), tint(0.56, 0.045))),
    Match.when("ink-tertiary", () => shade(tint(0.525, 0.04), tint(0.661, 0.038))),
    Match.when("ink-secondary", () => shade(tint(0.442, 0.043), tint(0.775, 0.034))),
    Match.when("ink", () => inkShade),
    Match.when("ink-strong", () => shade(tint(0.19, 0.041), tint(1, 0))),
    Match.when("emphasis", () => inkShade),
    Match.when("emphasis-hover", () => inkHoverShade),
    Match.when("on-emphasis", () => paperShade),
    Match.when("focus", () => shade(tint(0.47, 0.14), tint(0.82, 0.09))),
    Match.exhaustive
  )

export const neutralColor = (role: NeutralRole, mode: ColorMode): Oklch =>
  at(neutralHue, tintIn(neutralShade(role), mode))

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
 * The roles a tone plays, one ladder shared by all seven hues:
 *
 * - `surface`: a tinted fill — a chip, a card's wash.
 * - `wash`: the fill a changed value is lit with before it settles.
 * - `edge`: a tinted hairline.
 * - `accent-soft`: a quiet mark beside text — a dot, a muted fill.
 * - `accent`: the tone's mark and its quiet text, so it holds AA on every surface it sits on.
 * - `ink`, `ink-strong`: the tone's text, and its heading.
 */
export const ToneRole = Schema.Literal("surface", "wash", "edge", "accent-soft", "accent", "ink", "ink-strong")

export type ToneRole = typeof ToneRole.Type

const toneShade = (role: ToneRole): Shade =>
  Match.value(role).pipe(
    Match.when("surface", () => shade(tint(0.957, 0.015), tint(0.345, 0.05))),
    Match.when("wash", () => shade(tint(0.905, 0.03), tint(0.42, 0.057))),
    Match.when("edge", () => shade(tint(0.83, 0.05), tint(0.49, 0.066))),
    Match.when("accent-soft", () => shade(tint(0.72, 0.065), tint(0.53, 0.07))),
    Match.when("accent", () => shade(tint(0.52, 0.075), tint(0.74, 0.07))),
    Match.when("ink", () => shade(tint(0.47, 0.06), tint(0.83, 0.055))),
    Match.when("ink-strong", () => shade(tint(0.345, 0.045), tint(0.958, 0.018))),
    Match.exhaustive
  )

/** Each tone's hue: the blue of text, the tan of search, the green of math, the mauve of dsp, the teal of digest, the amber of sign, the violet of seal. */
export const toneHue = (tone: CardTone): number =>
  Match.value(tone).pipe(
    Match.when("text", () => 260),
    Match.when("search", () => 80),
    Match.when("math", () => 162),
    Match.when("dsp", () => 345),
    Match.when("digest", () => 196),
    Match.when("sign", () => 70),
    Match.when("seal", () => 293),
    Match.exhaustive
  )

export const toneColor = (tone: CardTone, role: ToneRole, mode: ColorMode): Oklch =>
  at(toneHue(tone), tintIn(toneShade(role), mode))

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
 * - `borderSubtle`, `bgTinted`, `wash`: the tone's quiet grounds — a chosen pill's edge and fill, a changed value's wash.
 * - `text`, `textStrong`: the tone's words and its heading; each holds AA on every surface it may stand on.
 *
 * Focus is not a slot: every control wears the neutral `focus` ring, whatever its tone.
 */
export const ToneSlot = Schema.Literal(
  "border",
  "borderSubtle",
  "dot",
  "text",
  "textStrong",
  "stroke",
  "bg",
  "bgTinted",
  "wash"
)

export type ToneSlot = typeof ToneSlot.Type

/** The slots read as text, whose roles are held to AA. */
export const toneTextSlots: ReadonlyArray<ToneSlot> = ["text", "textStrong"]

export const toneSlotRole = (slot: ToneSlot): ToneRole =>
  Match.value(slot).pipe(
    Match.withReturnType<ToneRole>(),
    Match.when("border", () => "accent"),
    Match.when("borderSubtle", () => "wash"),
    Match.when("dot", () => "accent-soft"),
    Match.when("text", () => "ink"),
    Match.when("textStrong", () => "ink-strong"),
    Match.when("stroke", () => "accent"),
    Match.when("bg", () => "accent"),
    Match.when("bgTinted", () => "surface"),
    Match.when("wash", () => "wash"),
    Match.exhaustive
  )

export const neutralSlotRole = (slot: ToneSlot): NeutralRole =>
  Match.value(slot).pipe(
    Match.withReturnType<NeutralRole>(),
    Match.when("border", () => "accent"),
    Match.when("borderSubtle", () => "hairline"),
    Match.when("dot", () => "accent"),
    Match.when("text", () => "ink-secondary"),
    Match.when("textStrong", () => "ink"),
    Match.when("stroke", () => "ink-secondary"),
    Match.when("bg", () => "accent"),
    Match.when("bgTinted", () => "instrument"),
    Match.when("wash", () => "hairline"),
    Match.exhaustive
  )

/** The translucency a slot is painted at: a chosen pill's edge veils the paper, its fill is a mist of the tone; the rest are solid. */
export const toneSlotTranslucency = (slot: ToneSlot): Translucency =>
  Match.value(slot).pipe(
    Match.withReturnType<Translucency>(),
    Match.when("borderSubtle", () => "veil"),
    Match.when("bgTinted", () => "mist"),
    Match.whenOr("border", "dot", "text", "textStrong", "stroke", "bg", "wash", () => "solid"),
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

const dangerHue = 25

const dangerShade = (role: DangerRole): Shade =>
  Match.value(role).pipe(
    Match.when("accent", () => shade(tint(0.637, 0.2), tint(0.657, 0.19))),
    Match.when("ink", () => shade(tint(0.505, 0.19), tint(0.808, 0.103))),
    Match.exhaustive
  )

export const dangerColor = (role: DangerRole, mode: ColorMode): Oklch => at(dangerHue, tintIn(dangerShade(role), mode))

// ---------------------------------------------------------------------------
// Code
// ---------------------------------------------------------------------------

/** The kinds of token the highlighter paints in a colour of their own; `plain` is the ink. */
export const CodePaint = Schema.Literal("comment", "keyword", "string", "number", "type", "function", "operator")

export type CodePaint = typeof CodePaint.Type

class Paint extends Schema.Class<Paint>("Paint")({ hue: Hue, shade: Shade }) {}

const paint = (hue: number, light: Tint, dark: Tint): Paint => new Paint({ hue, shade: shade(light, dark) })

/** Saturated on light paper, pastel on dark; every kind reads at AA on paper, canvas and a focused line. */
const codePaint = (kind: CodePaint): Paint =>
  Match.value(kind).pipe(
    Match.when("comment", () => paint(259, tint(0.525, 0.045), tint(0.652, 0.047))),
    Match.when("keyword", () => paint(265, tint(0.472, 0.108), tint(0.782, 0.105))),
    Match.when("string", () => paint(161, tint(0.5, 0.098), tint(0.831, 0.072))),
    Match.when("number", () => paint(79, tint(0.5, 0.1), tint(0.849, 0.087))),
    Match.when("type", () => paint(303, tint(0.52, 0.114), tint(0.83, 0.061))),
    Match.when("function", () => paint(245, tint(0.472, 0.097), tint(0.81, 0.086))),
    Match.when("operator", () => paint(256, tint(0.442, 0.043), tint(0.854, 0.041))),
    Match.exhaustive
  )

export const codeColor = (kind: CodePaint, mode: ColorMode): Oklch => {
  const p = codePaint(kind)
  return at(p.hue, tintIn(p.shade, mode))
}

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
    Match.when("dark", () => new Oklch({ l: 0, c: 0, h: neutralHue })),
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
