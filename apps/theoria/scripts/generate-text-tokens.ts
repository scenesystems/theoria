import { fontFamilyCssVar, fontFamilyThemeTokens, fontWeightNumeric, textSemantics } from "../app/contracts/text.js"

const fontFamilyThemeLines = fontFamilyThemeTokens.map(
  ([name, stack]) => `  ${name}: ${stack};`
)

const fontSizeTokens = textSemantics.map(
  (s) => `  --st-fs-${s.role}: ${String(s.fontSize)}px;`
)

const lineHeightTokens = textSemantics.map(
  (s) => `  --st-lh-${s.role}: ${String(s.lineHeight)}px;`
)

const fontWeightTokens = textSemantics.map(
  (s) => `  --st-fw-${s.role}: ${String(fontWeightNumeric(s.weight))};`
)

const trackingTokens = textSemantics.map(
  (s) => `  --st-tr-${s.role}: ${s.tracking === 0 ? "0" : `${String(s.tracking)}em`};`
)

const fontFamilyTokens = textSemantics.map(
  (s) => `  --st-ff-${s.role}: ${fontFamilyCssVar(s.family)};`
)

const maxWidthTokens = textSemantics.flatMap((s) => [
  `  --st-mw-${s.role}-compact: ${String(s.maxWidth.compact)}px;`,
  `  --st-mw-${s.role}-expanded: ${String(s.maxWidth.expanded)}px;`
])

const output = [
  "  /* Typography: font-family theme tokens (generated — do not edit) */",
  ...fontFamilyThemeLines,
  "",
  "  /* Typography: per-role font-size tokens (generated — do not edit) */",
  ...fontSizeTokens,
  "",
  "  /* Typography: per-role line-height tokens (generated — do not edit) */",
  ...lineHeightTokens,
  "",
  "  /* Typography: per-role font-weight tokens (generated — do not edit) */",
  ...fontWeightTokens,
  "",
  "  /* Typography: per-role tracking tokens (generated — do not edit) */",
  ...trackingTokens,
  "",
  "  /* Typography: per-role font-family tokens (generated — do not edit) */",
  ...fontFamilyTokens,
  "",
  "  /* Typography: per-role/variant max-width tokens (generated — do not edit) */",
  ...maxWidthTokens
].join("\n")

process.stdout.write(output + "\n")
