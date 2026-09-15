import { Match, Number as Num, Tuple } from "effect"
import * as Arr from "effect/Array"

import type { ColorMode } from "../../contracts/palette.js"
import {
  codeColor,
  CodePaint,
  dangerColor,
  DangerRole,
  DiscSlot,
  type DiscStop,
  discStops,
  neutralColor,
  NeutralRole,
  type Oklch,
  shadowAlpha,
  shadowColor,
  shadowGeometry,
  ShadowRole,
  toneColor,
  ToneRole,
  toSrgb,
  type Translucency,
  translucencyAlpha,
  translucentLevels
} from "../../contracts/palette.js"
import { CardTone } from "../../contracts/theme.js"
import {
  discFillClassName,
  discSlotClassName,
  neutralColorName,
  neutralToneClasses,
  toneClassCandidates,
  toneClassesFor,
  toneColorName
} from "../view/primitives/designSystem.js"

/**
 * The stylesheet derived from the palette contract: every role's colour in
 * each mode as `--th-*` custom properties on the root, the `@theme inline`
 * bridge that lends each to Tailwind as a `--color-*` or `--shadow-*` token,
 * a disc-fill utility per tone, and the utility candidates the design system
 * composes at run time (a slot's class in a tone), which Tailwind cannot see
 * in source. Written to `app/web/palette-tokens.generated.css` by
 * `gen:palette-tokens`; a contract test holds the file to this rendering.
 */

type Token = readonly [name: string, value: string]

const token = (name: string, value: string): Token => Tuple.make(name, value)

/** A colour as CSS paints it: the 8-bit sRGB the contract resolves to. */
export const colorCss = (color: Oklch): string => {
  const painted = toSrgb(color)
  return `rgb(${String(painted.r)} ${String(painted.g)} ${String(painted.b)})`
}

const colorWithAlphaCss = (color: Oklch, alpha: number): string => {
  const painted = toSrgb(color)
  return `rgb(${String(painted.r)} ${String(painted.g)} ${String(painted.b)} / ${
    String(Num.round(Num.multiply(alpha, 100), 0))
  }%)`
}

export const neutralTokenName = (role: NeutralRole): string => `--th-${role}`

export const toneTokenName = (tone: CardTone, role: ToneRole): string => `--th-tone-${tone}-${role}`

/** A translucent role's token: the role's name and its level, `--th-paper-veil`. */
export const translucentNeutralTokenName = (role: NeutralRole, translucency: Translucency): string =>
  `${neutralTokenName(role)}-${translucency}`

export const translucentToneTokenName = (tone: CardTone, role: ToneRole, translucency: Translucency): string =>
  `${toneTokenName(tone, role)}-${translucency}`

const translucentCss = (color: Oklch, translucency: Translucency): string =>
  colorWithAlphaCss(color, translucencyAlpha(translucency))

export const dangerTokenName = (role: DangerRole): string => `--th-danger-${role}`

export const codeTokenName = (kind: CodePaint): string => `--th-code-${kind}`

export const shadowTokenName = (role: ShadowRole): string => `--th-shadow-${role}`

export const discTokenName = (tone: CardTone): string => `--th-place-disc-${tone}`

const stopTokenName = (tone: CardTone, stop: DiscStop): string =>
  Match.value(stop).pipe(
    Match.tag("Neutral", ({ role }) => neutralTokenName(role)),
    Match.tag("Tone", ({ role }) => toneTokenName(tone, role)),
    Match.exhaustive
  )

/** The disc is lit from the upper left; the stops run highlight, body, rim. */
const discGradientCss = (tone: CardTone, mode: ColorMode): string => {
  const [highlight, body, rim] = discStops(mode)
  return `radial-gradient(circle at 32% 28%, var(${stopTokenName(tone, highlight)}) 0%, var(${
    stopTokenName(tone, body)
  }) 45%, var(${stopTokenName(tone, rim)}) 100%)`
}

/** Every `--th-*` token and its value in one mode, each name once. */
export const paletteTokens = (mode: ColorMode): ReadonlyArray<Token> =>
  Arr.flatten([
    Arr.map(NeutralRole.literals, (role) => token(neutralTokenName(role), colorCss(neutralColor(role, mode)))),
    Arr.flatMap(CardTone.literals, (tone) =>
      Arr.map(ToneRole.literals, (role) =>
        token(toneTokenName(tone, role), colorCss(toneColor(tone, role, mode))))),
    Arr.flatMap(NeutralRole.literals, (role) =>
      Arr.map(translucentLevels, (translucency) =>
        token(
          translucentNeutralTokenName(role, translucency),
          translucentCss(neutralColor(role, mode), translucency)
        ))),
    Arr.flatMap(CardTone.literals, (tone) =>
      Arr.flatMap(ToneRole.literals, (role) =>
        Arr.map(translucentLevels, (translucency) =>
          token(
            translucentToneTokenName(tone, role, translucency),
            translucentCss(toneColor(tone, role, mode), translucency)
          )))),
    Arr.map(DangerRole.literals, (role) =>
      token(dangerTokenName(role), colorCss(dangerColor(role, mode)))),
    Arr.map(CodePaint.literals, (kind) =>
      token(codeTokenName(kind), colorCss(codeColor(kind, mode)))),
    Arr.map(ShadowRole.literals, (role) =>
      token(
        shadowTokenName(role),
        `${shadowGeometry(role)} ${colorWithAlphaCss(shadowColor(mode), shadowAlpha(role, mode))}`
      )),
    Arr.map(CardTone.literals, (tone) =>
      token(discTokenName(tone), discGradientCss(tone, mode)))
  ])

