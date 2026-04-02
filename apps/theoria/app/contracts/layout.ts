import { Schema } from "effect"

/**
 * Grid layout variants controlling column structure via Tailwind utilities.
 *
 * @since 0.1.0
 */
export const GridLayout = Schema.Literal("split", "stack", "sidebar", "lead-rail", "rail-lead")

/**
 * @since 0.1.0
 */
export type GridLayout = typeof GridLayout.Type

/**
 * Surface identities available in the deep-dive projection workspace.
 *
 * @since 0.1.0
 */
export enum DeepDiveSurfacePlaneValue {
  Stage = "stage",
  Evidence = "evidence",
  Source = "source"
}

/**
 * @since 0.1.0
 */
export const DeepDiveSurfacePlane = Schema.Enums(DeepDiveSurfacePlaneValue)

/**
 * @since 0.1.0
 */
export type DeepDiveSurfacePlane = typeof DeepDiveSurfacePlane.Type

/**
 * Identifies which visible pane is focused in compact deep-dive layouts.
 *
 * @since 0.1.0
 */
export enum DeepDiveFocusedPaneValue {
  Primary = "primary",
  Secondary = "secondary"
}

export const DeepDivePanePercentDefault = 58
export const DeepDivePanePercentMax = 72
export const DeepDivePanePercentMin = 34

/**
 * @since 0.1.0
 */
export const DeepDiveFocusedPane = Schema.Enums(DeepDiveFocusedPaneValue)

/**
 * @since 0.1.0
 */
export type DeepDiveFocusedPane = typeof DeepDiveFocusedPane.Type

/**
 * Percent width reserved for the primary deep-dive projection pane.
 *
 * @since 0.1.0
 */
export const DeepDivePanePercent = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(DeepDivePanePercentMin),
  Schema.lessThanOrEqualTo(DeepDivePanePercentMax)
)

/**
 * @since 0.1.0
 */
export type DeepDivePanePercent = typeof DeepDivePanePercent.Type

/**
 * Pane scroll behavior controlling overflow via Tailwind utilities.
 *
 * @since 0.1.0
 */
export const PaneScroll = Schema.Literal("vertical", "horizontal", "both", "none")

/**
 * @since 0.1.0
 */
export type PaneScroll = typeof PaneScroll.Type

/**
 * Content card border geometry.
 *
 * - `rounded`: full border with rounded corners (default)
 * - `left-accent`: left border only, square corners
 *
 * @since 0.1.0
 */
export const ContentCardShape = Schema.Literal("rounded", "left-accent")

/**
 * @since 0.1.0
 */
export type ContentCardShape = typeof ContentCardShape.Type

/**
 * Content card density controlling inner gap and padding.
 *
 * @since 0.1.0
 */
export const ContentCardDensity = Schema.Literal("compact", "standard")

/**
 * @since 0.1.0
 */
export type ContentCardDensity = typeof ContentCardDensity.Type
