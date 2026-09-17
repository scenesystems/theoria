import { Boolean as Bool, Chunk, Equal, Number as Num, Option, Schema, Tuple } from "effect"
import * as Arr from "effect/Array"

import * as Geometry from "@scenesystems/effect-math/Geometry"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Statistics from "@scenesystems/effect-math/Statistics"
import * as Text from "@scenesystems/effect-text/Text"

import { PlaceLine, PlaceMarker } from "../imagined-place-result.js"
import { ParticipantRole, PlaceFeature } from "../imagined-place.js"
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

const PlaceMarkers = Schema.Array(PlaceMarker)
type PlaceMarkers = typeof PlaceMarkers.Type

const PlaceFeatures = Schema.Array(PlaceFeature)
type PlaceFeatures = typeof PlaceFeatures.Type

const OptionalParticipants = Schema.Array(Schema.OptionFromSelf(ParticipantRole))
type OptionalParticipants = typeof OptionalParticipants.Type

const PlaceLines = Schema.Array(PlaceLine)
type PlaceLines = typeof PlaceLines.Type

const LineGeometry = Schema.Array(PlaceLine.pipe(Schema.omit("text")))
type LineGeometry = typeof LineGeometry.Type

const MarkerPair = Schema.Tuple(PlaceMarker, PlaceMarker)
type MarkerPair = typeof MarkerPair.Type

const MarkerPairs = Schema.Array(MarkerPair)
type MarkerPairs = typeof MarkerPairs.Type

/** The text role the description is set in; its line height shapes the stage. */
export const placeTextRole: TextRole = "stage-prose"

/** The Arrange column at a 320 px viewport is 254 px wide; the stage must fit inside it. */
export const stageMinWidth = 240
export const stageMaxWidth = 900
export const stagePadding = 16

/** A narrow stage still needs room for the whole description in one column. */
const stageMinHeight = 640

/** The working canvas for a stage width; the rendered stage is cut down to what is used. */
export const stageFor = (requestedWidth: number): Stage => {
  const stageWidth = Num.round(Num.clamp(requestedWidth, { minimum: stageMinWidth, maximum: stageMaxWidth }), 0)
  return {
    stageWidth,
    stageHeight: Num.round(Num.max(stageMinHeight, Num.multiply(stageWidth, 1.1)), 0),
    padding: stagePadding,
    lineHeight: semanticsFor(placeTextRole).lineHeight
  }
}

/**
 * The clear space the prose keeps from a disc, all the way round: beside it,
 * where a line stops short; above and below it, where a line whose band the
 * disc comes within this of is narrowed too. Also the least two discs are
 * apart. The stage draws to a tenth of a pixel, so a gap this wide is what
 * keeps a glyph off a disc's edge however the drawing is rounded.
 *
 * @since 0.4.0
 */
export const markerGap = 10

/**
 * The least a line of prose is ever set to: the geometry keeps every disc's
 * left edge at least this and the gap from the padding, so the flow never has
 * to choose between a line too short to hold a word and one run under a disc.
 *
 * @since 0.4.0
 */
export const minimumLineWidth = 60

/**
 * The least `x` a disc of this radius may stand at: on the padded stage, and
 * leaving the least line and the gap beside it. One rule for a disc landed
 * and a disc on its way.
 */
const leastX = (stage: Stage, radius: number): number =>
  Num.sumAll(Arr.make(stage.padding, minimumLineWidth, markerGap, radius))

/**
 * The largest disc this stage has room for between the least line and the
 * right padding. Every disc the geometry places is well within it; one brought
 * from a wider stage on the way is held to it, so the rule about the least line
 * holds at every step and not only where the drawing lands.
 */
const largestRadius = (stage: Stage): number =>
  Num.unsafeDivide(Num.subtract(Num.subtract(stage.stageWidth, stage.padding), leastX(stage, 0)), 2)

/** Between 4.5% and 8% of the stage width: big enough for a name at 640 px, a number at 240 px. */
export const markerRadius = (stage: Stage, weight: number): number =>
  Num.multiply(stage.stageWidth, Num.sum(0.045, Num.multiply(0.035, weight)))

