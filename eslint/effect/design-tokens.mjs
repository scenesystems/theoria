/**
 * Design-token discipline for the web views: a class string names a radius,
 * a duration, an ease, a stacking layer or a column width only through the
 * layout and motion contracts' tokens, which the design system composes
 * (`rounded-instrument`, `transitionClassName(relation)`,
 * `elevationClassName(layer)`, `measureClassName(measure)`), and a colour's
 * translucency only through the palette contract's levels (`bg-paper-veil`).
 * Typography comes from TextRole through SemanticText, SemanticContent or
 * semanticClassName, including in primitives: no second size, weight,
 * tracking, leading or case scale is allowed beside the contract.
 * Tailwind's own scale, arbitrary values and alpha modifiers are not a second
 * vocabulary for them.
 *
 * `no-restricted-syntax` sees a class string as a `Literal` (a plain string,
 * a JSX attribute) or as the `TemplateElement`s of a template literal, so each
 * rule is written for both.
 *
 * @module eslint/effect/design-tokens
 */

/**
 * @param {string} pattern a regular expression source matched against the string's text
 * @param {string} message
 */
const classStringRule = (pattern, message) => [
  { selector: `Literal[value=/${pattern}/]`, message },
  { selector: `TemplateElement[value.raw=/${pattern}/]`, message }
]

/**
 * A utility at the start of the string, after a space, or after a variant
 * (`hover:`, `data-[open]:`); `[^/]` stands for the slash esquery's regex
 * grammar cannot spell.
 */
const utility = "(^|[\\s:])"

export const DESIGN_TOKEN_RULES = [
  ...classStringRule(
    `${utility}text-((xs|sm|base|lg|xl|[2-9]xl)([^a-zA-Z0-9-]|$)|\\[(length:|[0-9.]|calc\\(|clamp\\(|var\\())`,
    "Text sizes come from TextRole: use SemanticText, SemanticContent or semanticClassName(role, variant), not a Tailwind size."
  ),
  ...classStringRule(
    `${utility}font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\\[)`,
    "Text weights come from TextRole; do not override a role's weight at its call site."
  ),
  ...classStringRule(
    `${utility}(tracking-(tighter|tight|normal|wide|wider|widest|\\[)|leading-(none|tight|snug|normal|relaxed|loose|[0-9]|\\[)|(uppercase|lowercase|capitalize|normal-case)(\\s|$))`,
    "Tracking, leading and case come from TextRole, not a view's typography override."
  ),
  ...classStringRule(
    `${utility}rounded-(sm|md|lg|xl|2xl|3xl|\\[)`,
    "Radii come from the layout contract: rounded-mark, rounded-control, rounded-instrument or rounded-sheet, or surfaceClassName(role)."
  ),
  ...classStringRule(
    `${utility}duration-([1-9][0-9]*(\\s|$)|\\[[^\\]]*[0-9]+m?s)`,
    "Durations come from the motion contract: transitionClassName(relation) or duration-(--th-motion-duration-<relation>)."
  ),
  ...classStringRule(
    `${utility}ease-(out|in|in-out|linear|\\[)`,
    "Eases come from the motion contract: transitionClassName(relation), ease-theme or ease-follow."
  ),
  ...classStringRule(
    `${utility}z-([2-9][0-9]|[1-9][0-9][0-9]+|\\[)`,
    "Stacking layers come from the layout contract: elevationClassName(layer)."
  ),
  ...classStringRule(
    `${utility}max-w-\\[(54|82|88|96)rem\\]`,
    "Column widths come from the layout contract: measureClassName(measure)."
  ),
  ...classStringRule(
    `ring-ink[^-a-zA-Z]`,
    "Focus rings are the neutral focus role: focusClassName or focusRingClassName (ring-focus), not a tinted ink."
  ),
  ...classStringRule(
    `${utility}(bg|border|border-[trblxyse]|ring|ring-offset|inset-ring|text|from|via|to|fill|stroke|outline|decoration|divide|accent|caret|shadow|placeholder)-[a-z][a-z0-9-]*[^-a-zA-Z0-9\\s:_(\\[\\]][0-9]`,
    "Translucency comes from the palette contract: name the level (bg-paper-veil, border-hairline-glass, bg-ink-strong-mist), not an alpha."
  )
]