/** The Tailwind bridge: a `--color-*` utility token per colour role and a `--shadow-*` per shadow, each reading its `--th-*`. */
export const paletteThemeTokens: ReadonlyArray<Token> = Arr.flatten([
  Arr.map(
    NeutralRole.literals,
    (role) => token(`--color-${neutralColorName(role, "solid")}`, `var(${neutralTokenName(role)})`)
  ),
  Arr.flatMap(
    CardTone.literals,
    (tone) =>
      Arr.map(
        ToneRole.literals,
        (role) => token(`--color-${toneColorName(tone, role, "solid")}`, `var(${toneTokenName(tone, role)})`)
      )
  ),
  Arr.flatMap(NeutralRole.literals, (role) =>
    Arr.map(translucentLevels, (translucency) =>
      token(
        `--color-${neutralColorName(role, translucency)}`,
        `var(${translucentNeutralTokenName(role, translucency)})`
      ))),
  Arr.flatMap(
    CardTone.literals,
    (tone) =>
      Arr.flatMap(ToneRole.literals, (role) =>
        Arr.map(translucentLevels, (translucency) =>
          token(
            `--color-${toneColorName(tone, role, translucency)}`,
            `var(${translucentToneTokenName(tone, role, translucency)})`
          )))
  ),
  Arr.map(DangerRole.literals, (role) => token(`--color-danger-${role}`, `var(${dangerTokenName(role)})`)),
  Arr.map(CodePaint.literals, (kind) => token(`--color-code-${kind}`, `var(${codeTokenName(kind)})`)),
  Arr.map(ShadowRole.literals, (role) => token(`--shadow-${role}`, `var(${shadowTokenName(role)})`))
])

const declaration = (indent: string) => ([name, value]: Token): string => `${indent}${name}: ${value};`

const modeSelector = (mode: ColorMode): string =>
  Match.value(mode).pipe(
    Match.when("light", () => ":root"),
    Match.when("dark", () => ":root.dark"),
    Match.exhaustive
  )

const modeBlock = (mode: ColorMode): ReadonlyArray<string> =>
  Arr.flatten([
    [`  ${modeSelector(mode)} {`, `    color-scheme: ${mode};`, ""],
    Arr.map(paletteTokens(mode), declaration("    ")),
    ["  }"]
  ])

/** Every class the design system composes from a tone and a slot, each once, for Tailwind to keep. */
export const paletteClassCandidates: ReadonlyArray<string> = Arr.dedupe(
  Arr.flatten([
    toneClassCandidates(neutralToneClasses),
    Arr.flatMap(CardTone.literals, (tone) => toneClassCandidates(toneClassesFor(tone))),
    Arr.flatMap(CardTone.literals, (tone) => Arr.map(DiscSlot.literals, (slot) => discSlotClassName(tone, slot)))
  ])
)

/** One feature on the imagined place's stage, coloured by who added it: the disc's gradient as a utility per tone. */
const discFillUtility = (tone: CardTone): ReadonlyArray<string> => [
  `  .${discFillClassName(tone)} {`,
  `    background-image: var(${discTokenName(tone)});`,
  "  }"
]

export const renderPaletteTokensCss = (): string =>
  Arr.join(
    Arr.flatten([
      [
        "/* Palette tokens (generated — do not edit; run `bun run gen:palette-tokens`) */",
        "@theme inline {"
      ],
      Arr.map(paletteThemeTokens, declaration("  ")),
      ["}", "", "@layer base {"],
      modeBlock("light"),
      [""],
      modeBlock("dark"),
      ["}", "", "@layer utilities {"],
      Arr.flatten(Arr.intersperse(Arr.map(CardTone.literals, discFillUtility), [""])),
      ["}", "", "/* Design-system candidates: the class each slot wears in each tone (generated — do not edit) */"],
      [`@source inline("${Arr.join(paletteClassCandidates, " ")}");`, ""]
    ]),
    "\n"
  )