/** The least a pointer target is across, in CSS px (WCAG 2.5.8 and the platforms' own guidance). */
export const minimumTouchTarget = 44

/**
 * How far past its edge a disc answers to a touch: what its radius lacks of
 * half the minimum target, nothing for a disc already that large. The reach
 * is invisible and the drawing is not changed by it, but it is the disc's:
 * the geometry keeps two discs' reaches from overlapping as it keeps the
 * discs themselves apart, so a touch beside a small disc is that disc's alone.
 */
export const touchReach = (radius: number): number =>
  Num.max(0, Num.subtract(Num.unsafeDivide(minimumTouchTarget, 2), radius))

/** Two touch targets never meet: a touch at the edge of one is not a coin toss between it and its neighbour. */
export const touchGap = 2

const lerp = (from: number, to: number, t: number): number => Num.sum(from, Num.multiply(Num.subtract(to, from), t))

/**
 * The least `y` at which a marker of this radius and reach at this `x` clears
 * every marker already placed — by the gap, and by the two reaches where
 * those ask for more; `low` when none is in the way.
 */
const clearanceBelow = (placed: PlaceMarkers, x: number, radius: number, reach: number, low: number) =>
  Arr.reduce(placed, low, (y, other) => {
    const needed = Num.max(
      Num.sumAll(Arr.make(other.radius, radius, markerGap)),
      Num.sumAll(Arr.make(other.radius, other.reach, radius, reach, touchGap))
    )
    const dx = Numeric.abs(Num.subtract(other.x, x))
    return Bool.match(Num.greaterThanOrEqualTo(dx, needed), {
      onTrue: () => y,
      onFalse: () =>
        Num.max(
          y,
          Num.sum(other.y, Numeric.sqrt(Num.subtract(Num.multiply(needed, needed), Num.multiply(dx, dx))))
        )
    })
  })

/**
 * Converts a meander into pixel markers. Features from accepted proposals keep
 * their proposer so the stage can show who added them. Markers never leave the
 * padded stage horizontally, never cross its top, and never overlap — nor do
 * their touch targets: each one is pushed down just far enough to clear
 * those before it. These are invariants of the geometry, not something the
 * search has to discover.
 */
