import { describe, expect, it } from "@effect/vitest"
import {
  Boolean as Bool,
  Effect,
  Equal,
  FastCheck,
  Layer,
  MutableRef,
  Number as Num,
  Option,
  Record,
  Schema,
  String as Str,
  Tuple
} from "effect"
import * as Arr from "effect/Array"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import { CanvasProfile, MeasurementCache, Text, TextMeasurer } from "@scenesystems/effect-text"

import {
  drawingOnStage,
  drawingScaled,
  flowLines,
  flowQuality,
  lineWidthFor,
  markerGap,
  markerRadius,
  markersBeside,
  markersBetween,
  measureFlowQuality,
  minimumLineWidth,
  minimumTouchTarget,
  paperExpected,
  paperUnder,
  PlaceDrawing,
  placeMarkers,
  type Stage,
  stageFor,
  touchGap,
  touchReach
} from "../../app/contracts/demo/imagined-place-flow.js"
import { meanderBounds } from "../../app/contracts/demo/imagined-place-optimization.js"
import { Meander } from "../../app/contracts/demo/imagined-place-search.js"
import { PlaceMarker } from "../../app/contracts/imagined-place-result.js"
import { ParticipantRole, PlaceFeature } from "../../app/contracts/imagined-place.js"

const PlaceFeatures = Schema.Array(PlaceFeature)
type PlaceFeatures = typeof PlaceFeatures.Type

const PlaceMarkers = Schema.Array(PlaceMarker)
type PlaceMarkers = typeof PlaceMarkers.Type

const OptionalParticipants = Schema.Array(Schema.OptionFromSelf(ParticipantRole))
type OptionalParticipants = typeof OptionalParticipants.Type

const Meanders = Schema.Array(Meander)
type Meanders = typeof Meanders.Type

const features: PlaceFeatures = Arr.makeBy(6, (index) => ({
  name: `Feature ${String(Num.increment(index))}`,
  description: "A feature.",
  weight: Bool.match(Equal.equals(Num.remainder(index, 2), 0), { onTrue: () => 1, onFalse: () => 0.2 })
}))

const noContributors: OptionalParticipants = Arr.map(features, () => Option.none())

/** Text measured at a fixed width per character, so the prose flows the same on every run. */
const fixedWidthText = Layer.mergeAll(
  Text.layerSegmenter,
  Layer.succeed(Text.CurrentProfile, CanvasProfile.monospace.engineProfile),
  MeasurementCache.layer.pipe(
    Layer.provide(
      Layer.succeed(TextMeasurer.TextMeasurer, {
        measure: (_font, text: string) => Effect.succeed(Num.multiply(Str.length(text), 5))
      })
    )
  )
)

/** The corners of the meander space are where the geometry is most stressed. */
const corner = (pick: 0 | 1): Meander => ({
  edge: Arr.unsafeGet(meanderBounds.edge, pick),
  swing: Arr.unsafeGet(meanderBounds.swing, pick),
  phase: Arr.unsafeGet(meanderBounds.phase, pick),
  turns: Arr.unsafeGet(meanderBounds.turns, pick),
  top: Arr.unsafeGet(meanderBounds.top, pick),
  step: Tuple.getFirst(meanderBounds.step)
})

const corners: Meanders = Arr.make(corner(0), corner(1))

/** The meander that leans furthest left: full swing, at the trough of the sine from the first feature on. */
const leftmost: Meander = {
  edge: Tuple.getFirst(meanderBounds.edge),
  swing: Tuple.getSecond(meanderBounds.swing),
  phase: Num.negate(Num.unsafeDivide(Numeric.pi, 2)),
  turns: Tuple.getFirst(meanderBounds.turns),
  top: Tuple.getFirst(meanderBounds.top),
  step: Tuple.getFirst(meanderBounds.step)
}

const distance = (a: PlaceMarker, b: PlaceMarker): number => {
  const dx = Num.subtract(a.x, b.x)
  const dy = Num.subtract(a.y, b.y)
  return Numeric.sqrt(Num.sum(Num.multiply(dx, dx), Num.multiply(dy, dy)))
}

