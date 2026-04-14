import { Match, Schema } from "effect"
import { Text } from "effect-text"
import * as HashMap from "effect/HashMap"

import { type SurfaceVariant, SurfaceVariant as SurfaceVariantSchema } from "./program.js"

const PositiveWidth = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThan(0)
)

const PositiveFontSize = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThan(0)
)

const PositiveLineHeight = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThan(0)
)

const TrackingValue = Schema.Number.pipe(Schema.finite())

export const FontWeight = Schema.Literal("normal", "medium", "semibold", "bold")

export type FontWeight = typeof FontWeight.Type

export const FontFamily = Schema.Literal("body", "display", "mono")

export type FontFamily = typeof FontFamily.Type

const entry = <K, V>(k: K, v: V): readonly [K, V] => [k, v]

const fontFamilyStacks = HashMap.make(
  entry<FontFamily, string>("body", "Figtree, Inter, \"Segoe UI\", \"Helvetica Neue\", sans-serif"),
  entry<FontFamily, string>("display", "Figtree, Inter, \"Segoe UI\", \"Helvetica Neue\", sans-serif"),
  entry<FontFamily, string>(
    "mono",
    "\"JetBrains Mono\", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
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
  "hero-title",
  "hero-body",
  "catalog-title",
  "card-title",
  "card-summary",
  "status",
  "tab-label",
  "selection-title",
  "section-title",
  "row-label",
  "row-value",
  "code-meta",
  "code-block",
  "button-label"
)

export type TextRole = typeof TextRole.Type

export const UiTextRole = Schema.Literal(
  "display-lg",
  "display",
  "display-sm",
  "body-lg",
  "body",
  "body-sm",
  "eyebrow",
  "label",
  "button",
  "badge",
  "tab",
  "status",
  "workspace-title",
  "workspace-summary",
  "pane-title",
  "pane-summary",
  "pane-meta",
  "strip-label",
  "transcript-actor",
  "transcript-meta",
  "detail-label",
  "detail-value",
  "payload-label",
  "inspector-title",
  "inspector-summary"
)

export type UiTextRole = typeof UiTextRole.Type

export const VariantMaxWidth = Schema.Struct({
  compact: PositiveWidth,
  expanded: PositiveWidth
})

export type VariantMaxWidth = typeof VariantMaxWidth.Type

export const LineBreakBehavior = Schema.Literal("wrap", "nowrap")

export type LineBreakBehavior = typeof LineBreakBehavior.Type

export const TextWrapAuthority = Schema.Literal("native-browser", "effect-text-projected")

export type TextWrapAuthority = typeof TextWrapAuthority.Type

export const TextSemantics = Schema.Struct({
  role: TextRole,
  family: FontFamily,
  fontSize: PositiveFontSize,
  weight: FontWeight,
  tracking: TrackingValue,
  wrapAuthority: TextWrapAuthority,
  lineBreaks: LineBreakBehavior,
  whiteSpace: Text.WhiteSpaceMode,
  lineHeight: PositiveLineHeight,
  maxWidth: VariantMaxWidth
})

export type TextSemantics = typeof TextSemantics.Type

export const UiTextSemantics = Schema.Struct({
  role: UiTextRole,
  family: FontFamily,
  fontSize: PositiveFontSize,
  weight: FontWeight,
  tracking: TrackingValue,
  lineHeight: PositiveLineHeight
})

export type UiTextSemantics = typeof UiTextSemantics.Type

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
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 44,
    maxWidth: { compact: 680, expanded: 920 }
  },
  "hero-body": {
    role: "hero-body",
    family: "body",
    fontSize: 18,
    weight: "normal",
    tracking: 0,
    wrapAuthority: "native-browser",
    lineBreaks: "wrap",
    whiteSpace: "normal",
    lineHeight: 30,
    maxWidth: { compact: 600, expanded: 880 }
  },
  "catalog-title": {
    role: "catalog-title",
    family: "display",
    fontSize: 22,
    weight: "semibold",
    tracking: -0.01,
    wrapAuthority: "native-browser",
    lineBreaks: "nowrap",
    whiteSpace: "normal",
    lineHeight: 30,
    maxWidth: { compact: 520, expanded: 1120 }
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
    maxWidth: { compact: 520, expanded: 1120 }
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
    maxWidth: { compact: 720, expanded: 1400 }
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
    maxWidth: { compact: 760, expanded: 1400 }
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
    maxWidth: { compact: 180, expanded: 220 }
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
    maxWidth: { compact: 900, expanded: 1400 }
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
    maxWidth: { compact: 900, expanded: 1400 }
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
    maxWidth: { compact: 360, expanded: 680 }
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
    maxWidth: { compact: 760, expanded: 1400 }
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
    maxWidth: { compact: 900, expanded: 1400 }
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
    maxWidth: { compact: 900, expanded: 1800 }
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
    maxWidth: { compact: 170, expanded: 210 }
  }
}

