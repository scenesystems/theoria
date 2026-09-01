import { Match } from "effect"

import type { SurfaceVariant } from "../../../contracts/presentation.js"
import type { TextRole } from "../../../contracts/text.js"

export const lineHeightVar = (role: TextRole): string => `--st-lh-${role}`

const fontSizeVar = (role: TextRole): string => `--st-fs-${role}`
const fontWeightVar = (role: TextRole): string => `--st-fw-${role}`
const trackingVar = (role: TextRole): string => `--st-tr-${role}`
const fontFamilyVar = (role: TextRole): string => `--st-ff-${role}`
const maxWidthCssVar = (role: TextRole, variant: SurfaceVariant): string => `--st-mw-${role}-${variant}`

const textTransformFor = (role: TextRole): string => role === "row-label" ? "uppercase" : ""

export const glyphClassName = (role: TextRole): string =>
  [
    `text-(length:${fontSizeVar(role)})`,
    `font-weight-(${fontWeightVar(role)})`,
    `tracking-(${trackingVar(role)})`,
    `font-family-(${fontFamilyVar(role)})`,
    textTransformFor(role)
  ].filter((className) => className.length > 0).join(" ")

export const maxWidthClassName = (role: TextRole, variant: SurfaceVariant): string =>
  Match.value(role).pipe(
    Match.when("button-label", () => ""),
    Match.when("tab-label", () => ""),
    Match.orElse(() => `max-w-(${maxWidthCssVar(role, variant)})`)
  )

export const semanticClassName = (role: TextRole, variant: SurfaceVariant): string =>
  `${glyphClassName(role)} leading-(${lineHeightVar(role)}) ${maxWidthClassName(role, variant)}`
