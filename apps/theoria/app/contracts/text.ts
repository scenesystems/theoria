import { Text } from "@scenesystems/effect-text"
import { Match, Option, Schema } from "effect"
import * as HashMap from "effect/HashMap"

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

const entry = <K, V>(k: K, v: V): readonly [K, V] => [k, v]

const fontFamilyStacks = HashMap.make(
  entry<FontFamily, string>("body", `Figtree, Inter, "Segoe UI", "Helvetica Neue", sans-serif`),
  entry<FontFamily, string>("display", `Figtree, Inter, "Segoe UI", "Helvetica Neue", sans-serif`),
  entry<FontFamily, string>(
    "mono",
    `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
  )
)

const fontFamilyVarNames = HashMap.make(
  entry<FontFamily, string>("body", "var(--font-body)"),
  entry<FontFamily, string>("display", "var(--font-display)"),
  entry<FontFamily, string>("mono", "var(--font-mono)")
)

const fontWeightValues = HashMap.make(
  entry<FontWeight, number>("normal", 400),
  entry<FontWeight, number>("medium", 500),
  entry<FontWeight, number>("semibold", 600),
  entry<FontWeight, number>("bold", 700)
)

export const fontFamilyCss = (family: FontFamily): string => HashMap.unsafeGet(fontFamilyStacks, family)

export const fontFamilyCssVar = (family: FontFamily): string => HashMap.unsafeGet(fontFamilyVarNames, family)

export const fontWeightNumeric = (weight: FontWeight): number => HashMap.unsafeGet(fontWeightValues, weight)

export const fontFamilyThemeTokens: ReadonlyArray<readonly [string, string]> = HashMap.toEntries(fontFamilyStacks).map((
  [family, stack]
) => [`--font-${family}`, stack])

export const TextRole = Schema.Literal(
  "display",
  "lead",
  "hero-title",
  "subsection-title",
  "card-title",
  "card-summary",
  "stage-prose",
  "status",
  "tab-label",
  "selection-title",
  "section-title",
  "row-label",
  "row-value",
  "code-meta",
  "code-block",
  "button-label",
  "marker-label"
)

export type TextRole = typeof TextRole.Type

export const VariantMaxWidth = Schema.Struct({
  compact: PositiveWidth,
  expanded: PositiveWidth
})

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

export const viewports: ReadonlyArray<Viewport> = Viewport.literals

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

export const TextSemantics = Schema.Struct({
  role: TextRole,
  family: FontFamily,
  fontSize: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0)),
  weight: FontWeight,
  tracking: Schema.Number.pipe(Schema.finite()),
  wrapAuthority: TextWrapAuthority,
  lineBreaks: LineBreakBehavior,
  whiteSpace: Text.WhiteSpaceMode,
  lineHeight: PositiveLineHeight,
  maxWidth: VariantMaxWidth,
  at: ResponsiveMetrics
})

export type TextSemantics = typeof TextSemantics.Type

export const fontDescriptorFor = (semantics: TextSemantics): Text.FontDescriptorType => ({
  family: fontFamilyCss(semantics.family),
  size: semantics.fontSize,
  weight: fontWeightNumeric(semantics.weight)
})

const textSemanticsByRole: Record<TextRole, TextSemantics> = {
  display: {
    role: "display",
    family: "display",
    fontSize: 44,
    weight: "semibold",
    tracking: -0.02,
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
    tracking: -0.02,
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
    fontSize: 22,
    weight: "semibold",
    tracking: -0.01,
    wrapAuthority: "native-browser",
    lineBreaks: "nowrap",
    whiteSpace: "normal",
    lineHeight: 30,
    maxWidth: { compact: 520, expanded: 1120 },
    at: { narrow: { fontSize: { min: 14, vw: 4.6, max: 18 }, lineHeight: 24 } }
  },
  "card-title": {
    role: "card-title",
    family: "display",
    fontSize: 24,
    weight: "semibold",
    tracking: -0.01,
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 32,
    maxWidth: { compact: 520, expanded: 1120 },
    at: {}
  },
  "card-summary": {
    role: "card-summary",
    family: "body",
    fontSize: 16,
    weight: "normal",
    tracking: 0,
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 26,
    maxWidth: { compact: 720, expanded: 1400 },
    at: { narrow: { fontSize: 15, lineHeight: 22 } }
  },
  "stage-prose": {
    role: "stage-prose",
    family: "body",
    fontSize: 16,
    weight: "normal",
    tracking: 0,
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 26,
    maxWidth: { compact: 720, expanded: 1400 },
    at: {}
  },
  status: {
    role: "status",
    family: "body",
    fontSize: 14,
    weight: "normal",
    tracking: 0,
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 22,
    maxWidth: { compact: 760, expanded: 1400 },
    at: {}
  },
  "tab-label": {
    role: "tab-label",
    family: "body",
    fontSize: 12,
    weight: "semibold",
    tracking: 0.02,
    wrapAuthority: "native-browser",
    lineBreaks: "nowrap",
    whiteSpace: "normal",
    lineHeight: 16,
    maxWidth: { compact: 180, expanded: 220 },
    at: {}
  },
  "selection-title": {
    role: "selection-title",
    family: "display",
    fontSize: 14,
    weight: "semibold",
    tracking: 0,
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
    tracking: 0,
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 32,
    maxWidth: { compact: 900, expanded: 1400 },
    at: { narrow: { fontSize: 21, lineHeight: 28 } }
  },
  "row-label": {
    role: "row-label",
    family: "body",
    fontSize: 11,
    weight: "semibold",
    tracking: 0.04,
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
    tracking: 0.01,
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 14,
    maxWidth: { compact: 160, expanded: 200 },
    at: {}
  }
}

export const textSemantics: ReadonlyArray<TextSemantics> = [
  textSemanticsByRole.display,
  textSemanticsByRole.lead,
  textSemanticsByRole["hero-title"],
  textSemanticsByRole["subsection-title"],
  textSemanticsByRole["card-title"],
  textSemanticsByRole["card-summary"],
  textSemanticsByRole["stage-prose"],

  textSemanticsByRole.status,
  textSemanticsByRole["tab-label"],
  textSemanticsByRole["selection-title"],
  textSemanticsByRole["section-title"],
  textSemanticsByRole["row-label"],
  textSemanticsByRole["row-value"],
  textSemanticsByRole["code-meta"],
  textSemanticsByRole["code-block"],
  textSemanticsByRole["button-label"],
  textSemanticsByRole["marker-label"]
]

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
const lengthCss = (length: number | FluidSize): string =>
  Schema.is(FluidSize)(length)
    ? `clamp(${String(length.min)}px, ${String(length.vw)}vw, ${String(length.max)}px)`
    : `${String(length)}px`

export const fontSizeCss = (size: FontSize): string => lengthCss(size)

export const lineHeightCss = (leading: LineHeight): string => lengthCss(leading)

export const maxWidthFor = (role: TextRole, variant: SurfaceVariant): number =>
  Match.value(variant).pipe(
    Match.when("compact", () => textSemanticsByRole[role].maxWidth.compact),
    Match.orElse(() => textSemanticsByRole[role].maxWidth.expanded)
  )

export const prepareInputFor = (role: TextRole, text: string): Text.PrepareInputType => ({
  text,
  font: fontDescriptorFor(textSemanticsByRole[role]),
  whiteSpace: textSemanticsByRole[role].whiteSpace
})

export const layoutRequestFor = (role: TextRole, variant: SurfaceVariant): Text.LayoutRequestType => ({
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
  layout: Text.LayoutRequest,
  summary: Text.LayoutSummary,
  lines: Schema.Array(Text.LayoutLine)
})

export type TextProjection = typeof TextProjection.Type
