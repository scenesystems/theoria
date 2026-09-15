import { Tuple } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { Elevation, elevationIndex, Measure, measureCss, Radius, radiusCss } from "../../contracts/layout.js"
import { MotionRelation } from "../../contracts/motion.js"
import { elevationClassName, transitionClassName } from "../view/primitives/designSystem.js"

/**
 * The stylesheet derived from the layout contract: each radius and measure as
 * a Tailwind theme token (`--radius-*`, `--container-*`), each elevation's
 * z-index as a `--th-z-*` custom property on the root, and the utility
 * candidates the design system composes at run time (an elevation's class, a
 * relation's transition), which Tailwind cannot see in source. Written to
 * `app/web/layout-tokens.generated.css` by `gen:layout-tokens`; a contract
 * test holds the file to this rendering.
 */

type Token = readonly [name: string, value: string]

const token = (name: string, value: string): Token => Tuple.make(name, value)

export const radiusTokenName = (radius: Radius): string => `--radius-${radius}`

export const measureTokenName = (measure: Measure): string => `--container-${measure}`

export const elevationTokenName = (elevation: Elevation): string => `--th-z-${elevation}`

/** The Tailwind theme tokens: a `--radius-*` per radius, a `--container-*` per measure. */
export const layoutThemeTokens: ReadonlyArray<Token> = Arr.appendAll(
  Arr.map(Radius.literals, (radius) => token(radiusTokenName(radius), radiusCss(radius))),
  Arr.map(Measure.literals, (measure) => token(measureTokenName(measure), measureCss(measure)))
)

/** Each elevation's z-index, in the order the contract gives. */
export const elevationTokens: ReadonlyArray<Token> = Arr.map(
  Elevation.literals,
  (elevation) => token(elevationTokenName(elevation), String(elevationIndex(elevation)))
)

/** Every class the design system composes from an elevation or a motion relation, each once, for Tailwind to keep. */
export const layoutClassCandidates: ReadonlyArray<string> = Arr.dedupe(
  Arr.appendAll(
    Arr.map(Elevation.literals, elevationClassName),
    Arr.flatMap(
      MotionRelation.literals,
      (relation) => Arr.filter(Str.split(transitionClassName(relation), " "), Str.isNonEmpty)
    )
  )
)

const declaration = (indent: string) => ([name, value]: Token): string => `${indent}${name}: ${value};`

export const renderLayoutTokensCss = (): string =>
  Arr.join(
    Arr.flatten([
      [
        "/* Layout tokens (generated — do not edit; run `bun run gen:layout-tokens`) */",
        "@theme inline {"
      ],
      Arr.map(layoutThemeTokens, declaration("  ")),
      ["}", "", "@layer base {", "  :root {"],
      Arr.map(elevationTokens, declaration("    ")),
      ["  }", "}", ""],
      ["/* Design-system candidates: each elevation's class and each relation's transition (generated — do not edit) */"],
      [`@source inline("${Arr.join(layoutClassCandidates, " ")}");`, ""]
    ]),
    "\n"
  )