const uiTextSemanticsByRole: Record<UiTextRole, UiTextSemantics> = {
  "display-lg": {
    role: "display-lg",
    family: "display",
    fontSize: 38,
    weight: "semibold",
    tracking: -0.02,
    lineHeight: 44
  },
  display: {
    role: "display",
    family: "display",
    fontSize: 24,
    weight: "semibold",
    tracking: -0.01,
    lineHeight: 32
  },
  "display-sm": {
    role: "display-sm",
    family: "display",
    fontSize: 22,
    weight: "semibold",
    tracking: -0.01,
    lineHeight: 30
  },
  "body-lg": {
    role: "body-lg",
    family: "body",
    fontSize: 18,
    weight: "normal",
    tracking: 0,
    lineHeight: 30
  },
  body: {
    role: "body",
    family: "body",
    fontSize: 16,
    weight: "normal",
    tracking: 0,
    lineHeight: 26
  },
  "body-sm": {
    role: "body-sm",
    family: "body",
    fontSize: 14,
    weight: "normal",
    tracking: 0,
    lineHeight: 22
  },
  eyebrow: {
    role: "eyebrow",
    family: "body",
    fontSize: 11,
    weight: "semibold",
    tracking: 0.12,
    lineHeight: 16
  },
  label: {
    role: "label",
    family: "body",
    fontSize: 14,
    weight: "medium",
    tracking: 0.01,
    lineHeight: 20
  },
  button: {
    role: "button",
    family: "body",
    fontSize: 14,
    weight: "semibold",
    tracking: 0.01,
    lineHeight: 20
  },
  badge: {
    role: "badge",
    family: "body",
    fontSize: 12,
    weight: "semibold",
    tracking: 0.02,
    lineHeight: 16
  },
  tab: {
    role: "tab",
    family: "body",
    fontSize: 14,
    weight: "medium",
    tracking: 0.01,
    lineHeight: 20
  },
  status: {
    role: "status",
    family: "body",
    fontSize: 14,
    weight: "normal",
    tracking: 0,
    lineHeight: 22
  },
  "workspace-title": {
    role: "workspace-title",
    family: "display",
    fontSize: 30,
    weight: "semibold",
    tracking: -0.02,
    lineHeight: 36
  },
  "workspace-summary": {
    role: "workspace-summary",
    family: "body",
    fontSize: 15,
    weight: "normal",
    tracking: 0,
    lineHeight: 24
  },
  "pane-title": {
    role: "pane-title",
    family: "body",
    fontSize: 16,
    weight: "semibold",
    tracking: 0,
    lineHeight: 22
  },
  "pane-summary": {
    role: "pane-summary",
    family: "body",
    fontSize: 14,
    weight: "normal",
    tracking: 0,
    lineHeight: 22
  },
  "pane-meta": {
    role: "pane-meta",
    family: "body",
    fontSize: 12,
    weight: "medium",
    tracking: 0.04,
    lineHeight: 18
  },
  "strip-label": {
    role: "strip-label",
    family: "body",
    fontSize: 11,
    weight: "semibold",
    tracking: 0.12,
    lineHeight: 16
  },
  "transcript-actor": {
    role: "transcript-actor",
    family: "body",
    fontSize: 13,
    weight: "medium",
    tracking: 0.01,
    lineHeight: 18
  },
  "transcript-meta": {
    role: "transcript-meta",
    family: "body",
    fontSize: 12,
    weight: "normal",
    tracking: 0.02,
    lineHeight: 18
  },
  "detail-label": {
    role: "detail-label",
    family: "body",
    fontSize: 11,
    weight: "medium",
    tracking: 0.08,
    lineHeight: 16
  },
  "detail-value": {
    role: "detail-value",
    family: "body",
    fontSize: 14,
    weight: "normal",
    tracking: 0,
    lineHeight: 20
  },
  "payload-label": {
    role: "payload-label",
    family: "mono",
    fontSize: 11,
    weight: "medium",
    tracking: 0.06,
    lineHeight: 16
  },
  "inspector-title": {
    role: "inspector-title",
    family: "body",
    fontSize: 16,
    weight: "semibold",
    tracking: 0,
    lineHeight: 22
  },
  "inspector-summary": {
    role: "inspector-summary",
    family: "body",
    fontSize: 14,
    weight: "normal",
    tracking: 0,
    lineHeight: 22
  }
}

export const textSemantics: ReadonlyArray<TextSemantics> = [
  textSemanticsByRole["hero-title"],
  textSemanticsByRole["hero-body"],
  textSemanticsByRole["catalog-title"],
  textSemanticsByRole["card-title"],
  textSemanticsByRole["card-summary"],

  textSemanticsByRole.status,
  textSemanticsByRole["tab-label"],
  textSemanticsByRole["selection-title"],
  textSemanticsByRole["section-title"],
  textSemanticsByRole["row-label"],
  textSemanticsByRole["row-value"],
  textSemanticsByRole["code-meta"],
  textSemanticsByRole["code-block"],
  textSemanticsByRole["button-label"]
]

export const uiTextSemantics: ReadonlyArray<UiTextSemantics> = [
  uiTextSemanticsByRole["display-lg"],
  uiTextSemanticsByRole.display,
  uiTextSemanticsByRole["display-sm"],
  uiTextSemanticsByRole["body-lg"],
  uiTextSemanticsByRole.body,
  uiTextSemanticsByRole["body-sm"],
  uiTextSemanticsByRole.eyebrow,
  uiTextSemanticsByRole.label,
  uiTextSemanticsByRole.button,
  uiTextSemanticsByRole.badge,
  uiTextSemanticsByRole.tab,
  uiTextSemanticsByRole.status,
  uiTextSemanticsByRole["workspace-title"],
  uiTextSemanticsByRole["workspace-summary"],
  uiTextSemanticsByRole["pane-title"],
  uiTextSemanticsByRole["pane-summary"],
  uiTextSemanticsByRole["pane-meta"],
  uiTextSemanticsByRole["strip-label"],
  uiTextSemanticsByRole["transcript-actor"],
  uiTextSemanticsByRole["transcript-meta"],
  uiTextSemanticsByRole["detail-label"],
  uiTextSemanticsByRole["detail-value"],
  uiTextSemanticsByRole["payload-label"],
  uiTextSemanticsByRole["inspector-title"],
  uiTextSemanticsByRole["inspector-summary"]
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
