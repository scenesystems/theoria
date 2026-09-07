import { Option, String as Str } from "effect"
import * as Arr from "effect/Array"

import { motionThemeTokens } from "../../contracts/motion.js"
import {
  fontFamilyCssVar,
  fontFamilyThemeTokens,
  fontSizeCss,
  fontWeightNumeric,
  metricsOverride,
  type TextSemantics,
  textSemantics,
  type Viewport,
  viewportCondition,
  viewports
} from "../../contracts/text.js"
import { semanticClassName } from "../view/primitives/semanticTextClasses.js"

/**
 * The stylesheet derived from the typography and motion contracts: every
 * per-role token, each viewport's overrides, and the utility candidates
 * `SemanticText` composes at run time, which Tailwind cannot see in source.
 * Written to `app/web/text-tokens.generated.css` by `gen:text-tokens`; a
 * contract test holds the file to this rendering.
 */

const trackingCss = (tracking: number): string => tracking === 0 ? "0" : `${String(tracking)}em`

const roleTokens = (semantics: TextSemantics): ReadonlyArray<string> => [
  `  --st-fs-${semantics.role}: ${fontSizeCss(semantics.fontSize)};`,
  `  --st-lh-${semantics.role}: ${String(semantics.lineHeight)}px;`,
  `  --st-fw-${semantics.role}: ${String(fontWeightNumeric(semantics.weight))};`,
  `  --st-tr-${semantics.role}: ${trackingCss(semantics.tracking)};`,
  `  --st-ff-${semantics.role}: ${fontFamilyCssVar(semantics.family)};`,
  `  --st-mw-${semantics.role}-compact: ${String(semantics.maxWidth.compact)}px;`,
  `  --st-mw-${semantics.role}-expanded: ${String(semantics.maxWidth.expanded)}px;`
]

const viewportTokens = (viewport: Viewport): ReadonlyArray<string> =>
  Arr.flatMap(textSemantics, (semantics) =>
    Option.match(metricsOverride(semantics, viewport), {
      onNone: () => [],
      onSome: (metrics) => [
        `    --st-fs-${semantics.role}: ${fontSizeCss(metrics.fontSize)};`,
        `    --st-lh-${semantics.role}: ${String(metrics.lineHeight)}px;`
      ]
    }))

const viewportBlock = (viewport: Viewport): Option.Option<string> =>
  Option.map(
    Option.liftPredicate(viewportTokens(viewport), Arr.isNonEmptyReadonlyArray),
    (tokens) => `@media ${viewportCondition(viewport)} {\n  :root {\n${tokens.join("\n")}\n  }\n}`
  )

/** The utility classes a role's text may wear, each once, in either variant. */
export const semanticTextCandidates = (semantics: TextSemantics): ReadonlyArray<string> =>
  Arr.dedupe(
    Arr.flatMap(
      [semanticClassName(semantics.role, "compact"), semanticClassName(semantics.role, "expanded")],
      (classNames) => Arr.filter(Str.split(classNames, " "), Str.isNonEmpty)
    )
  )

const sourceLine = (semantics: TextSemantics): string =>
  `@source inline("${semanticTextCandidates(semantics).join(" ")}");`

export const renderTextTokensCss = (): string =>
  [
    "/* Typography and motion tokens (generated — do not edit; run `bun run gen:text-tokens`) */",
    "@theme inline {",
    ...Arr.map(fontFamilyThemeTokens, ([name, value]) => `  ${name}: ${value};`),
    ...Arr.flatMap(textSemantics, roleTokens),
    ...Arr.map(motionThemeTokens, ([name, value]) => `  ${name}: ${value};`),
    "}",
    "",
    ...Arr.getSomes(Arr.map(viewports, viewportBlock)),
    "",
    "/* SemanticText candidates, one line per role (generated — do not edit) */",
    ...Arr.map(textSemantics, sourceLine),
    ""
  ].join("\n")
