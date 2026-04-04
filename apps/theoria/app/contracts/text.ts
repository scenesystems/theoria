import { Match, Schema } from "effect"
import { Text } from "effect-text"
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
  entry<FontFamily, string>("body", "Inter, Avenir Next, Avenir, Segoe UI, Helvetica Neue, sans-serif"),
  entry<FontFamily, string>("display", "Inter, Avenir Next, Avenir, Segoe UI, Helvetica Neue, sans-serif"),
  entry<FontFamily, string>("mono", "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace")
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
  "hero-title",
  "hero-body",
  "card-title",
  "card-summary",
  "status",
  "tab-label",
  "section-title",
  "row-label",
  "row-value",
  "code-meta",
  "code-block",
  "button-label"
)

export type TextRole = typeof TextRole.Type

export const VariantMaxWidth = Schema.Struct({
  compact: PositiveWidth,
  expanded: PositiveWidth
})

export type VariantMaxWidth = typeof VariantMaxWidth.Type

export const LineBreakBehavior = Schema.Literal("wrap", "nowrap")

export type LineBreakBehavior = typeof LineBreakBehavior.Type

export const TextLayoutEngine = Schema.Literal("browser", "projected")

export type TextLayoutEngine = typeof TextLayoutEngine.Type

export const TextSemantics = Schema.Struct({
  role: TextRole,
  family: FontFamily,
  fontSize: Schema.Number.pipe(Schema.finite(), Schema.greaterThan(0)),
  weight: FontWeight,
  tracking: Schema.Number.pipe(Schema.finite()),
  layoutEngine: TextLayoutEngine,
  lineBreaks: LineBreakBehavior,
  whiteSpace: Text.WhiteSpaceMode,
  lineHeight: PositiveLineHeight,
  maxWidth: VariantMaxWidth
})

export type TextSemantics = typeof TextSemantics.Type

export const fontDescriptorFor = (semantics: TextSemantics): Text.FontDescriptorType => ({
  family: fontFamilyCss(semantics.family),
  size: semantics.fontSize,
  weight: fontWeightNumeric(semantics.weight)
})

const textSemanticsByRole: Record<TextRole, TextSemantics> = {
  "hero-title": {
    role: "hero-title",
    family: "display",
    fontSize: 38,
    weight: "semibold",
    tracking: -0.02,
    layoutEngine: "browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 44,
    maxWidth: { compact: 680, expanded: 920 }
  },
  "hero-body": {
    role: "hero-body",
    family: "body",
    fontSize: 17,
    weight: "normal",
    tracking: 0,
    layoutEngine: "browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 27,
    maxWidth: { compact: 600, expanded: 880 }
  },
  "card-title": {
    role: "card-title",
    family: "display",
    fontSize: 24,
    weight: "semibold",
    tracking: -0.01,
    layoutEngine: "browser",
    lineBreaks: "nowrap",
    whiteSpace: "normal",
    lineHeight: 32,
    maxWidth: { compact: 520, expanded: 1120 }
  },
  "card-summary": {
    role: "card-summary",
    family: "body",
    fontSize: 15,
    weight: "normal",
    tracking: 0,
    layoutEngine: "browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 24,
    maxWidth: { compact: 720, expanded: 1400 }
  },
  status: {
    role: "status",
    family: "body",
    fontSize: 14,
    weight: "normal",
    tracking: 0,
    layoutEngine: "browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 22,
    maxWidth: { compact: 760, expanded: 1400 }
  },
  "tab-label": {
    role: "tab-label",
    family: "body",
    fontSize: 12,
    weight: "semibold",
    tracking: 0.02,
    layoutEngine: "browser",
    lineBreaks: "nowrap",
    whiteSpace: "normal",
    lineHeight: 16,
    maxWidth: { compact: 180, expanded: 220 }
  },
  "section-title": {
    role: "section-title",
    family: "display",
    fontSize: 14,
    weight: "semibold",
    tracking: 0,
    layoutEngine: "browser",
    lineBreaks: "nowrap",
    whiteSpace: "normal",
    lineHeight: 20,
    maxWidth: { compact: 900, expanded: 1400 }
  },
  "row-label": {
    role: "row-label",
    family: "body",
    fontSize: 11,
    weight: "semibold",
    tracking: 0.04,
    layoutEngine: "browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 16,
    maxWidth: { compact: 360, expanded: 680 }
  },
  "row-value": {
    role: "row-value",
    family: "body",
    fontSize: 14,
    weight: "normal",
    tracking: 0,
    layoutEngine: "browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 22,
    maxWidth: { compact: 760, expanded: 1400 }
  },
  "code-meta": {
    role: "code-meta",
    family: "mono",
    fontSize: 12,
    weight: "normal",
    tracking: 0,
    layoutEngine: "browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 18,
    maxWidth: { compact: 900, expanded: 1400 }
  },
  "code-block": {
    role: "code-block",
    family: "mono",
    fontSize: 12,
    weight: "normal",
    tracking: 0,
    layoutEngine: "projected",
    lineBreaks: "wrap",
    whiteSpace: "pre-wrap",
    lineHeight: 18,
    maxWidth: { compact: 900, expanded: 1800 }
  },
  "button-label": {
    role: "button-label",
    family: "body",
    fontSize: 12,
    weight: "semibold",
    tracking: 0.02,
    layoutEngine: "browser",
    lineBreaks: "nowrap",
    whiteSpace: "normal",
    lineHeight: 16,
    maxWidth: { compact: 170, expanded: 210 }
  }
}

export const textSemantics: ReadonlyArray<TextSemantics> = [
  textSemanticsByRole["hero-title"],
  textSemanticsByRole["hero-body"],
  textSemanticsByRole["card-title"],
  textSemanticsByRole["card-summary"],

  textSemanticsByRole.status,
  textSemanticsByRole["tab-label"],
  textSemanticsByRole["section-title"],
  textSemanticsByRole["row-label"],
  textSemanticsByRole["row-value"],
  textSemanticsByRole["code-meta"],
  textSemanticsByRole["code-block"],
  textSemanticsByRole["button-label"]
]

export const semanticsFor = (role: TextRole): TextSemantics => textSemanticsByRole[role]

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
