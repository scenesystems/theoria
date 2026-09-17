import { createFontStack } from "@capsizecss/core"
import arial from "@capsizecss/metrics/arial"
import courierNew from "@capsizecss/metrics/courierNew"
import figtree from "@capsizecss/metrics/figtree"
import geistMono from "@capsizecss/metrics/geistMono"
import helveticaNeue from "@capsizecss/metrics/helveticaNeue"
import notoSans from "@capsizecss/metrics/notoSans"
import notoSansMono from "@capsizecss/metrics/notoSansMono"
import roboto from "@capsizecss/metrics/roboto"
import robotoMono from "@capsizecss/metrics/robotoMono"
import segoeUI from "@capsizecss/metrics/segoeUI"
import * as Text from "@scenesystems/effect-text/Text"
import { Match, Number as Num, Option, Schema, String as Str, Tuple } from "effect"
import * as Arr from "effect/Array"
import * as HashMap from "effect/HashMap"
import * as Record from "effect/Record"

import { type SurfaceVariant, SurfaceVariant as SurfaceVariantSchema } from "./presentation.js"

const PositiveWidth = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThan(0)
)

const PositiveLineHeight = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThan(0)
)

export const FontWeight = Schema.Literal("normal", "medium", "semibold", "bold")

export type FontWeight = typeof FontWeight.Type

export const FontFamily = Schema.Literal("body", "display", "mono")

export type FontFamily = typeof FontFamily.Type

/**
 * The two typefaces this site serves, named as the Fontsource variable
 * packages that supply them name their faces, and the system fonts that stand
 * in for each until it arrives. A stand-in is not named as itself: Capsize
 * writes it a `@font-face` alias whose `size-adjust`, `ascent-override` and
 * `descent-override` scale it to the served face's proportions, from the two
 * fonts' metric tables, so text set in the stand-in takes the same lines and
 * the same height, and the swap moves nothing.
 */
const Typeface = Schema.Literal("sans", "mono")
type Typeface = typeof Typeface.Type

const typefaceOf = (family: FontFamily): Typeface =>
  Match.value(family).pipe(
    Match.when("body", (): Typeface => "sans"),
    Match.when("display", (): Typeface => "sans"),
    Match.when("mono", (): Typeface => "mono"),
    Match.exhaustive
  )

const servedFaces = HashMap.make(
  Tuple.make("sans", { ...figtree, familyName: "Figtree Variable" }),
  Tuple.make("mono", { ...geistMono, familyName: "Geist Mono Variable" })
)

/**
 * The Liberation fonts are the metric clones of Arial and Courier New that
 * Linux desktops and continuous-integration images carry in their place: the
 * same advances and vertical metrics by design, so Arial's tables describe
 * them, and they are matched under their own names.
 */
const liberationSans = {
  ...arial,
  familyName: "Liberation Sans",
  fullName: "Liberation Sans",
  postscriptName: "LiberationSans"
}
const liberationMono = {
  ...courierNew,
  familyName: "Liberation Mono",
  fullName: "Liberation Mono",
  postscriptName: "LiberationMono"
}

const standIns = HashMap.make(
  Tuple.make("sans", Arr.make(segoeUI, helveticaNeue, arial, liberationSans, roboto, notoSans)),
  Tuple.make("mono", Arr.make(courierNew, liberationMono, robotoMono, notoSansMono))
)

const genericFamily = (typeface: Typeface): string =>
  Match.value(typeface).pipe(
    Match.when("sans", () => "sans-serif"),
    Match.when("mono", () => "monospace"),
    Match.exhaustive
  )

/** A system font that stands in for a served face, under the alias whose `@font-face` matches its metrics. */
export const TypefaceFallback = Schema.Struct({ alias: Schema.String, standIn: Schema.String })
export type TypefaceFallback = typeof TypefaceFallback.Type

const fontStack = (typeface: Typeface) =>
  createFontStack(
    Arr.prepend(HashMap.unsafeGet(standIns, typeface), HashMap.unsafeGet(servedFaces, typeface))
  )

const fontStacks = HashMap.make(
  Tuple.make("sans", fontStack("sans")),
  Tuple.make("mono", fontStack("mono"))
)

