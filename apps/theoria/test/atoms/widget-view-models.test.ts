import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { corpus } from "../../app/contracts/corpus.js"
import { DspRunFrame } from "../../app/contracts/demo/dsp-runtime.js"
import { snapshotEffectTextRunPlan } from "../../app/contracts/demo/text.js"
import { dspWidgetViewModelAtom } from "../../app/web/atoms/dsp-widget-model.js"
import {
  dspModuleTypeIndexAtom,
  dspOptimizationBudgetAtom,
  dspScenarioIndexAtom,
  snapshotEffectDspRunPlan
} from "../../app/web/atoms/dsp-widget.js"
import { optimizationAnimatingAtom, trialBudgetAtom } from "../../app/web/atoms/optimization-animation.js"
import {
  type EffectMathRunFrame,
  powerAnimatingAtom,
  powerControlsAtom,
  snapshotEffectMathRunPlan
} from "../../app/web/atoms/power-animation.js"
import {
  customTextAtom,
  reflowControlsAtom,
  reflowStageViewportWidthAtom,
  resolveReflowStageMaxWidth
} from "../../app/web/atoms/reflow.js"
import { surfaceAtom } from "../../app/web/atoms/surface.js"
import {
  optimizationWidgetViewModelAtom,
  powerWidgetViewModelAtom,
  reflowWidgetViewModelAtom
} from "../../app/web/atoms/widget-view-models.js"
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

const effectDspFrameFixture = new DspRunFrame({
  scenarioId: "intervention-classifier",
  stageId: "optimized-eval",
  stepIndex: 3,
  stepCount: 4,
  metrics: {
    baselineAccuracy: 0.5,
    optimizedAccuracy: 0.75,
    demosLearned: 2,
    improvementDelta: 0.25
  }
})

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

  it.effect("renders effect-dsp from canonical frame authority during an active run", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const localRunPlan = snapshotEffectDspRunPlan({
        scenarioIndex: 0,
        moduleTypeIndex: 0,
        optimizationBudget: 2
      })
      const running = runningRunState({
        localRunPlan,
        program: programPreviewFixture.program
      })
      const withFrame = reduceRunState(running, {
        _tag: "RunFrameUpdated",
        sequence: 1,
        frame: effectDspFrameFixture
      })

      registry.set(dspScenarioIndexAtom, 2)
      registry.set(dspModuleTypeIndexAtom, 1)
      registry.set(dspOptimizationBudgetAtom, 5)
      registry.update(surfaceAtom("effect-dsp"), (state) => ({
        ...state,
        run: withFrame
      }))

      const viewModel = registry.get(dspWidgetViewModelAtom)

      expect(viewModel.controlsLocked).toBe(true)
      expect(viewModel.scenario.id).toBe("intervention-classifier")
      expect(viewModel.moduleType).toBe("chainOfThought")
      expect(viewModel.optimizationBudget.value).toBe(2)
      expect(viewModel.runtimeStatus?.stageId).toBe("optimized-eval")
      expect(viewModel.runtimeStatus?.title).toContain("3/4")
      expect(viewModel.metrics[0]?.value).toBe("50.0%")
      expect(viewModel.metrics[1]?.value).toBe("75.0%")
      expect(viewModel.metrics[2]?.value).toBe("2")
      expect(viewModel.metrics[3]?.value).toBe("+25.0 pts")
    }))

  it.effect("treats paused effect-dsp runs as interactive instead of frozen", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const localRunPlan = snapshotEffectDspRunPlan({
        scenarioIndex: 0,
        moduleTypeIndex: 0,
        optimizationBudget: 2
      })
      const paused = reduceRunState(
        reduceRunState(
          runningRunState({
            localRunPlan,
            program: programPreviewFixture.program
          }),
          {
            _tag: "RunFrameUpdated",
            sequence: 1,
            frame: effectDspFrameFixture
          }
        ),
        {
          _tag: "RunPaused",
          sequence: 1,
          requestedAtMs: 1
        }
      )

      registry.set(dspScenarioIndexAtom, 2)
      registry.set(dspModuleTypeIndexAtom, 1)
      registry.set(dspOptimizationBudgetAtom, 5)
      registry.update(surfaceAtom("effect-dsp"), (state) => ({
        ...state,
        run: paused
      }))

      const viewModel = registry.get(dspWidgetViewModelAtom)

      expect(viewModel.controlsLocked).toBe(false)
      expect(viewModel.isAnimating).toBe(false)
      expect(viewModel.scenario.id).toBe("probe-follow-up")
      expect(viewModel.moduleType).toBe("predict")
      expect(viewModel.optimizationBudget.value).toBe(5)
    }))

  it.effect("treats paused local-driver demos as interactive instead of animating", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const effectMathPlan = snapshotEffectMathRunPlan({
        d: 1.35,
        n: 77,
        alpha: 0.07
      })
      const pausedEffectMath = reduceRunState(
        reduceRunState(
          runningRunState({
            localRunPlan: effectMathPlan,
            program: programPreviewFixture.program
          }),
          {
            _tag: "RunFrameUpdated",
            sequence: 1,
            frame: effectMathFrameFixture
          }
        ),
        {
          _tag: "RunPaused",
          sequence: 1,
          requestedAtMs: 1
        }
      )
      const pausedEffectSearch = reduceRunState(
        runningRunState({ program: programPreviewFixture.program }),
        {
          _tag: "RunPaused",
          sequence: 1,
          requestedAtMs: 1
        }
      )

      registry.set(optimizationAnimatingAtom, true)
      registry.set(trialBudgetAtom, 55)
      registry.update(surfaceAtom("effect-search"), (state) => ({
        ...state,
        run: pausedEffectSearch
      }))

      registry.set(powerAnimatingAtom, true)
      registry.set(powerControlsAtom, { d: 0.2, n: 15, alpha: 0.02 })
      registry.update(surfaceAtom("effect-math"), (state) => ({
        ...state,
        run: pausedEffectMath
      }))

      const optimizationViewModel = registry.get(optimizationWidgetViewModelAtom)
      const powerViewModel = registry.get(powerWidgetViewModelAtom)

      expect(optimizationViewModel.isAnimating).toBe(false)
      expect(optimizationViewModel.budget.value).toBe(55)
      expect(powerViewModel.isAnimating).toBe(false)
      expect(powerViewModel.controls.effectSize.value).toBe(0.2)
      expect(powerViewModel.controls.sampleSize.value).toBe(15)
      expect(powerViewModel.controls.alpha.value).toBe(0.02)
      expect(powerViewModel.projection.d).toBe(0.2)
      expect(powerViewModel.projection.n).toBe(15)
      expect(powerViewModel.projection.alpha).toBe(0.02)
    }))
})
