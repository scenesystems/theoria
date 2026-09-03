import { describe, expect, it } from "@effect/vitest"
import { Option } from "effect"
import * as Arr from "effect/Array"

import { stageFor } from "../../app/contracts/demo/imagined-place-flow.js"
import type { PlaceRendering } from "../../app/contracts/imagined-place-result.js"
import { frameLosses, frameShowing, type PlaceRenderFrame } from "../../app/web/atoms/imagined-place-render.js"
import {
  keptTrialLabel,
  renderProgressText,
  shownTrialIndex,
  trialValueText
} from "../../app/web/view/home/placeViewModel.js"

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

const complete: PlaceRenderFrame = { phase: "complete", trial: 3, stage, tried, bestIndex: 2, rendering, labels: {} }
const running: PlaceRenderFrame = { ...complete, phase: "running", trial: 2, tried: Arr.take(tried, 2), bestIndex: 1 }

describe("search trace", () => {
  it("derives the trace from the trials rather than storing it twice", () => {
    expect(frameLosses(complete)).toEqual([16.999, 4.25, 1.52])
  })

  it("draws the best trial unless a tried trial is chosen", () => {
    expect(shownTrialIndex(complete, Option.none())).toBe(2)
    expect(shownTrialIndex(complete, Option.some(0))).toBe(0)
    expect(shownTrialIndex(complete, Option.some(7))).toBe(2)
    expect(frameShowing(complete, Option.some(0)).rendering.projection.markers[0]?.x).toBe(500)
    expect(frameShowing(complete, Option.some(7))).toBe(complete)
  })

  it("captions the shown trial honestly", () => {
    expect(renderProgressText(running, 1)).toBe("Searching arrangements · 2 of 36")
    expect(renderProgressText(complete, 2)).toBe("Kept trial 3 of 3 · loss 1.520")
    expect(renderProgressText(complete, 0)).toBe("Trial 1 of 3 · loss 16.999 · not kept")
    expect(keptTrialLabel(complete)).toBe("Kept trial 3")
  })

  it("tells a screen reader which trial the thumb is on", () => {
    expect(trialValueText(complete, 2)).toBe("Trial 3 of 3, loss 1.520, kept")
    expect(trialValueText(complete, 1)).toBe("Trial 2 of 3, loss 4.250")
    expect(trialValueText(running, 2)).toBe("Trial 3, not tried yet")
  })
})