/** The face a family is served in, by the name its `@font-face` rules declare. */
export const servedFontFamily = (family: FontFamily): string =>
  HashMap.unsafeGet(servedFaces, typefaceOf(family)).familyName

const TypefaceFallbacks = Schema.Array(TypefaceFallback)

export const typefaceFallbacks = (family: FontFamily): typeof TypefaceFallbacks.Type =>
  Arr.map(HashMap.unsafeGet(standIns, typefaceOf(family)), (standIn) =>
    TypefaceFallback.make({
      alias: Str.concat(servedFontFamily(family), Str.concat(" Fallback: ", standIn.familyName)),
      standIn: standIn.familyName
    }))

/** The `@font-face` rules that scale every stand-in to the face it stands in for. */
export const typefaceFallbackFaces: string = Arr.join(
  Arr.map(Typeface.literals, (typeface) => HashMap.unsafeGet(fontStacks, typeface).fontFaces),
  "\n"
)

/**
 * The font the layout engine asks the document about before it measures a
 * family: the served face at its normal weight and the root size. In hand, the
 * layout measures in it; in flight, the layout measures in the stand-in the
 * page shows and watches for this face to land, when it is built again in it
 * — so no width the stand-in gave outlives the face that gave it.
 */
export const measuredFont = (family: FontFamily): string =>
  Str.concat("400 16px \"", Str.concat(servedFontFamily(family), "\""))

const fontFamilyStacks = HashMap.fromIterable(
  Arr.map(FontFamily.literals, (family) =>
    Tuple.make(
      family,
      Str.concat(
        HashMap.unsafeGet(fontStacks, typefaceOf(family)).fontFamily,
        Str.concat(", ", genericFamily(typefaceOf(family)))
      )
    ))
)

const fontFamilyVarNames = HashMap.make(
  Tuple.make("body", "var(--font-body)"),
  Tuple.make("display", "var(--font-display)"),
  Tuple.make("mono", "var(--font-mono)")
)

const fontWeightValues = HashMap.make(
  Tuple.make("normal", 400),
  Tuple.make("medium", 500),
  Tuple.make("semibold", 600),
  Tuple.make("bold", 700)
)

export const fontFamilyCss = (family: FontFamily): string => HashMap.unsafeGet(fontFamilyStacks, family)

export const fontFamilyCssVar = (family: FontFamily): string => HashMap.unsafeGet(fontFamilyVarNames, family)

export const fontWeightNumeric = (weight: FontWeight): number => HashMap.unsafeGet(fontWeightValues, weight)

const FontFamilyThemeTokens = Schema.Array(Schema.Tuple(Schema.String, Schema.String))

export const fontFamilyThemeTokens: typeof FontFamilyThemeTokens.Type = Arr.map(
  HashMap.toEntries(fontFamilyStacks),
  ([family, stack]) => Tuple.make(Str.concat("--font-", family), stack)
)

export const TextRole = Schema.Literal(
  "display",
  "lead",
  "hero-title",
  "subsection-title",
  "body",
  "stage-prose",
  "caption",
  "selection-title",
  "section-title",
  "package-title",
  "row-label",
  "row-value",
  "code-meta",
  "code-block",
  "button-label",
  "marker-label",
  "wordmark"
)

export type TextRole = typeof TextRole.Type

/** A measure for every surface variant: a variant added to `SurfaceVariant` is a width owed by every role. */
export const VariantMaxWidth = Schema.Record({ key: SurfaceVariantSchema, value: PositiveWidth })

export type VariantMaxWidth = typeof VariantMaxWidth.Type

export const LineBreakBehavior = Schema.Literal("wrap", "nowrap")

export type LineBreakBehavior = typeof LineBreakBehavior.Type

export const TextWrapAuthority = Schema.Literal("native-browser", "effect-text-projected")

export type TextWrapAuthority = typeof TextWrapAuthority.Type

/** A length that follows the viewport's width between two bounds: `clamp(min, vw, max)`. */
export const FluidSize = Schema.Struct({
  min: PositiveWidth,
  vw: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0)),
  max: PositiveWidth
})
export type FluidSize = typeof FluidSize.Type