const expectWellPlaced = (stage: Stage, markers: PlaceMarkers) => {
  Arr.forEach(markers, (m) => {
    expect(Num.subtract(m.x, m.radius)).toBeGreaterThanOrEqual(
      Num.subtract(Num.sumAll(Arr.make(stage.padding, minimumLineWidth, markerGap)), 1e-9)
    )
    expect(Num.sum(m.x, m.radius)).toBeLessThanOrEqual(
      Num.sum(Num.subtract(stage.stageWidth, stage.padding), 1e-9)
    )
    expect(Num.subtract(m.y, m.radius)).toBeGreaterThanOrEqual(Num.subtract(stage.padding, 1e-9))
  })

  Arr.forEach(markers, (a, i) =>
    Arr.forEach(Arr.drop(markers, Num.increment(i)), (b) => {
      expect(distance(a, b)).toBeGreaterThanOrEqual(
        Num.subtract(Num.sumAll(Arr.make(a.radius, b.radius, 10)), 1e-9)
      )
    }))
}

/**
 * In a landed drawing two touch targets never meet either, so a touch beside
 * a small disc is that disc's alone, even at the target's edge. (On the way,
 * a disc growing in or shrinking away reaches for its target in proportion,
 * so this is asked of where the drawing lands, not of every step.)
 */
const expectTouchable = (markers: PlaceMarkers) =>
  Arr.forEach(markers, (a, i) => {
    expect(a.reach).toBe(touchReach(a.radius))
    Arr.forEach(Arr.drop(markers, Num.increment(i)), (b) => {
      expect(distance(a, b)).toBeGreaterThanOrEqual(
        Num.subtract(Num.sumAll(Arr.make(a.radius, a.reach, b.radius, b.reach, touchGap)), 1e-9)
      )
    })
  })

/** Steps of a travel between the two corners, as the stage would draw them. */
const steps = Arr.map(Arr.range(0, 10), (index) => Num.unsafeDivide(index, 10))