export const placeMarkers = (
  features: PlaceFeatures,
  contributors: OptionalParticipants,
  stage: Stage,
  meander: Meander
): PlaceMarkers => {
  const w = stage.stageWidth
  const span = Num.max(1, Num.decrement(Arr.length(features)))
  return Arr.reduce(features, Arr.empty<PlaceMarker>(), (placed, feature, index) => {
    const t = Num.unsafeDivide(index, span)
    const radius = markerRadius(stage, feature.weight)
    const reach = touchReach(radius)
    const x = Num.clamp(
      Num.multiply(
        w,
        Num.sum(
          meander.edge,
          Num.multiply(
            meander.swing,
            Numeric.sin(Num.sum(meander.phase, Num.multiplyAll(Arr.make(t, meander.turns, Numeric.pi))))
          )
        )
      ),
      {
        minimum: leastX(stage, radius),
        maximum: Num.subtract(Num.subtract(w, stage.padding), radius)
      }
    )
    const y = clearanceBelow(
      placed,
      x,
      radius,
      reach,
      Num.max(
        Num.sum(stage.padding, radius),
        Num.multiply(w, Num.sum(meander.top, Num.multiply(index, meander.step)))
      )
    )
    const marker: PlaceMarker = { name: feature.name, description: feature.description, x, y, radius, reach }
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
 * feature just merged — grows in where it will stand; one only in `from` — a
 * feature declined, or gone with the story — shrinks away where it stood, the
 * mirror of an arrival, and is gone at the end. Leavers come after every
 * marker of `to`, so the discs that stay keep their numbers on the way. Every
 * step keeps what `placeMarkers` keeps: the markers stay on the padded stage
 * and never overlap, each pushed down just far enough to clear those before
 * it, so the text can be flowed around every step — around what is leaving
 * as much as what is arriving, so nothing on the stage is ever under a word.
 * `from` and `to` that are clear already are returned as they are at either end.
 *
 * A marker's reach travels with it as its radius does, from the reach it has
 * in `from` — a disc part-way grown has part of its reach — so a travel that
 * is interrupted and starts again from where the drawing was carries on from
 * there. A marker absent at either end has no radius and no reach there.
 *
 * @since 0.3.0
 */
export const markersBetween = (stage: Stage) => (from: PlaceMarkers, to: PlaceMarkers, t: number): PlaceMarkers => {
  const named = (markers: PlaceMarkers, name: string) =>
    Arr.findFirst(markers, (marker) => Equal.equals(marker.name, name))
  const absent = (marker: PlaceMarker): PlaceMarker => ({ ...marker, radius: 0, reach: 0 })
  const place = (placed: PlaceMarkers, start: PlaceMarker, target: PlaceMarker) => {
    const radius = Num.min(largestRadius(stage), lerp(start.radius, target.radius, t))
    const reach = lerp(start.reach, target.reach, t)
    const x = Num.clamp(lerp(start.x, target.x, t), {
      minimum: leastX(stage, radius),
      maximum: Num.subtract(Num.subtract(stage.stageWidth, stage.padding), radius)
    })
    const y = clearanceBelow(
      placed,
      x,
      radius,
      reach,
      Num.max(Num.sum(stage.padding, radius), lerp(start.y, target.y, t))
    )
    return Arr.append(placed, { ...target, x, y, radius, reach })
  }
  const staying = Arr.reduce(
    to,
    Arr.empty<PlaceMarker>(),
    (placed, target) => place(placed, Option.getOrElse(named(from, target.name), () => absent(target)), target)
  )
  const leaving = Arr.filter(from, (marker) => Option.isNone(named(to, marker.name)))
  return Bool.match(Num.greaterThanOrEqualTo(t, 1), {
    onTrue: () => staying,
    onFalse: () => Arr.reduce(leaving, staying, (placed, start) => place(placed, start, absent(start)))
  })
}

/**
 * What the stage draws by hand and travels between arrangements: the discs,
 * and the height of the paper they stand on. The two travel as one value so
 * the paper's edge arrives with the discs — never before them, cutting one
 * off; never after, breathing with the prose reflowing around them.
 *
 * @since 0.3.0
 */
export class PlaceDrawing extends Schema.Class<PlaceDrawing>("@theoria/app/contracts/ImaginedPlaceFlow/PlaceDrawing")({
  markers: PlaceMarkers,
  paper: Schema.Number
}) {}

/**
 * The drawing scaled as one piece about the stage's origin: every disc's
 * place and size, and the paper's edge, by the same factor — the drawing as
 * it is shown when the stage it was drawn for is shown fitted to a narrower
 * column.
 *
 * @since 0.4.0
 */
export const drawingScaled = (drawing: PlaceDrawing, scale: number): PlaceDrawing =>
  new PlaceDrawing({
    markers: Arr.map(drawing.markers, (marker) => ({
      ...marker,
      x: Num.multiply(marker.x, scale),
      y: Num.multiply(marker.y, scale),
      radius: Num.multiply(marker.radius, scale),
      reach: Num.multiply(marker.reach, scale)
    })),
    paper: Num.multiply(drawing.paper, scale)
  })

/** The least paper these discs stand on whole: the lowest edge of any, and the stage's padding below it. */
export const paperUnder = (stage: Stage, markers: PlaceMarkers): number =>
  Num.sum(
    Arr.reduce(markers, 0, (low, marker) => Num.max(low, Num.sum(marker.y, marker.radius))),
    stage.padding
  )

/**
 * The drawing set on this stage by the rules every drawing on it keeps: no
 * disc over the padding or the least line beside it, no two discs within
 * the gap of each other, and paper enough for every disc to stand on whole.
 * A drawing scaled to fit a narrower stage was drawn by another stage's
 * rules — the least line does not scale with the discs — so it is set on
 * the new stage before the prose is flowed around it. A drawing already on
 * its stage's rules is left exactly as it is.
 *
 * @since 0.4.0
 */
export const drawingOnStage = (stage: Stage, drawing: PlaceDrawing): PlaceDrawing => {
  const markers = markersBetween(stage)(drawing.markers, drawing.markers, 1)
  return new PlaceDrawing({ markers, paper: Num.max(drawing.paper, paperUnder(stage, markers)) })
}

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
  prepared: Text.WithSegments,
  features: PlaceFeatures
): number => {
  const column = Num.subtract(stage.stageWidth, Num.multiply(2, stage.padding))
  const proseLines = Arr.length(flowLines(prepared, stage, Arr.empty<PlaceMarker>()))
  const displacedLines = Arr.reduce(features, 0, (lines, feature) => {
    const diameter = Num.multiply(2, markerRadius(stage, feature.weight))
    return Num.sum(
      lines,
      Num.multiply(
        Num.unsafeDivide(Num.sum(diameter, Num.multiply(2, markerGap)), stage.lineHeight),
        Num.unsafeDivide(Num.sum(diameter, markerGap), column)
      )
    )
  })
  return Num.sum(
    Num.multiply(Numeric.ceil(Num.sum(proseLines, displacedLines)), stage.lineHeight),
    Num.multiply(2, stage.padding)
  )
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
 * line's — or come within the gap of it, and so narrow it: the one rule the
 * flow keeps, asked of one line. A line with none beside it runs the column's
 * full width. The gap counts above and below as it does beside, so a disc
 * whose edge meets a band's boundary narrows that band's line too, and no
 * glyph is set against a disc's edge. The same question a projection answers,
 * since its padding and line height are the stage's.
 *
 * @since 0.3.0
 */
export const markersBeside = (
  stage: LineBands,
  markers: PlaceMarkers,
  lineIndex: number
): PlaceMarkers => {
  const top = Num.sum(stage.padding, Num.multiply(lineIndex, stage.lineHeight))
  const bottom = Num.sum(top, stage.lineHeight)
  return Arr.filter(
    markers,
    (marker) =>
      Bool.match(
        Num.lessThan(Num.subtract(Num.subtract(marker.y, marker.radius), markerGap), bottom),
        {
          onFalse: () => false,
          onTrue: () => Num.greaterThan(Num.sumAll(Arr.make(marker.y, marker.radius, markerGap)), top)
        }
      )
  )
}

/**
 * The description flows from the top-left and stops short of any marker that
 * intrudes into a line's band, so text wraps around the features. The
 * resolver is what `Text.linesWith` calls once per line. The geometry
 * keeps every marker's left edge past the least line and the gap, so the
 * floor is never what sets a line's width for markers it placed; it stands for
 * markers from elsewhere, so the flow still lays out whole words.
 */
export const lineWidthFor = (stage: Stage, markers: PlaceMarkers) => (lineIndex: number): number => {
  const fullWidth = Num.subtract(stage.stageWidth, Num.multiply(2, stage.padding))
  const limit = Arr.reduce(
    markersBeside(stage, markers, lineIndex),
    fullWidth,
    (width, marker) =>
      Num.min(width, Num.subtract(Num.subtract(Num.subtract(marker.x, marker.radius), markerGap), stage.padding))
  )
  return Num.max(minimumLineWidth, limit)
}

export const flowLines = (
  prepared: Text.WithSegments,
  stage: Stage,
  markers: PlaceMarkers
): PlaceLines => {
  const widthFor = lineWidthFor(stage, markers)
  return Arr.map(
    Text.linesWith(
      prepared,
      { maxWidth: Num.subtract(stage.stageWidth, Num.multiply(2, stage.padding)), lineHeight: stage.lineHeight },
      widthFor
    ),
    (line, index) => ({
      text: line.text,
      y: Num.sum(stage.padding, Num.multiply(index, stage.lineHeight)),
      maxWidth: widthFor(index),
      width: line.width
    })
  )
}

const centre = (marker: PlaceMarker) => Chunk.make(marker.x, marker.y)

const pairs = (markers: PlaceMarkers): MarkerPairs =>
  Arr.flatMap(markers, (a, index) => Arr.map(Arr.drop(markers, Num.increment(index)), (b) => Tuple.make(a, b)))

/** Smallest centre-to-centre distance as a fraction of the stage width. */
export const minimumSeparation = (stage: Stage, markers: PlaceMarkers): number =>
  Num.unsafeDivide(
    Option.getOrElse(
      Statistics.minimum(
        Chunk.fromIterable(
          Arr.map(pairs(markers), (pair) =>
            Geometry.euclideanDistance(centre(Tuple.getFirst(pair)), centre(Tuple.getSecond(pair))))
        )
      ),
      () =>
        stage.stageWidth
    ),
    stage.stageWidth
  )

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
  markers: PlaceMarkers,
  lines: LineGeometry
): FlowQuality => {
  const w = stage.stageWidth
  const column = Num.subtract(w, Num.multiply(2, stage.padding))

  const offStage = Arr.reduce(markers, 0, (total, m) => {
    const over = Num.unsafeDivide(
      Num.max(0, Num.subtract(Num.sum(m.y, m.radius), Num.subtract(stage.stageHeight, stage.padding))),
      w
    )
    return Num.sum(total, Num.multiplyAll(Arr.make(over, over, 200)))
  })

  const fractions = Arr.map(lines, (line) => Num.unsafeDivide(line.maxWidth, column))
  const narrowestLine = Option.getOrElse(Statistics.minimum(Chunk.fromIterable(fractions)), () => 1)
  const squeeze = Arr.reduce(fractions, 0, (total, fraction) => {
    const narrowed = Num.max(0, Num.subtract(0.4, fraction))
    return Num.sum(total, Num.multiplyAll(Arr.make(narrowed, narrowed, 40)))
  })
  const overflow = Arr.reduce(
    lines,
    0,
    (total, line) =>
      Num.sum(
        total,
        Bool.match(
          Num.greaterThan(Num.sum(line.y, stage.lineHeight), Num.subtract(stage.stageHeight, stage.padding)),
          { onTrue: () => 1, onFalse: () => 0 }
        )
      )
  )
  const body = Arr.dropRight(Arr.map(lines, (line) => Num.unsafeDivide(line.width, column)), 1)
  const raggedness = Bool.match(Num.greaterThan(Arr.length(body), 1), {
    onTrue: () => Statistics.standardDeviation(Chunk.fromIterable(body)),
    onFalse: () => 0
  })
  const compactness = Num.unsafeDivide(occupiedHeight(stage, markers, lines), w)

  return {
    loss: Num.sumAll(
      Arr.make(offStage, squeeze, overflow, Num.multiply(raggedness, 0.5), Num.multiply(compactness, 3))
    ),
    lineCount: Arr.length(lines),
    narrowestLine: Num.min(1, narrowestLine),
    raggedness
  }
}

/** Scores the canonical line breaks without constructing visual strings for unrendered trials. */
export const measureFlowQuality = (
  prepared: Text.WithSegments,
  stage: Stage,
  markers: PlaceMarkers
): FlowQuality => {
  const widthFor = lineWidthFor(stage, markers)
  const ranges = Text.ranges(
    prepared,
    { maxWidth: Num.subtract(stage.stageWidth, Num.multiply(2, stage.padding)), lineHeight: stage.lineHeight },
    widthFor
  )
  return flowQuality(
    stage,
    markers,
    Arr.map(ranges, (line, index) => ({
      y: Num.sum(stage.padding, Num.multiply(index, stage.lineHeight)),
      maxWidth: widthFor(index),
      width: line.width
    }))
  )
}

/**
 * How much vertical room the arrangement uses. Rewarding compactness is what
 * pulls the markers up into the text so the description has to flow around
 * them; the stage is then cut to this height.
 */
export const occupiedHeight = (
  stage: Stage,
  markers: PlaceMarkers,
  lines: LineGeometry
): number => {
  const textBottom = Option.match(Arr.last(lines), {
    onNone: () => stage.padding,
    onSome: (line) => Num.sum(line.y, stage.lineHeight)
  })
  return Arr.reduce(markers, textBottom, (bottom, marker) => Num.max(bottom, Num.sum(marker.y, marker.radius)))
}