export const FontSize = Schema.Union(Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0)), FluidSize)
export type FontSize = typeof FontSize.Type

/** Leading, fixed or fluid: a fluid size wants fluid leading beside it, or the ratio between them drifts. */
export const LineHeight = Schema.Union(PositiveLineHeight, FluidSize)
export type LineHeight = typeof LineHeight.Type

/**
 * A role's metrics at a viewport. Fluid metrics are for roles the browser
 * wraps: the text layout engine flows projected roles from the base metrics,
 * which are fixed, and the typography contract test holds that apart.
 */
export const Metrics = Schema.Struct({ fontSize: FontSize, lineHeight: LineHeight })
export type Metrics = typeof Metrics.Type

export const Viewport = Schema.Literal("narrow", "wide")
export type Viewport = typeof Viewport.Type

const Viewports = Schema.Array(Viewport)

export const viewports: typeof Viewports.Type = Viewport.literals

/** The media condition under which a viewport's metrics apply. */
export const viewportCondition = (viewport: Viewport): string =>
  Match.value(viewport).pipe(
    Match.when("narrow", () => "(width < 40rem)"),
    Match.when("wide", () => "(width >= 64rem)"),
    Match.exhaustive
  )

export const ResponsiveMetrics = Schema.Struct({
  narrow: Schema.optional(Metrics),
  wide: Schema.optional(Metrics)
})
export type ResponsiveMetrics = typeof ResponsiveMetrics.Type

/** Prose owns its ink; labels inside controls and measured marks inherit their owner's state. */
export const TextForeground = Schema.Literal("inherit", "ink-strong", "ink", "ink-secondary", "ink-tertiary")
export type TextForeground = typeof TextForeground.Type

export const TextTransform = Schema.Literal("none", "uppercase")
export type TextTransform = typeof TextTransform.Type

export const TextSemantics = Schema.Struct({
  role: TextRole,
  family: FontFamily,
  fontSize: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0)),
  weight: FontWeight,
  tracking: Schema.Number.pipe(Schema.finite()),
  foreground: TextForeground,
  transform: TextTransform,
  wrapAuthority: TextWrapAuthority,
  lineBreaks: LineBreakBehavior,
  whiteSpace: Text.Whitespace,
  lineHeight: PositiveLineHeight,
  maxWidth: VariantMaxWidth,
  at: ResponsiveMetrics
})

export type TextSemantics = typeof TextSemantics.Type

const TextSemanticsByRole = Schema.Record({ key: TextRole, value: TextSemantics })

type TextSemanticsByRole = typeof TextSemanticsByRole.Type

const TextSemanticsCollection = Schema.Array(TextSemantics)

export const fontDescriptorFor = (semantics: TextSemantics): Text.Font => ({
  family: fontFamilyCss(semantics.family),
  size: semantics.fontSize,
  weight: fontWeightNumeric(semantics.weight)
})

