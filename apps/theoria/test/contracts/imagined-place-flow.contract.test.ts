import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"
import * as Arr from "effect/Array"

import { Contracts, Text } from "@scenesystems/effect-text"

import {
  flowLines,
  markerRadius,
  markersBetween,
  minimumTouchTarget,
  paperExpected,
  placeMarkers,
  type Stage,
  stageFor,
  touchGap,
  touchReach
} from "../../app/contracts/demo/imagined-place-flow.js"
import { type Meander, meanderBounds } from "../../app/contracts/demo/imagined-place-search.js"
import type { PlaceMarker } from "../../app/contracts/imagined-place-result.js"
import type { ParticipantRole, PlaceFeature } from "../../app/contracts/imagined-place.js"

const features: ReadonlyArray<PlaceFeature> = Arr.makeBy(6, (index) => ({
  name: `Feature ${String(index + 1)}`,
  description: "A feature.",
  weight: index % 2 === 0 ? 1 : 0.2
}))

const noContributors = Arr.map(features, () => Option.none())

/** Text measured at a fixed width per character, so the prose flows the same on every run. */
const fixedWidthText = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  Text.MeasurementCacheLive.pipe(
    Layer.provide(
      Layer.succeed(Contracts.TextMeasurer, { measure: (_font, text: string) => Effect.succeed(text.length * 5) })
    )
  )
)

/** The corners of the meander space are where the geometry is most stressed. */
const corner = (pick: 0 | 1): Meander => ({
  edge: meanderBounds.edge[pick],
  swing: meanderBounds.swing[pick],
  phase: meanderBounds.phase[pick],
  turns: meanderBounds.turns[pick],
  top: meanderBounds.top[pick],
  step: meanderBounds.step[0]
})

const corners: ReadonlyArray<Meander> = [corner(0), corner(1)]

const expectWellPlaced = (stage: Stage, markers: ReadonlyArray<PlaceMarker>) => {
  Arr.forEach(markers, (m) => {
    expect(m.x - m.radius).toBeGreaterThanOrEqual(stage.padding - 1e-9)
    expect(m.x + m.radius).toBeLessThanOrEqual(stage.stageWidth - stage.padding + 1e-9)
    expect(m.y - m.radius).toBeGreaterThanOrEqual(stage.padding - 1e-9)
  })

  Arr.forEach(markers, (a, i) =>
    Arr.forEach(Arr.drop(markers, i + 1), (b) => {
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.radius + b.radius + 10 - 1e-9)
    }))
}

/**
 * In a landed drawing two touch targets never meet either, so a touch beside
 * a small disc is that disc's alone, even at the target's edge. (On the way,
 * a disc growing in or shrinking away reaches for its target in proportion,
 * so this is asked of where the drawing lands, not of every step.)
 */
const expectTouchable = (markers: ReadonlyArray<PlaceMarker>) =>
  Arr.forEach(markers, (a, i) =>
    Arr.forEach(Arr.drop(markers, i + 1), (b) => {
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(
        a.radius + touchReach(a.radius) + b.radius + touchReach(b.radius) + touchGap - 1e-9
      )
    }))

/** Steps of a travel between the two corners, as the stage would draw them. */
const steps = Arr.map(Arr.range(0, 10), (index) => index / 10)

describe("Imagined place geometry contract", () => {
  it.effect("a disc's reach makes up what its radius lacks of a 44 px touch target, and nothing more", () =>
    Effect.sync(() => {
      const narrow = stageFor(240)
      const small = markerRadius(narrow, 0)
      expect(small).toBeLessThan(minimumTouchTarget / 2)
      expect(2 * (small + touchReach(small))).toBeCloseTo(minimumTouchTarget, 10)
      expect(touchReach(minimumTouchTarget / 2)).toBe(0)
      expect(touchReach(markerRadius(stageFor(900), 1))).toBe(0)
    }))

  it.effect("markers never overlap and never leave the padded stage, whatever the meander", () =>
    Effect.sync(() => {
      Arr.forEach([240, 640, 900], (width) => {
        const stage = stageFor(width)
        Arr.forEach(corners, (meander) => {
          const markers = placeMarkers(features, noContributors, stage, meander)
          expect(markers.length).toBe(features.length)
          expectWellPlaced(stage, markers)
          expectTouchable(markers)
        })
      })
    }))

  it.effect("markers on their way between two arrangements keep the same rules at every step", () =>
    Effect.sync(() => {
      Arr.forEach([240, 640, 900], (width) => {
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
      const arriving = Arr.findFirst(halfway, (m) => m.name === "Feature 6")
      const destination = Arr.findFirst(to, (m) => m.name === "Feature 6")
      expect(Option.map(arriving, (m) => m.radius)).toEqual(Option.map(destination, (m) => m.radius / 2))
      expect(Option.map(arriving, (m) => m.x)).toEqual(Option.map(destination, (m) => m.x))
      // The leaver is still drawn, half its size, where it stood — so the text is flowed around it while it
      // goes — and it is listed last, so every other disc keeps its number.
      const leaving = Arr.findFirst(halfway, (m) => m.name === "Feature 1")
      const origin = Arr.findFirst(from, (m) => m.name === "Feature 1")
      expect(Option.map(leaving, (m) => m.radius)).toEqual(Option.map(origin, (m) => m.radius / 2))
      expect(Option.map(leaving, (m) => m.x)).toEqual(Option.map(origin, (m) => m.x))
      expect(Arr.map(halfway, (m) => m.name)).toEqual([...Arr.map(to, (m) => m.name), "Feature 1"])
      expectWellPlaced(stage, halfway)
      // At the start the leaver stands whole; at the end it is gone, and the drawing is the destination itself.
      const atStart = Arr.findFirst(between(from, to, 0), (m) => m.name === "Feature 1")
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
      const marker = (name: string, y: number): PlaceMarker => ({ name, description: "", x: 100, y, radius: 20 })
      const from = [marker("A", 100), marker("B", 200)]
      const to = [marker("A", 100), marker("N", 200), marker("B", 250)]
      const atStart = between(from, to, 0)
      expect(Arr.map(atStart, (m) => m.name)).toEqual(["A", "N", "B"])
      expect(Option.map(Arr.findFirst(atStart, (m) => m.name === "B"), (m) => m.y)).not.toEqual(Option.some(200))
      expectWellPlaced(stage, atStart)
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

  it.effect("keeps the proposer on features that came from accepted proposals", () =>
    Effect.sync(() => {
      const contributors = Arr.map(
        features,
        (_, index) => (index === 5 ? Option.some<ParticipantRole>("neighbor") : Option.none())
      )
      const markers = placeMarkers(features, contributors, stageFor(640), corner(0))
      expect(Arr.filter(markers, (m) => m.contributedBy === "neighbor").length).toBe(1)
    }))

  it.effect("the expected paper is whole lines: the prose alone with no features, more for every feature", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: Arr.join(Arr.makeBy(120, (index) => `word${String(index)}`), " "),
        font: { family: "Mono", size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(fixedWidthText))
      Arr.forEach([240, 640, 900], (width) => {
        const stage = stageFor(width)
        const proseAlone = flowLines(prepared, stage, []).length * stage.lineHeight + 2 * stage.padding
        expect(paperExpected(stage, prepared, [])).toBe(proseAlone)
        const withFeatures = paperExpected(stage, prepared, features)
        expect(withFeatures).toBeGreaterThan(proseAlone)
        expect((withFeatures - 2 * stage.padding) % stage.lineHeight).toBe(0)
        expect(paperExpected(stage, prepared, Arr.take(features, 2))).toBeLessThanOrEqual(withFeatures)
      })
    }))
})
