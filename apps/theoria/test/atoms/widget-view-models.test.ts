import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { corpus } from "../../app/contracts/corpus.js"
import {
  type EffectMathRunFrame,
  powerControlsAtom,
  snapshotEffectMathRunPlan
} from "../../app/web/atoms/power-animation.js"
import {
  customTextAtom,
  reflowControlsAtom,
  reflowStageViewportWidthAtom,
  resolveReflowStageMaxWidth,
  snapshotEffectTextRunPlan
} from "../../app/web/atoms/reflow.js"
import { surfaceAtom } from "../../app/web/atoms/surface.js"
import { powerWidgetViewModelAtom, reflowWidgetViewModelAtom } from "../../app/web/atoms/widget-view-models.js"
import { type LocalRunFrame } from "../../app/web/state/local-run.js"
import { reduceRunState } from "../../app/web/state/types.js"
import { programPreviewFixture } from "../helpers/demo-fixtures.js"
import { runningRunState } from "../helpers/run-state.js"

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
  })

const frameFixture: LocalRunFrame = {
  _tag: "effect-text",
  controls: {
    corpusIndex: corpus.length,
    width: 420,
    obstaclesEnabled: true
  },
  projection: {
    baselineSummary: {
      lineCount: 4,
      height: 72,
      maxLineWidth: 390
    },
    summary: {
      lineCount: 5,
      height: 90,
      maxLineWidth: 360
    },
    requestedWidthPx: 420,
    stageWidthPx: 420,
    effectiveWidthPx: 360,
    obstacleDelta: 1,
    canvasHeightPx: 90,
    lineHeight: 18,
    prepared: true,
    corpusLabel: "Your text",
    corpusText: "Frozen runtime text",
    sceneSummary: "Frozen scene",
    sceneObstacles: [],
    lines: [],
    stageObstacles: []
  }
}

const effectMathFrameFixture: EffectMathRunFrame = {
  _tag: "effect-math",
  controls: {
    d: 1.35,
    n: 77,
    alpha: 0.07
  },
  projection: {
    d: 1.35,
    n: 77,
    alpha: 0.07,
    power: 0.91,
    requiredN: 22,
    overlap: 0.48,
    nonCentrality: 8.38
  }
}

describe("widget view models", () => {
  it.effect("renders effect-text from canonical frame authority during an active run", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const viewportWidthPx = 960
      const localRunPlan = snapshotEffectTextRunPlan({
        customText: "Frozen runtime text",
        viewportWidthPx
      })
      const running = runningRunState({
        localRunPlan,
        program: programPreviewFixture.program
      })
      const withFrame = reduceRunState(running, {
        _tag: "RunFrameUpdated",
        sequence: 1,
        frame: frameFixture
      })

      registry.set(customTextAtom, "Manual text should not drive the run")
      registry.set(reflowControlsAtom, {
        corpusIndex: 0,
        width: 180,
        obstaclesEnabled: false
      })
      registry.set(reflowStageViewportWidthAtom, 260)
      registry.update(surfaceAtom("effect-text"), (state) => ({
        ...state,
        run: withFrame
      }))

      const viewModel = registry.get(reflowWidgetViewModelAtom)

      expect(viewModel.selectedCorpusIndex).toBe(corpus.length)
      expect(viewModel.customText).toBe("Frozen runtime text")
      expect(viewModel.width.value).toBe(420)
      expect(viewModel.width.max).toBe(resolveReflowStageMaxWidth(viewportWidthPx))
      expect(viewModel.obstaclesEnabled).toBe(true)
      expect(viewModel.stage?.canvasWidthPx).toBe(420)
      expect(viewModel.stage?.summary.lineCount).toBe(5)
    }))

  it.effect("renders effect-math from canonical frame authority during an active run", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const localRunPlan = snapshotEffectMathRunPlan({
        d: 1.35,
        n: 77,
        alpha: 0.07
      })
      const running = runningRunState({
        localRunPlan,
        program: programPreviewFixture.program
      })
      const withFrame = reduceRunState(running, {
        _tag: "RunFrameUpdated",
        sequence: 1,
        frame: effectMathFrameFixture
      })

      registry.set(powerControlsAtom, { d: 0.2, n: 15, alpha: 0.02 })
      registry.update(surfaceAtom("effect-math"), (state) => ({
        ...state,
        run: withFrame
      }))

      const viewModel = registry.get(powerWidgetViewModelAtom)

      expect(viewModel.controls.effectSize.value).toBe(1.35)
      expect(viewModel.controls.sampleSize.value).toBe(77)
      expect(viewModel.controls.alpha.value).toBe(0.07)
      expect(viewModel.projection.power).toBe(0.91)
      expect(viewModel.metrics[0]?.value).toBe("91.0%")
    }))
})