export const textSemanticsByRole: TextSemanticsByRole = {
  display: {
    role: "display",
    family: "display",
    fontSize: 44,
    weight: "semibold",
    tracking: Num.negate(0.02),
    foreground: "ink-strong",
    transform: "none",
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 50,
    maxWidth: { compact: 720, expanded: 1040 },
    // Narrow: 32/36 at 320 rising to 36/40 by 360, so a five-line title still leaves a 568 px fold room
    // for the hero's actions; the same 1.11 ratio at both ends.
    at: {
      narrow: { fontSize: { min: 32, vw: 10, max: 36 }, lineHeight: { min: 36, vw: 11.25, max: 40 } },
      wide: { fontSize: 64, lineHeight: 68 }
    }
  },
  lead: {
    role: "lead",
    family: "body",
    fontSize: 18,
    weight: "normal",
    tracking: 0,
    foreground: "ink-secondary",
    transform: "none",
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 28,
    maxWidth: { compact: 600, expanded: 720 },
    at: { narrow: { fontSize: 17, lineHeight: 26 } }
  },
  "hero-title": {
    role: "hero-title",
    family: "display",
    fontSize: 38,
    weight: "semibold",
    tracking: Num.negate(0.02),
    foreground: "ink-strong",
    transform: "none",
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 44,
    maxWidth: { compact: 680, expanded: 920 },
    at: { narrow: { fontSize: 32, lineHeight: 38 } }
  },
  "subsection-title": {
    role: "subsection-title",
    family: "display",
    fontSize: 20,
    weight: "semibold",
    tracking: 0,
    foreground: "ink-strong",
    transform: "none",
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 28,
    maxWidth: { compact: 520, expanded: 1120 },
    at: {}
  },
  body: {
    role: "body",
    family: "body",
    fontSize: 16,
    weight: "normal",
    tracking: 0,
    foreground: "ink",
    transform: "none",
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 26,
    maxWidth: { compact: 720, expanded: 1400 },
    at: {}
  },
  "stage-prose": {
    role: "stage-prose",
    family: "body",
    fontSize: 16,
    weight: "normal",
    tracking: 0,
    foreground: "inherit",
    transform: "none",
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 26,
    maxWidth: { compact: 720, expanded: 1400 },
    at: {}
  },
  caption: {
    role: "caption",
    family: "body",
    fontSize: 12,
    weight: "normal",
    tracking: 0,
    foreground: "ink-tertiary",
    transform: "none",
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 18,
    maxWidth: { compact: 760, expanded: 1400 },
    at: {}
  },
  "selection-title": {
    role: "selection-title",
    family: "display",
    fontSize: 14,
    weight: "semibold",
    tracking: 0,
    foreground: "ink-strong",
    transform: "none",
    wrapAuthority: "native-browser",
    lineBreaks: "nowrap",
    whiteSpace: "normal",
    lineHeight: 20,
    maxWidth: { compact: 900, expanded: 1400 },
    at: {}
  },
  "section-title": {
    role: "section-title",
    family: "display",
    fontSize: 24,
    weight: "semibold",
    tracking: Num.negate(0.01),
    foreground: "ink-strong",
    transform: "none",
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 32,
    maxWidth: { compact: 900, expanded: 1400 },
    at: { narrow: { fontSize: 21, lineHeight: 28 } }
  },
  // Package identifiers stay intact. The card grid preserves their desktop measure; on a
  // narrow viewport every title scales together rather than shrinking individual names.
  "package-title": {
    role: "package-title",
    family: "display",
    fontSize: 24,
    weight: "semibold",
    tracking: Num.negate(0.01),
    foreground: "ink-strong",
    transform: "none",
    wrapAuthority: "native-browser",
    lineBreaks: "nowrap",
    whiteSpace: "normal",
    lineHeight: 32,
    maxWidth: { compact: 900, expanded: 1400 },
    at: {
      narrow: { fontSize: { min: 16, vw: 5, max: 24 }, lineHeight: { min: 22, vw: 6.875, max: 32 } }
    }
  },
  "row-label": {
    role: "row-label",
    family: "body",
    fontSize: 11,
    weight: "semibold",
    tracking: 0.04,
    foreground: "ink-tertiary",
    transform: "uppercase",
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 16,
    maxWidth: { compact: 360, expanded: 680 },
    at: {}
  },
  "row-value": {
    role: "row-value",
    family: "body",
    fontSize: 14,
    weight: "normal",
    tracking: 0,
    foreground: "inherit",
    transform: "none",
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 22,
    maxWidth: { compact: 760, expanded: 1400 },
    at: {}
  },
  "code-meta": {
    role: "code-meta",
    family: "mono",
    fontSize: 12,
    weight: "normal",
    tracking: 0,
    foreground: "inherit",
    transform: "none",
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 18,
    maxWidth: { compact: 900, expanded: 1400 },
    at: {}
  },
  "code-block": {
    role: "code-block",
    family: "mono",
    fontSize: 12,
    weight: "normal",
    tracking: 0,
    foreground: "inherit",
    transform: "none",
    wrapAuthority: "effect-text-projected",
    lineBreaks: "wrap",
    whiteSpace: "pre-wrap",
    lineHeight: 18,
    maxWidth: { compact: 900, expanded: 1800 },
    at: {}
  },
  "button-label": {
    role: "button-label",
    family: "body",
    fontSize: 12,
    weight: "semibold",
    tracking: 0.02,
    foreground: "inherit",
    transform: "none",
    wrapAuthority: "native-browser",
    lineBreaks: "nowrap",
    whiteSpace: "normal",
    lineHeight: 16,
    maxWidth: { compact: 170, expanded: 210 },
    at: {}
  },
  "marker-label": {
    role: "marker-label",
    family: "body",
    fontSize: 12,
    weight: "semibold",
    // The label is clipped to its measured fit; the measurer sees no tracking, so the label paints none.
    tracking: 0,
    foreground: "inherit",
    transform: "none",
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 14,
    maxWidth: { compact: 160, expanded: 200 },
    at: {}
  },
  // The lockup is identical in both headers and the footer; its inline segments retain natural shaping.
  wordmark: {
    role: "wordmark",
    family: "display",
    fontSize: 24,
    weight: "semibold",
    tracking: Num.negate(0.025),
    foreground: "ink",
    transform: "none",
    wrapAuthority: "native-browser",
    lineBreaks: "nowrap",
    whiteSpace: "normal",
    lineHeight: 32,
    maxWidth: { compact: 180, expanded: 180 },
    at: {}
  }
}

