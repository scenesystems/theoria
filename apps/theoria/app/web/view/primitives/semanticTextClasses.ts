import type { Text } from "@scenesystems/effect-text"
import { Match } from "effect"
import * as Arr from "effect/Array"

import type { SurfaceVariant } from "../../../contracts/presentation.js"
import type { TextRole } from "../../../contracts/text.js"

export const lineHeightVar = (role: TextRole): string => `--st-lh-${role}`

export const fontSizeVar = (role: TextRole): string => `--st-fs-${role}`
const fontWeightVar = (role: TextRole): string => `--st-fw-${role}`
const trackingVar = (role: TextRole): string => `--st-tr-${role}`
const fontFamilyVar = (role: TextRole): string => `--st-ff-${role}`
const maxWidthCssVar = (role: TextRole, variant: SurfaceVariant): string => `--st-mw-${role}-${variant}`

const textTransformFor = (role: TextRole): string => role === "row-label" ? "uppercase" : ""

/**
 * Tailwind's `font-(…)` utility sets the weight from a variable, and the family
 * when the variable is tagged `family-name:`; there is no `font-weight-(…)`.
 */
export const glyphClassName = (role: TextRole): string =>
  [
    `text-(length:${fontSizeVar(role)})`,
    `font-(${fontWeightVar(role)})`,
    `tracking-(${trackingVar(role)})`,
    `font-(family-name:${fontFamilyVar(role)})`,
    textTransformFor(role)
  ].filter((className) => className.length > 0).join(" ")

/** Roles whose width is their control's, not a measure of their own: a label is as wide as what it labels. */
const controlSizedRoles: ReadonlyArray<TextRole> = ["button-label", "tab-label", "marker-label"]

export const maxWidthClassName = (role: TextRole, variant: SurfaceVariant): string =>
  Arr.contains(controlSizedRoles, role) ? "" : `max-w-(${maxWidthCssVar(role, variant)})`

/** How a block wraps before it is measured: the browser's own wrapping, in the text's white-space mode. */
export const whiteSpaceClassName = (mode: Text.WhiteSpaceModeType): string =>
  Match.value(mode).pipe(
    Match.when("pre-wrap", () => "whitespace-pre-wrap"),
    Match.when("normal", () => "whitespace-normal"),
    Match.exhaustive
  )

export const semanticClassName = (role: TextRole, variant: SurfaceVariant): string =>
  `${glyphClassName(role)} leading-(${lineHeightVar(role)}) ${maxWidthClassName(role, variant)}`
