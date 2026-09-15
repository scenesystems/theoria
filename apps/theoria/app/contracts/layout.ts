import { Match, Schema } from "effect"

/**
 * What a surface is for, which decides how it is drawn. The page is the
 * first: content sits directly on the canvas with no border, radius or
 * shadow. An instrument is a working area the visitor operates (a code
 * panel, a text field); an overlay floats above the page (a popover, an
 * answer to a mark); a sheet is a whole piece of paper laid over or into the
 * page (a dialog, a code example's frame), with the largest radius and the
 * deepest shadow; a drawer is a sheet attached to the viewport's edge, so it
 * has that edge and no radius.
 *
 * @since 0.1.0
 */
export const SurfaceRole = Schema.Literal("canvas", "instrument", "overlay", "sheet", "drawer")

/**
 * @since 0.1.0
 */
export type SurfaceRole = typeof SurfaceRole.Type

/**
 * The corner a thing may take, one per kind of thing: a mark in running text
 * (a washed word, an inline code chip); a control (a button, a field); an
 * instrument or an overlay; a sheet. Nothing on the page is rounded by any
 * other measure, save a circle.
 *
 * @since 0.4.0
 */
export const Radius = Schema.Literal("mark", "control", "instrument", "sheet")

/**
 * @since 0.4.0
 */
export type Radius = typeof Radius.Type

/**
 * @since 0.4.0
 */
export const radiusCss = (radius: Radius): string =>
  Match.value(radius).pipe(
    Match.when("mark", () => "0.375rem"),
    Match.when("control", () => "0.5rem"),
    Match.when("instrument", () => "0.75rem"),
    Match.when("sheet", () => "1.5rem"),
    Match.exhaustive
  )

/**
 * Content measures: a card's preferred width, a column of reading (an article),
 * the page's one column, and the documentation workbench with its rails.
 *
 * @since 0.4.0
 */
export const Measure = Schema.Literal("card", "reading", "page", "workbench")

/**
 * @since 0.4.0
 */
export type Measure = typeof Measure.Type

/**
 * @since 0.4.0
 */
export const measureCss = (measure: Measure): string =>
  Match.value(measure).pipe(
    Match.when("card", () => "26rem"),
    Match.when("reading", () => "54rem"),
    Match.when("page", () => "100rem"),
    Match.when("workbench", () => "96rem"),
    Match.exhaustive
  )

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

/**
 * What may stand over the page, lowest first: the band pinned over the
 * demonstration as it scrolls; an answer to a mark, opened over the band;
 * a preview of a docs link, opened from inside an answer; the workbench's
 * header, pinned over everything the page scrolls; the backdrop that dims
 * the page under a sheet; the sheet itself; a menu, which may be opened from
 * the header or from inside a sheet, over both. Each stands over everything
 * before it, so a thing opened from another is never behind it. The
 * literal's order is the stacking order and `elevationIndex` is held to it;
 * nothing else numbers a layer.
 *
 * @since 0.3.0
 */
export const Elevation = Schema.Literal("band", "answer", "preview", "header", "backdrop", "sheet", "menu")

/**
 * @since 0.3.0
 */
export type Elevation = typeof Elevation.Type

/**
 * The z-index of an elevation: its place in the order, in tens, so the
 * lowest stands over the page's own stacking and each is apart from the next.
 *
 * @since 0.4.0
 */
export const elevationIndex = (elevation: Elevation): number =>
  Match.value(elevation).pipe(
    Match.when("band", () => 10),
    Match.when("answer", () => 20),
    Match.when("preview", () => 30),
    Match.when("header", () => 40),
    Match.when("backdrop", () => 50),
    Match.when("sheet", () => 60),
    Match.when("menu", () => 70),
    Match.exhaustive
  )

/**
 * Whether a step of the story stands on the acts' spine — the rule down the
 * reading column, a dot on it marking the chosen step — or alone, as the
 * stage's own step does.
 *
 * @since 0.3.0
 */
export const StepSpine = Schema.Literal("spine", "none")

/**
 * @since 0.3.0
 */
export type StepSpine = typeof StepSpine.Type