describe("Imagined place geometry contract", () => {
  it.effect("a disc's reach makes up what its radius lacks of a 44 px touch target, and nothing more", () =>
    Effect.sync(() => {
      const narrow = stageFor(240)
      const small = markerRadius(narrow, 0)
      expect(small).toBeLessThan(Num.unsafeDivide(minimumTouchTarget, 2))
      expect(Num.multiply(2, Num.sum(small, touchReach(small)))).toBeCloseTo(minimumTouchTarget, 10)
      expect(touchReach(Num.unsafeDivide(minimumTouchTarget, 2))).toBe(0)
      expect(touchReach(markerRadius(stageFor(900), 1))).toBe(0)
    }))

  it.effect("markers never overlap and never leave the padded stage, whatever the meander", () =>
    Effect.sync(() => {
      Arr.forEach(Arr.make(240, 640, 900), (width) => {
        const stage = stageFor(width)
        Arr.forEach(corners, (meander) => {
          const markers = placeMarkers(features, noContributors, stage, meander)
          expect(Arr.length(markers)).toBe(Arr.length(features))
          expectWellPlaced(stage, markers)
          expectTouchable(markers)
        })
      })
    }))

  it.effect("markers on their way between two arrangements keep the same rules at every step", () =>
    Effect.sync(() => {
      Arr.forEach(Arr.make(240, 640, 900), (width) => {
        const stage = stageFor(width)
        const between = markersBetween(stage)
        const from = placeMarkers(features, noContributors, stage, corner(0))
        const to = placeMarkers(features, noContributors, stage, corner(1))
        Arr.forEach(steps, (t) => {
          const drawn = between(from, to, t)
          expect(Arr.map(drawn, (m) => m.name)).toEqual(Arr.map(to, (m) => m.name))
          expectWellPlaced(stage, drawn)
        })
        expect(between(from, to, 0)).toEqual(from)
        expect(between(from, to, 1)).toEqual(to)
      })
    }))

  it.effect("a feature only in the destination grows in where it will stand; one only at the start shrinks away where it stood, after the rest", () =>
    Effect.sync(() => {
      const stage = stageFor(640)
      const between = markersBetween(stage)
      const from = placeMarkers(Arr.take(features, 5), Arr.take(noContributors, 5), stage, corner(0))
      const to = placeMarkers(Arr.drop(features, 1), Arr.drop(noContributors, 1), stage, corner(1))
      const halfway = between(from, to, 0.5)
      const arriving = Arr.findFirst(halfway, (m) => Equal.equals(m.name, "Feature 6"))
      const destination = Arr.findFirst(to, (m) => Equal.equals(m.name, "Feature 6"))
      expect(Option.map(arriving, (m) => m.radius)).toEqual(
        Option.map(destination, (m) => Num.unsafeDivide(m.radius, 2))
      )
      expect(Option.map(arriving, (m) => m.x)).toEqual(Option.map(destination, (m) => m.x))
      // The leaver is still drawn, half its size, where it stood — so the text is flowed around it while it
      // goes — and it is listed last, so every other disc keeps its number.
      const leaving = Arr.findFirst(halfway, (m) => Equal.equals(m.name, "Feature 1"))
      const origin = Arr.findFirst(from, (m) => Equal.equals(m.name, "Feature 1"))
      expect(Option.map(leaving, (m) => m.radius)).toEqual(
        Option.map(origin, (m) => Num.unsafeDivide(m.radius, 2))
      )
      expect(Option.map(leaving, (m) => m.x)).toEqual(Option.map(origin, (m) => m.x))
      expect(Arr.map(halfway, (m) => m.name)).toEqual(Arr.append(Arr.map(to, (m) => m.name), "Feature 1"))
      expectWellPlaced(stage, halfway)
      // At the start the leaver stands whole; at the end it is gone, and the drawing is the destination itself.
      const atStart = Arr.findFirst(between(from, to, 0), (m) => Equal.equals(m.name, "Feature 1"))
      expect(Option.map(atStart, (m) => m.radius)).toEqual(Option.map(origin, (m) => m.radius))
      expect(Option.map(atStart, (m) => m.x)).toEqual(Option.map(origin, (m) => m.x))
      expect(between(from, to, 1)).toEqual(to)
      Arr.forEach(steps, (t) => expectWellPlaced(stage, between(from, to, t)))
    }))

  it.effect("a feature arriving above a kept one clears it from the first step, so the drawing must rest before it travels", () =>
    Effect.sync(() => {
      // Two kept discs in a column, and a third arriving where the second stands: from the very first step
      // the second is pushed down to clear the newcomer's ring, even while that ring has no radius yet. This
      // is why a drawing whose prose is leaving rests as it was left instead of drawing step 0 of its travel.
      const stage = stageFor(640)
      const between = markersBetween(stage)
      const marker = (name: string, y: number): PlaceMarker => ({
        name,
        description: "",
        x: 100,
        y,
        radius: 20,
        reach: touchReach(20)
      })
      const from = Arr.make(marker("A", 100), marker("B", 200))
      const to = Arr.make(marker("A", 100), marker("N", 200), marker("B", 250))
      const atStart = between(from, to, 0)
      expect(Arr.map(atStart, (m) => m.name)).toEqual(Arr.make("A", "N", "B"))
      expect(Option.map(Arr.findFirst(atStart, (m) => Equal.equals(m.name, "B")), (m) => m.y)).not.toEqual(
        Option.some(200)
      )
      expectWellPlaced(stage, atStart)
    }))

  it.effect("a travel interrupted mid-arrival carries on from where the drawing was, reach and all", () =>
    Effect.sync(() => {
      // A disc growing in reaches for its touch target in proportion to its growth. When a new target
      // interrupts the travel, the next travel starts from the intermediate drawing: the half-grown disc
      // must keep its half-grown reach, not be reissued the full reach of a standing disc of its radius —
      // which would push its neighbour down by tens of pixels between one frame and the next.
      const stage = stageFor(240)
      const between = markersBetween(stage)
      const radius = 16
      const marker = (name: string, y: number): PlaceMarker => ({
        name,
        description: "",
        x: 120,
        y,
        radius,
        reach: touchReach(radius)
      })
      const from = Arr.make(marker("A", 60))
      const first = Arr.make(marker("A", 32), marker("N", 78))
      const partWay = between(from, first, 0.1)
      const arriving = Option.getOrThrow(Arr.findFirst(partWay, (m) => Equal.equals(m.name, "N")))
      expect(arriving.radius).toBeCloseTo(Num.multiply(radius, 0.1), 10)
      expect(arriving.reach).toBeCloseTo(Num.multiply(touchReach(radius), 0.1), 10)

      const second = Arr.make(marker("A", 32), marker("N", 79))
      const retargeted = between(partWay, second, 1e-6)
      Arr.forEach(partWay, (was) => {
        const now = Option.getOrThrow(Arr.findFirst(retargeted, (m) => Equal.equals(m.name, was.name)))
        expect(now.y, was.name).toBeCloseTo(was.y, 3)
        expect(now.radius, was.name).toBeCloseTo(was.radius, 3)
        expect(now.reach, was.name).toBeCloseTo(was.reach, 3)
      })
      expect(between(partWay, second, 0)).toEqual(partWay)
      expect(between(partWay, second, 1)).toEqual(second)
      Arr.forEach(steps, (t) => expectWellPlaced(stage, between(partWay, second, t)))
    }))

  it.effect("markers left at another width are brought onto this stage on the way", () =>
    Effect.sync(() => {
      const wide = stageFor(900)
      const narrow = stageFor(240)
      const from = placeMarkers(features, noContributors, wide, corner(1))
      const to = placeMarkers(features, noContributors, narrow, corner(0))
      Arr.forEach(steps, (t) => {
        expectWellPlaced(narrow, markersBetween(narrow)(from, to, t))
      })
    }))

  it.effect("every marker leaves the least line beside it, so no line is ever set under a disc, at the narrowest stage and on the way", () =>
    Effect.sync(() => {
      Arr.forEach(Arr.make(240, 320, 704), (width) => {
        const stage = stageFor(width)
        const landed = placeMarkers(features, noContributors, stage, leftmost)
        expectWellPlaced(stage, landed)
        const widthFor = lineWidthFor(stage, landed)
        Arr.forEach(Arr.range(0, 40), (line) => {
          expect(widthFor(line)).toBeGreaterThanOrEqual(minimumLineWidth)
          Arr.forEach(markersBeside(stage, landed, line), (marker) => {
            expect(Num.sumAll(Arr.make(stage.padding, widthFor(line), markerGap))).toBeLessThanOrEqual(
              Num.sum(Num.subtract(marker.x, marker.radius), 1e-9)
            )
          })
        })
        const from = placeMarkers(features, noContributors, stageFor(900), leftmost)
        Arr.forEach(steps, (t) => {
          expectWellPlaced(stage, markersBetween(stage)(from, landed, t))
        })
      })
    }))

  it.effect("a line keeps the gap from a disc above or below it as it does from one beside it", () =>
    Effect.sync(() => {
      const stage = stageFor(640)
      const boundary = Num.sum(stage.padding, Num.multiply(2, stage.lineHeight))
      const radius = markerRadius(stage, 1)
      const disc = (y: number): PlaceMarker => ({ name: "Disc", description: "", x: 400, y, radius, reach: 0 })
      const touching = disc(Num.subtract(boundary, radius))
      const clear = disc(Num.subtract(Num.subtract(boundary, radius), markerGap))
      const nearlyClear = disc(Num.sum(Num.subtract(Num.subtract(boundary, radius), markerGap), 0.5))
      expect(markersBeside(stage, Arr.make(touching), 2)).toHaveLength(1)
      expect(markersBeside(stage, Arr.make(nearlyClear), 2)).toHaveLength(1)
      expect(markersBeside(stage, Arr.make(clear), 2)).toHaveLength(0)
      expect(markersBeside(stage, Arr.make(clear), 1)).toHaveLength(1)
      expect(lineWidthFor(stage, Arr.make(touching))(2)).toBe(
        Num.subtract(Num.subtract(Num.subtract(touching.x, radius), markerGap), stage.padding)
      )
      expect(lineWidthFor(stage, Arr.make(clear))(2)).toBe(
        Num.subtract(stage.stageWidth, Num.multiply(2, stage.padding))
      )
    }))

  it.effect("a drawing scaled down to a narrower stage is set back on that stage's rules before it is drawn there", () =>
    Effect.sync(() => {
      // A drawing made for a wide stage, shown fitted to a narrow column, scales every disc's place and size
      // by the same factor — but the least line beside a disc does not scale, so a disc that stood at the
      // left of the wide stage lands over the narrow stage's first line. Setting it on the stage clamps it
      // where a travelling disc would be clamped, and the paper is at least what the discs stand on.
      const wide = stageFor(900)
      const narrow = stageFor(254)
      const scale = Num.unsafeDivide(narrow.stageWidth, wide.stageWidth)
      const scaled = drawingScaled(
        new PlaceDrawing({ markers: placeMarkers(features, noContributors, wide, leftmost), paper: wide.stageHeight }),
        scale
      )
      expect(
        Arr.some(scaled.markers, (m) =>
          Num.lessThan(
            Num.subtract(m.x, m.radius),
            Num.sumAll(Arr.make(narrow.padding, minimumLineWidth, markerGap))
          ))
      ).toBe(true)

      const onStage = drawingOnStage(narrow, scaled)
      expectWellPlaced(narrow, onStage.markers)
      expect(Arr.map(onStage.markers, (m) => m.name)).toEqual(Arr.map(scaled.markers, (m) => m.name))
      expect(onStage.paper).toBeGreaterThanOrEqual(paperUnder(narrow, onStage.markers))
      expect(onStage.paper).toBeGreaterThanOrEqual(scaled.paper)
    }))

  it.effect("prose flowed on the narrow stage runs through a disc scaled down to it, and clear of one set on it", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: Arr.join(Arr.makeBy(160, (index) => `word${String(index)}`), " "),
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(fixedWidthText))
      const wide = stageFor(900)
      const narrow = stageFor(254)
      const scaled = drawingScaled(
        new PlaceDrawing({ markers: placeMarkers(features, noContributors, wide, leftmost), paper: wide.stageHeight }),
        Num.unsafeDivide(narrow.stageWidth, wide.stageWidth)
      )
      // A line's ink runs from the padding for its width; a disc beside that line whose left edge is short
      // of the ink's end, less the gap, has the prose through it.
      const inkThrough = (markers: PlaceMarkers) =>
        Arr.some(flowLines(prepared, narrow, markers), (line, index) =>
          Arr.some(
            markersBeside(narrow, markers, index),
            (marker) =>
              Num.lessThan(
                Num.subtract(Num.subtract(marker.x, marker.radius), markerGap),
                Num.subtract(Num.sum(narrow.padding, line.width), 1e-9)
              )
          ))
      expect(inkThrough(scaled.markers)).toBe(true)
      expect(inkThrough(drawingOnStage(narrow, scaled).markers)).toBe(false)
    }))

  it.effect("a drawing already on its stage's rules is left exactly as it is", () =>
    Effect.sync(() => {
      const stage = stageFor(640)
      const markers = placeMarkers(features, noContributors, stage, leftmost)
      const drawing = new PlaceDrawing({
        markers,
        paper: Num.sum(paperUnder(stage, markers), Num.multiply(3, stage.lineHeight))
      })
      expect(drawingOnStage(stage, drawing)).toEqual(drawing)
    }))

  it.effect("keeps the proposer on features that came from accepted proposals", () =>
    Effect.sync(() => {
      const contributors = Arr.map(
        features,
        (_, index) =>
          Bool.match(Equal.equals(index, 5), {
            onTrue: () => Option.some<ParticipantRole>("neighbor"),
            onFalse: () => Option.none()
          })
      )
      const markers = placeMarkers(features, contributors, stageFor(640), corner(0))
      expect(Arr.length(Arr.filter(markers, (m) => Equal.equals(m.contributedBy, "neighbor")))).toBe(1)
    }))

  it.effect.prop("geometry-only scoring preserves every loss term without materializing visual text", {
    width: FastCheck.integer({ min: 240, max: 900 }),
    meander: FastCheck.record(Record.map(meanderBounds, ([min, max]) => FastCheck.double({ min, max, noNaN: true }))),
    text: FastCheck.constantFrom(
      "",
      "One short line.",
      Str.repeat(80)("Uneven substantial words שלום soft\u00adhyphen ")
    )
  }, ({ width, meander, text }) =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text,
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(fixedWidthText))
      const stage = stageFor(width)
      const markers = placeMarkers(features, noContributors, stage, meander)
      const expected = flowQuality(stage, markers, flowLines(prepared, stage, markers))
      const materializations = MutableRef.make(0)
      const measured = new Text.WithSegments({
        ...prepared,
        lines: (request, resolveMaxWidth) => {
          MutableRef.update(materializations, Num.increment)
          return prepared.lines(request, resolveMaxWidth)
        }
      })

      expect(measureFlowQuality(measured, stage, markers)).toEqual(expected)
      expect(MutableRef.get(materializations)).toBe(0)
    }))

  it.effect("the expected paper is whole lines: the prose alone with no features, more for every feature", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: Arr.join(Arr.makeBy(120, (index) => `word${String(index)}`), " "),
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(fixedWidthText))
      Arr.forEach(Arr.make(240, 640, 900), (width) => {
        const stage = stageFor(width)
        const proseAlone = Num.sum(
          Num.multiply(Arr.length(flowLines(prepared, stage, Arr.empty<PlaceMarker>())), stage.lineHeight),
          Num.multiply(2, stage.padding)
        )
        expect(paperExpected(stage, prepared, Arr.empty<PlaceFeature>())).toBe(proseAlone)
        const withFeatures = paperExpected(stage, prepared, features)
        expect(withFeatures).toBeGreaterThan(proseAlone)
        expect(Num.remainder(Num.subtract(withFeatures, Num.multiply(2, stage.padding)), stage.lineHeight)).toBe(0)
        expect(paperExpected(stage, prepared, Arr.take(features, 2))).toBeLessThanOrEqual(withFeatures)
      })
    }))
})