export const textSemantics: typeof TextSemanticsCollection.Type = Record.values(textSemanticsByRole)

export const semanticsFor = (role: TextRole): TextSemantics => textSemanticsByRole[role]

/** The metrics a role takes at a viewport instead of its own, if it has any. */
export const metricsOverride = (semantics: TextSemantics, viewport: Viewport): Option.Option<Metrics> =>
  Option.fromNullable(semantics.at[viewport])

/** A role's size and leading, base or at a viewport that overrides them. */
export const metricsAt = (role: TextRole, viewport: Option.Option<Viewport>): Metrics => {
  const semantics = semanticsFor(role)
  const base = Metrics.make({ fontSize: semantics.fontSize, lineHeight: semantics.lineHeight })
  return Option.match(viewport, {
    onNone: () => base,
    onSome: (at) => Option.getOrElse(metricsOverride(semantics, at), () => base)
  })
}

/** The CSS for a length: fixed pixels, or fluid between its bounds. */
const lengthCss = (length: FontSize): string =>
  Match.value(length).pipe(
    Match.when(Schema.is(FluidSize), (fluid) =>
      Arr.join(
        Arr.make(
          "clamp(",
          Schema.encodeSync(Schema.NumberFromString)(fluid.min),
          "px, ",
          Schema.encodeSync(Schema.NumberFromString)(fluid.vw),
          "vw, ",
          Schema.encodeSync(Schema.NumberFromString)(fluid.max),
          "px)"
        ),
        ""
      )),
    Match.when(
      Schema.is(Schema.Number),
      (fixed) => Str.concat(Schema.encodeSync(Schema.NumberFromString)(fixed), "px")
    ),
    Match.exhaustive
  )

export const fontSizeCss = (size: FontSize): string => lengthCss(size)

export const lineHeightCss = (leading: LineHeight): string => lengthCss(leading)

export const maxWidthFor = (role: TextRole, variant: SurfaceVariant): number =>
  textSemanticsByRole[role].maxWidth[variant]

export const prepareInputFor = (role: TextRole, text: string): Text.Input => ({
  text,
  font: fontDescriptorFor(textSemanticsByRole[role]),
  whiteSpace: textSemanticsByRole[role].whiteSpace
})

export const layoutRequestFor = (role: TextRole, variant: SurfaceVariant): Text.Request => ({
  maxWidth: maxWidthFor(role, variant),
  lineHeight: textSemanticsByRole[role].lineHeight
})

export const TextProjectionRequest = Schema.Struct({
  role: TextRole,
  variant: SurfaceVariantSchema,
  text: Schema.String
})

export type TextProjectionRequest = typeof TextProjectionRequest.Type

export const TextProjection = Schema.Struct({
  role: TextRole,
  variant: SurfaceVariantSchema,
  text: Schema.String,
  layout: Text.Request,
  summary: Text.Summary,
  lines: Text.Lines
})

export type TextProjection = typeof TextProjection.Type
