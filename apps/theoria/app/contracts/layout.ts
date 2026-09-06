import { Schema } from "effect"

/**
 * What a surface is for, which decides how it is drawn. There are three, and
 * the page is the first: content sits directly on the canvas with no border,
 * radius or shadow. An instrument is a working area the visitor operates
 * (a code panel, a text field); an overlay floats above the page (a popover).
 *
 * @since 0.1.0
 */
export const SurfaceRole = Schema.Literal("canvas", "instrument", "overlay")

/**
 * @since 0.1.0
 */
export type SurfaceRole = typeof SurfaceRole.Type

/**
 * Whether an artifact stage draws a frame around what it holds. On the canvas
 * the drawing is the page and has none; inside an instrument it has a hairline.
 *
 * @since 0.1.0
 */
export const ArtifactStageFrame = Schema.Literal("none", "instrument")

/**
 * @since 0.1.0
 */
export type ArtifactStageFrame = typeof ArtifactStageFrame.Type
