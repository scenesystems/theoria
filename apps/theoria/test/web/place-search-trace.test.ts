import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"
import * as HashSet from "effect/HashSet"

import { stageFor } from "../../app/contracts/demo/imagined-place-flow.js"
import type { PlaceBuild, PlaceRendering } from "../../app/contracts/imagined-place-result.js"
import { frameShowing, PlaceRenderFrame, PlaceSearch, searchLosses } from "../../app/web/atoms/imagined-place-render.js"
import {
  keptTrialLabel,
  renderProgressText,
  searching,
  shownTrialIndex,
  trialValueText
} from "../../app/web/view/home/placeViewModel.js"
import { onStage } from "../helpers/place-on-stage.js"

const stage = stageFor(640)

const arrangementWith = (loss: number, markerX: number) => ({
  markers: [{ name: "Bell", description: "A bell.", x: markerX, y: 120, radius: 24 }],
  lines: [{ text: "The bell.", y: 40, maxWidth: 400, width: 120 }],
  quality: { loss, lineCount: 1, narrowestLine: 0.8, raggedness: 0.1 }
})

const kept = arrangementWith(1.52, 200)
const tried = [arrangementWith(16.999, 500), arrangementWith(4.25, 300), kept]

const rendering: PlaceRendering = {
  projection: {
    stageWidth: stage.stageWidth,
    stageHeight: stage.stageHeight,
    padding: stage.padding,
    lineHeight: stage.lineHeight,
    markers: kept.markers,
    lines: kept.lines
  },
  evidence: {
    sampler: "tpe",
    seed: 42,
    trials: 3,
    bestLoss: 1.52,
    minimumSeparation: 0,
    lineCount: 1,
    narrowestLine: 0.8,
    raggedness: 0.1
  }
}

const searchFor = (source: PlaceBuild) =>
  new PlaceSearch({
    source,
    phase: "complete",
    stage,
    tried,
    bestIndex: 2,
    best: rendering,
    prose: "A room.",
    labels: {},
    settled: HashSet.empty()
  })
const completeFor = (search: PlaceSearch): PlaceRenderFrame =>
  new PlaceRenderFrame({
    search,
    trial: 2,
    rendering,
    paper: rendering.projection.stageHeight
  })
const runningFor = (search: PlaceSearch): PlaceSearch =>
  new PlaceSearch({
    ...search,
    phase: "running",
    tried: Arr.take(tried, 2),
    bestIndex: 1
  })
const landingFor = (search: PlaceSearch): PlaceSearch => new PlaceSearch({ ...search, phase: "landing" })

describe("search trace", () => {
  it.effect("derives the trace from the trials rather than storing it twice", () =>
    Effect.gen(function*() {
      const search = searchFor((yield* onStage).build)
      expect(searchLosses(search)).toEqual([16.999, 4.25, 1.52])
    }))

  it.effect("draws the best trial unless a tried trial is chosen", () =>
    Effect.gen(function*() {
      const search = searchFor((yield* onStage).build)
      const complete = completeFor(search)
      expect(shownTrialIndex(search, Option.none())).toBe(2)
      expect(shownTrialIndex(search, Option.some(0))).toBe(0)
      expect(shownTrialIndex(search, Option.some(7))).toBe(2)
      expect(frameShowing(complete, Option.some(0)).rendering.projection.markers[0]?.x).toBe(500)
      expect(frameShowing(complete, Option.some(7))).toBe(complete)
    }))

  it.effect("captions the shown trial honestly", () =>
    Effect.gen(function*() {
      const search = searchFor((yield* onStage).build)
      const running = runningFor(search)
      const landing = landingFor(search)
      expect(renderProgressText(running, 1)).toBe("Searching arrangements · 2 of 36")
      expect(renderProgressText(landing, 2)).toBe("Searching arrangements · 3 of 36")
      expect(renderProgressText(search, 2)).toBe("Kept trial 3 of 3 · loss 1.520")
      expect(renderProgressText(search, 0)).toBe("Trial 1 of 3 · loss 16.999 · not kept")
      expect(keptTrialLabel(search)).toBe("Kept trial 3")
    }))

  it.effect("reports progress until the drawing has landed", () =>
    Effect.gen(function*() {
      const search = searchFor((yield* onStage).build)
      const running = runningFor(search)
      const landing = landingFor(search)
      expect(searching(running)).toBe(true)
      expect(searching(landing)).toBe(true)
      expect(searching(search)).toBe(false)
    }))

  it.effect("tells a screen reader which trial the thumb is on", () =>
    Effect.gen(function*() {
      const search = searchFor((yield* onStage).build)
      const running = runningFor(search)
      expect(trialValueText(search, 2)).toBe("Trial 3 of 3, loss 1.520, kept")
      expect(trialValueText(search, 1)).toBe("Trial 2 of 3, loss 4.250")
      expect(trialValueText(running, 2)).toBe("Trial 3, not tried yet")
    }))
})
