/**
 * Canonical canvas font-selection and text-engine profiles.
 *
 * @since 0.5.0
 * @module
 */
import { Match, Schema } from "effect"
import * as Arr from "effect/Array"

import * as Text from "./Text.js"

/**
 * Stable identifier for a shipped canvas profile.
 *
 * @since 0.5.0
 * @category schemas
 */
export const Id = Schema.Literal("canvas-monospace", "canvas-system-ui")

/**
 * Identifier for a shipped canvas profile.
 *
 * @since 0.5.0
 * @category models
 */
export type Id = typeof Id.Type

const FontSelection = Schema.Literal("named-family", "browser-default-stack")

/**
 * Canvas font selection paired with the `Text.Profile` used during preparation.
 *
 * @since 0.5.0
 * @category models
 */
export class CanvasProfile extends Schema.Class<CanvasProfile>("@scenesystems/effect-text/CanvasProfile")({
  /** Stable identity used by application preparation caches. */
  id: Id,
  /** Family selected when the caller does not supply another font. */
  defaultFontFamily: Schema.String,
  /** Whether a named family or the browser's default UI stack is selected. */
  fontSelection: FontSelection,
  /** Ordered CSS fallback families. */
  fontStack: Schema.NonEmptyArray(Schema.String),
  /** Whitespace policy used by consumers that do not select one. */
  defaultWhiteSpaceMode: Text.Whitespace,
  /** Text preparation settings paired with this canvas selection. */
  engineProfile: Text.Profile
}) {}

/**
 * Deterministic named-family canvas profile.
 *
 * @since 0.5.0
 * @category profiles
 */
export const monospace = new CanvasProfile({
  id: "canvas-monospace",
  defaultFontFamily: "Mono",
  fontSelection: "named-family",
  fontStack: Arr.make("Mono", "monospace"),
  defaultWhiteSpaceMode: "normal",
  engineProfile: Text.Profile.make({
    lineFitEpsilon: 0.005,
    tabWidth: 4,
    defaultDirection: "ltr",
    preferEarlySoftHyphenBreak: false,
    preferPrefixWidthsForBreakableRuns: true
  })
})

/**
 * Browser-default system UI canvas profile.
 *
 * @since 0.5.0
 * @category profiles
 */
export const systemUi = new CanvasProfile({
  id: "canvas-system-ui",
  defaultFontFamily: "system-ui",
  fontSelection: "browser-default-stack",
  fontStack: Arr.make("system-ui", "sans-serif"),
  defaultWhiteSpaceMode: "normal",
  engineProfile: Text.Profile.make({
    lineFitEpsilon: 0.01,
    tabWidth: 4,
    defaultDirection: "ltr",
    preferEarlySoftHyphenBreak: false,
    preferPrefixWidthsForBreakableRuns: true
  })
})

/**
 * Selects a shipped profile. Omission selects `monospace`.
 *
 * @since 0.5.0
 * @category profiles
 */
export const get = (id: Id = monospace.id): CanvasProfile =>
  Match.value(id).pipe(
    Match.when("canvas-monospace", () => monospace),
    Match.when("canvas-system-ui", () => systemUi),
    Match.exhaustive
  )
