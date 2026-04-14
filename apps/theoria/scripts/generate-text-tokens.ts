import { writeFileSync } from "node:fs"

import {
  fontFamilyCssVar,
  fontFamilyThemeTokens,
  fontWeightNumeric,
  uiTextSemantics
} from "../app/contracts/presentation/text.js"

const outputPath = new URL("../app/web/ui/tokens/typography.generated.css", import.meta.url)

const fontFamilyThemeLines = fontFamilyThemeTokens.map(
  ([name, stack]) => `  ${name}: ${stack};`
)

const fontSizeTokens = uiTextSemantics.map(
  (s) => `  --ui-type-${s.role}-size: ${String(s.fontSize)}px;`
)

const lineHeightTokens = uiTextSemantics.map(
  (s) => `  --ui-type-${s.role}-leading: ${String(s.lineHeight)}px;`
)

const fontWeightTokens = uiTextSemantics.map(
  (s) => `  --ui-type-${s.role}-weight: ${String(fontWeightNumeric(s.weight))};`
)

const trackingTokens = uiTextSemantics.map(
  (s) => `  --ui-type-${s.role}-tracking: ${s.tracking === 0 ? "0" : `${String(s.tracking)}em`};`
)

const fontFamilyTokens = uiTextSemantics.map(
  (s) => `  --ui-type-${s.role}-family: ${fontFamilyCssVar(s.family)};`
)

const output = [
  "/*",
  " * Generated from app/contracts/presentation/text.ts by scripts/generate-text-tokens.ts.",
  " * Do not edit directly.",
  " */",
  "",
  "@theme {",
  "  /* Typography: font-family theme tokens (generated — do not edit) */",
  ...fontFamilyThemeLines,
  "",
  "  /* Typography: semantic UI font-size tokens (generated — do not edit) */",
  ...fontSizeTokens,
  "",
  "  /* Typography: semantic UI line-height tokens (generated — do not edit) */",
  ...lineHeightTokens,
  "",
  "  /* Typography: semantic UI font-weight tokens (generated — do not edit) */",
  ...fontWeightTokens,
  "",
  "  /* Typography: semantic UI tracking tokens (generated — do not edit) */",
  ...trackingTokens,
  "",
  "  /* Typography: semantic UI font-family tokens (generated — do not edit) */",
  ...fontFamilyTokens,
  "}"
].join("\n")

writeFileSync(outputPath, output + "\n")

process.stdout.write("Generated app/web/ui/tokens/typography.generated.css\n")
