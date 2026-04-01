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
 * Deep-dive pane ordering for the expanded demo shell.
 *
 * @since 0.1.0
 */
export enum DeepDivePaneOrderValue {
  StageCode = "stage-code",
  CodeStage = "code-stage"
}

export enum DeepDiveFocusedPaneValue {
  Stage = "stage",
  Source = "source"
}

export const DeepDiveStagePanePercentDefault = 58
export const DeepDiveStagePanePercentMax = 72
export const DeepDiveStagePanePercentMin = 34

/**
 * @since 0.1.0
 */
export const DeepDivePaneOrder = Schema.Enums(DeepDivePaneOrderValue)

/**
 * @since 0.1.0
 */
export type DeepDivePaneOrder = typeof DeepDivePaneOrder.Type

/**
 * @since 0.1.0
 */
export const DeepDiveFocusedPane = Schema.Enums(DeepDiveFocusedPaneValue)

/**
 * @since 0.1.0
 */
export type DeepDiveFocusedPane = typeof DeepDiveFocusedPane.Type

/**
 * Percent width reserved for the interactive stage in the deep-dive split view.
 *
 * @since 0.1.0
 */
export const DeepDiveStagePanePercent = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(DeepDiveStagePanePercentMin),
  Schema.lessThanOrEqualTo(DeepDiveStagePanePercentMax)
)

/**
 * @since 0.1.0
 */
export type DeepDiveStagePanePercent = typeof DeepDiveStagePanePercent.Type

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
 * Content card density controlling inner gap and padding.
 *
 * @since 0.1.0
 */
export const ContentCardDensity = Schema.Literal("compact", "standard")

/**
 * @since 0.1.0
 */
export type ContentCardDensity = typeof ContentCardDensity.Type
