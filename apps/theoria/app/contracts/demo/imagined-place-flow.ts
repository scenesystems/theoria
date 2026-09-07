import { Chunk, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import * as Geometry from "@scenesystems/effect-math/Geometry"
import * as Statistics from "@scenesystems/effect-math/Statistics"
import { Text } from "@scenesystems/effect-text"

import { type PlaceLine, PlaceMarker } from "../imagined-place-result.js"
import type { ParticipantRole, PlaceFeature } from "../imagined-place.js"
import { semanticsFor, type TextRole } from "../text.js"

import type { Meander } from "./imagined-place-search.js"

/**
 * Pure geometry and text flow for one stage. Everything here is a function of
 * the artifact and a candidate arrangement, so the search can call it once per
 * trial without touching any service. Server and browser share it; only the
 * text measurer differs.
 */
export const Stage = Schema.Struct({
  stageWidth: Schema.Number,
  stageHeight: Schema.Number,
  padding: Schema.Number,
  lineHeight: Schema.Number
})
export type Stage = typeof Stage.Type

/** The text role the description is set in; its line height shapes the stage. */
export const placeTextRole: TextRole = "card-summary"

/** The Arrange column at a 320 px viewport is 254 px wide; the stage must fit inside it. */
export const stageMinWidth = 240
export const stageMaxWidth = 900
export const stagePadding = 16

/** A narrow stage still needs room for the whole description in one column. */
const stageMinHeight = 640

/** The working canvas for a stage width; the rendered stage is cut down to what is used. */
export const stageFor = (requestedWidth: number): Stage => {
  const stageWidth = Math.round(Math.min(stageMaxWidth, Math.max(stageMinWidth, requestedWidth)))
  return {
    stageWidth,
    stageHeight: Math.round(Math.max(stageMinHeight, stageWidth * 1.1)),
    padding: stagePadding,
    lineHeight: semanticsFor(placeTextRole).lineHeight
  }
}

const markerGap = 10
const minimumLineWidth = 60

/** Between 4.5% and 8% of the stage width: big enough for a name at 640 px, a number at 240 px. */
export const markerRadius = (stage: Stage, weight: number): number => stage.stageWidth * (0.045 + 0.035 * weight)

const clamp = (low: number, high: number, value: number): number => Math.min(high, Math.max(low, value))

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t

/**
 * The least `y` at which a marker of this radius at this `x` clears every
 * marker already placed by the gap; `low` when none is in the way.
 */
const clearanceBelow = (placed: ReadonlyArray<PlaceMarker>, x: number, radius: number, low: number): number =>
  Arr.reduce(placed, low, (y, other) => {
    const needed = other.radius + radius + markerGap
    const dx = Math.abs(other.x - x)
    return dx >= needed ? y : Math.max(y, other.y + Math.sqrt(needed * needed - dx * dx))
  })

/**
 * Converts a meander into pixel markers. Features from accepted proposals keep
 * their proposer so the stage can show who added them. Markers never leave the
 * padded stage horizontally, never cross its top, and never overlap: each one
 * is pushed down just far enough to clear those before it. These are
 * invariants of the geometry, not something the search has to discover.
 */
export const placeMarkers = (
  features: ReadonlyArray<PlaceFeature>,
  contributors: ReadonlyArray<Option.Option<ParticipantRole>>,
  stage: Stage,
  meander: Meander
): ReadonlyArray<PlaceMarker> => {
  const w = stage.stageWidth
  const span = Math.max(1, features.length - 1)
  return Arr.reduce(features, Arr.empty<PlaceMarker>(), (placed, feature, index) => {
    const t = index / span
    const radius = markerRadius(stage, feature.weight)
    const x = clamp(
      stage.padding + radius,
      w - stage.padding - radius,
      w * (meander.edge + meander.swing * Math.sin(meander.phase + t * meander.turns * Math.PI))
    )
    const y = clearanceBelow(
      placed,
      x,
      radius,
      Math.max(stage.padding + radius, w * (meander.top + index * meander.step))
    )
    const marker: PlaceMarker = { name: feature.name, description: feature.description, x, y, radius }
    return Arr.append(
      placed,
      Option.match(Arr.get(contributors, index).pipe(Option.flatten), {
        onNone: () => marker,
        onSome: (contributedBy) => ({ ...marker, contributedBy })
      })
    )
  })
}

/**
 * The markers `t` of the way from one arrangement to another, `t` in [0, 1]:
 * how the stage travels between what the search finds instead of jumping. A
 * marker in both moves straight and its radius follows; one only in `to` — a
 * feature just merged — grows in where it will stand; one only in `from` has
 * already left. Every step keeps what `placeMarkers` keeps: the markers stay
 * on the padded stage and never overlap, each pushed down just far enough to
 * clear those before it, so the text can be flowed around every step. `from`
 * and `to` that are clear already are returned as they are at either end.
 *
 * @since 0.3.0
 */
export const markersBetween =
  (stage: Stage) =>
  (from: ReadonlyArray<PlaceMarker>, to: ReadonlyArray<PlaceMarker>, t: number): ReadonlyArray<PlaceMarker> =>
    Arr.reduce(to, Arr.empty<PlaceMarker>(), (placed, target) => {
      const start = Option.getOrElse(
        Arr.findFirst(from, (marker) => marker.name === target.name),
        (): PlaceMarker => ({ ...target, radius: 0 })
      )
      const radius = lerp(start.radius, target.radius, t)
      const x = clamp(stage.padding + radius, stage.stageWidth - stage.padding - radius, lerp(start.x, target.x, t))
      const y = clearanceBelow(placed, x, radius, Math.max(stage.padding + radius, lerp(start.y, target.y, t)))
      return Arr.append(placed, { ...target, x, y, radius })
    })

/**
 * What the stage draws by hand and travels between arrangements: the discs,
 * and the height of the paper they stand on. The two travel as one value so
 * the paper's edge arrives with the discs — never before them, cutting one
 * off; never after, breathing with the prose reflowing around them.
 *
 * @since 0.3.0
 */
export class PlaceDrawing extends Schema.Class<PlaceDrawing>("PlaceDrawing")({
  markers: Schema.Array(PlaceMarker),
  paper: Schema.Number
}) {}

/** The least paper these discs stand on whole: the lowest edge of any, and the stage's padding below it. */
export const paperUnder = (stage: Stage, markers: ReadonlyArray<PlaceMarker>): number =>
  Arr.reduce(markers, 0, (low, marker) => Math.max(low, marker.y + marker.radius)) + stage.padding

/**
 * The paper a search of these features is expected to want on this stage,
 * before it has run: the description flowed with nothing in its way, and the
 * lines the discs take out of the column — each as if it stood at the
 * column's edge, its diameter and the gap around it cut from as many lines
 * as it is tall. The search decides the true paper and the drawing lands
 * there; until it does, the paper is held at this, so nothing around the
 * stage moves for a trial. Wrapped lines never quite fill the column, so
 * this runs a line or two short rather than long.
 *
 * @since 0.3.0
 */
export const paperExpected = (
  stage: Stage,
  prepared: Text.PreparedTextWithSegments,
  features: ReadonlyArray<PlaceFeature>
): number => {
  const column = stage.stageWidth - 2 * stage.padding
  const proseLines = flowLines(prepared, stage, []).length
  const displacedLines = Arr.reduce(features, 0, (lines, feature) => {
    const diameter = 2 * markerRadius(stage, feature.weight)
    return lines + (diameter / stage.lineHeight) * ((diameter + markerGap) / column)
  })
  return Math.ceil(proseLines + displacedLines) * stage.lineHeight + 2 * stage.padding
}

/**
 * The drawing `t` of the way between two: the discs by `markersBetween`, with
 * the geometry's rules kept at every step; the paper's edge in a straight
 * line, since a single length has no rules to keep.
 *
 * @since 0.3.0
 */
export const drawingBetween = (stage: Stage) => {
  const markers = markersBetween(stage)
  return (from: PlaceDrawing, to: PlaceDrawing, t: number): PlaceDrawing =>
    new PlaceDrawing({ markers: markers(from.markers, to.markers, t), paper: lerp(from.paper, to.paper, t) })
}

/** The lines of prose are set from the padding down, one line height each; this is what a line's band is. */
export const LineBands = Stage.pick("padding", "lineHeight")
export type LineBands = typeof LineBands.Type

/**
 * The markers that stand in a line's band — between its top and the next
 * line's — and so narrow it: the one rule the flow keeps, asked of one line.
 * A line with none beside it runs the column's full width. The same question
 * a projection answers, since its padding and line height are the stage's.
 *
 * @since 0.3.0
 */
export const markersBeside = (
  stage: LineBands,
  markers: ReadonlyArray<PlaceMarker>,
  lineIndex: number
): ReadonlyArray<PlaceMarker> => {
  const top = stage.padding + lineIndex * stage.lineHeight
  const bottom = top + stage.lineHeight
  return Arr.filter(markers, (marker) => marker.y - marker.radius < bottom && marker.y + marker.radius > top)
}

/**
 * The description flows from the top-left and stops short of any marker that
 * intrudes into a line's band, so text wraps around the features. The
 * resolver is what `Text.layoutLinesWith` calls once per line.
 */
export const lineWidthFor = (stage: Stage, markers: ReadonlyArray<PlaceMarker>) => (lineIndex: number): number => {
  const fullWidth = stage.stageWidth - 2 * stage.padding
  const limit = Arr.reduce(
    markersBeside(stage, markers, lineIndex),
    fullWidth,
    (width, marker) => Math.min(width, marker.x - marker.radius - markerGap - stage.padding)
  )
  return Math.max(minimumLineWidth, limit)
}

export const flowLines = (
  prepared: Text.PreparedTextWithSegments,
  stage: Stage,
  markers: ReadonlyArray<PlaceMarker>
): ReadonlyArray<PlaceLine> => {
  const widthFor = lineWidthFor(stage, markers)
  return Arr.map(
    Text.layoutLinesWith(
      prepared,
      { maxWidth: stage.stageWidth - 2 * stage.padding, lineHeight: stage.lineHeight },
      widthFor
    ),
    (line, index) => ({
      text: line.text,
      y: stage.padding + index * stage.lineHeight,
      maxWidth: widthFor(index),
      width: line.width
    })
  )
}

const centre = (marker: PlaceMarker) => Chunk.make(marker.x, marker.y)

const pairs = (markers: ReadonlyArray<PlaceMarker>) =>
  Arr.flatMap(markers, (a, i) => Arr.map(Arr.drop(markers, i + 1), (b): readonly [PlaceMarker, PlaceMarker] => [a, b]))

/** Smallest centre-to-centre distance as a fraction of the stage width. */
export const minimumSeparation = (stage: Stage, markers: ReadonlyArray<PlaceMarker>): number =>
  Option.getOrElse(
    Statistics.minimum(
      Chunk.fromIterable(Arr.map(pairs(markers), ([a, b]) => Geometry.euclideanDistance(centre(a), centre(b))))
    ),
    () => stage.stageWidth
  ) / stage.stageWidth

export const FlowQuality = Schema.Struct({
  loss: Schema.Number,
  lineCount: Schema.Number,
  narrowestLine: Schema.Number,
  raggedness: Schema.Number
})
export type FlowQuality = typeof FlowQuality.Type

/**
 * How good an arrangement is. Markers pushed below the canvas, lines squeezed
 * below 40% of the column, and text that runs off the bottom all cost; ragged
 * line widths and vertical sprawl cost a little. Lower is better. Overlap and
 * side overrun are impossible by construction, so they are not scored.
 */
export const flowQuality = (
  stage: Stage,
  markers: ReadonlyArray<PlaceMarker>,
  lines: ReadonlyArray<PlaceLine>
): FlowQuality => {
  const w = stage.stageWidth
  const column = w - 2 * stage.padding

  const offStage = Arr.reduce(markers, 0, (total, m) => {
    const over = Math.max(0, m.y + m.radius - (stage.stageHeight - stage.padding)) / w
    return total + over * over * 200
  })

  const fractions = Arr.map(lines, (line) => line.maxWidth / column)
  const narrowestLine = Option.getOrElse(Statistics.minimum(Chunk.fromIterable(fractions)), () => 1)
  const squeeze = Arr.reduce(fractions, 0, (total, f) => total + Math.max(0, 0.4 - f) ** 2 * 40)
  const overflow = Arr.reduce(
    lines,
    0,
    (total, line) => total + (line.y + stage.lineHeight > stage.stageHeight - stage.padding ? 1 : 0)
  )
  const body = Arr.dropRight(Arr.map(lines, (line) => line.width / column), 1)
  const raggedness = body.length > 1 ? Statistics.standardDeviation(Chunk.fromIterable(body)) : 0
  const compactness = occupiedHeight(stage, markers, lines) / w

  return {
    loss: offStage + squeeze + overflow + raggedness * 0.5 + compactness * 3,
    lineCount: lines.length,
    narrowestLine: Math.min(1, narrowestLine),
    raggedness
  }
}

/**
 * How much vertical room the arrangement uses. Rewarding compactness is what
 * pulls the markers up into the text so the description has to flow around
 * them; the stage is then cut to this height.
 */
export const occupiedHeight = (
  stage: Stage,
  markers: ReadonlyArray<PlaceMarker>,
  lines: ReadonlyArray<PlaceLine>
): number => {
  const textBottom = Option.match(Arr.last(lines), {
    onNone: () => stage.padding,
    onSome: (line) => line.y + stage.lineHeight
  })
  return Arr.reduce(markers, textBottom, (bottom, marker) => Math.max(bottom, marker.y + marker.radius))
}
