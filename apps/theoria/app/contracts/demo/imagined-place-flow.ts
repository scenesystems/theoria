import { Chunk, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import * as Geometry from "@scenesystems/effect-math/Geometry"
import * as Statistics from "@scenesystems/effect-math/Statistics"
import { Text } from "@scenesystems/effect-text"

import type { PlaceLine, PlaceMarker } from "../imagined-place-result.js"
import type { ParticipantRole, PlaceFeature } from "../imagined-place.js"
import { semanticsFor, type TextRole } from "../text.js"

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

/**
 * Where the markers go: along a meander down the right-hand side of the
 * stage. Six numbers describe it whatever the feature count, which keeps the
 * search small; the text then has to flow around whatever curve is chosen.
 * All values are fractions of the stage width.
 */
export const Meander = Schema.Struct({
  edge: Schema.Number,
  swing: Schema.Number,
  phase: Schema.Number,
  turns: Schema.Number,
  top: Schema.Number,
  step: Schema.Number
})
export type Meander = typeof Meander.Type

type Bounds = readonly [low: number, high: number]

export const meanderBounds: Record<keyof Meander, Bounds> = {
  edge: [0.5, 0.9],
  swing: [0, 0.3],
  phase: [-Math.PI, Math.PI],
  turns: [0.5, 2.5],
  top: [0.04, 0.6],
  step: [0.03, 0.24]
}

const clamp = (low: number, high: number, value: number): number => Math.min(high, Math.max(low, value))

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
 * The description flows from the top-left and stops short of any marker that
 * intrudes into a line's band, so text wraps around the features. The
 * resolver is what `Text.layoutLinesWith` calls once per line.
 */
export const lineWidthFor = (stage: Stage, markers: ReadonlyArray<PlaceMarker>) => (lineIndex: number): number => {
  const top = stage.padding + lineIndex * stage.lineHeight
  const bottom = top + stage.lineHeight
  const fullWidth = stage.stageWidth - 2 * stage.padding
  const limit = Arr.reduce(markers, fullWidth, (width, marker) => {
    const intrudes = marker.y - marker.radius < bottom && marker.y + marker.radius > top
    return intrudes ? Math.min(width, marker.x - marker.radius - markerGap - stage.padding) : width
  })
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
