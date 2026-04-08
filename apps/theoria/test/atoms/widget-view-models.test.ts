import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import { canonicalFrameV1, type CanonicalStep } from "../../app/contracts/canonical-step.js"
import { DspCanonicalStep, DspRunFrame } from "../../app/contracts/demo/dsp-runtime.js"
import { makeEffectSearchStudyTelemetry } from "../../app/contracts/demo/effect-search-study-telemetry.js"
import { EffectSearchCanonicalStep } from "../../app/contracts/demo/objective.js"
import { EffectMathCanonicalStep, projectPowerProjection } from "../../app/contracts/demo/power.js"

import { corpus } from "../../app/contracts/corpus.js"
import { snapshotEffectSearchProjectionScript } from "../../app/contracts/demo/objective.js"
import { snapshotEffectMathProjectionScript } from "../../app/contracts/demo/power.js"
import { EffectTextProjectionStep, snapshotEffectTextTraversalScript } from "../../app/contracts/demo/text.js"
import { dspWidgetViewModelAtom } from "../../app/web/atoms/dsp-widget-model.js"
import {
  dspModuleTypeAtom,
  dspOptimizationBudgetAtom,
  dspScenarioIdAtom,
  snapshotEffectDspProjectionScript
} from "../../app/web/atoms/dsp-widget.js"
import {
  type EffectSearchRunFrame,
  optimizationAnimatingAtom,
  randomTrialsAtom,
  tpeTrialsAtom,
  trialBudgetAtom
} from "../../app/web/atoms/optimization-animation.js"
import { type EffectMathRunFrame, powerAnimatingAtom, powerControlsAtom } from "../../app/web/atoms/power-animation.js"
import {
  customTextAtom,
  type EffectTextRunFrame,
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
import type { LocalRunFrame } from "../../app/web/state/local-run.js"
import { reduceRunState, type RunState } from "../../app/web/state/types.js"
import { programPreviewFixture } from "../helpers/demo-fixtures.js"
import { runDataFixture } from "../helpers/demo-fixtures.js"
import { runningRunState, stepQueueDrainedRunState, streamCompletedRunState } from "../helpers/run-state.js"

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
  })

const frameFixture: EffectTextRunFrame = {
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
  projection: projectPowerProjection({ d: 1.35, n: 77, alpha: 0.07 })
}

const effectTextCanonicalFrameFixture = canonicalFrameV1(
  new EffectTextProjectionStep({
    corpusIndex: corpus.length,
    requestedWidthPx: 420,
    stageWidthPx: 420,
    obstaclesEnabled: true
  })
)

const effectMathCanonicalFrameFixture = canonicalFrameV1(
  new EffectMathCanonicalStep({
    controls: effectMathFrameFixture.controls,
    projection: effectMathFrameFixture.projection
  })
)

const effectSearchFrameFixture: EffectSearchRunFrame = {
  _tag: "effect-search",
  projection: {
    trialBudget: 30,
    tpeTrials: [
      { x: -1.25, y: 0.25, value: 0.12, index: 0 },
      { x: -1.1, y: 0.4, value: 0.08, index: 1 }
    ],
    randomTrials: [
      { x: 0.75, y: -0.5, value: 0.45, index: 0 }
    ],
    tpeBestValue: Option.some(0.08),
    randomBestValue: Option.some(0.45),
    tpeBestPoint: Option.some({ x: -1.1, y: 0.4, value: 0.08, index: 1 }),
    randomBestPoint: Option.some({ x: 0.75, y: -0.5, value: 0.45, index: 0 }),
    phase: "running"
  },
  telemetry: makeEffectSearchStudyTelemetry({
    randomEvents: [],
    randomTrialPoints: [{ x: 0.75, y: -0.5, value: 0.45, index: 0 }],
    trialBudget: 30,
    tpeEvents: [],
    tpeTrialPoints: [
      { x: -1.25, y: 0.25, value: 0.12, index: 0 },
      { x: -1.1, y: 0.4, value: 0.08, index: 1 }
    ]
  })
}

const effectSearchCanonicalFrameFixture = canonicalFrameV1(
  new EffectSearchCanonicalStep({
    trialBudget: effectSearchFrameFixture.projection.trialBudget,
    phase: "running",
    tpeTrials: effectSearchFrameFixture.projection.tpeTrials,
    randomTrials: effectSearchFrameFixture.projection.randomTrials,
    telemetry: effectSearchFrameFixture.telemetry
  })
)

const effectDspCanonicalFrameFixture = canonicalFrameV1(
  new DspCanonicalStep({
    scenarioId: "intervention-classifier",
    moduleType: "chainOfThought",
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
)

const completedRunState = ({
  canonicalFrame,
  frame,
  running,
  summary
}: {
  readonly canonicalFrame: CanonicalStep
  readonly frame: LocalRunFrame
  readonly running: RunState
  readonly summary: string
}) =>
  reduceRunState(
    stepQueueDrainedRunState({
      run: streamCompletedRunState({
        run: reduceRunState(
          reduceRunState(running, {
            _tag: "RunCanonicalFrameObserved",
            sequence: 1,
            frame: canonicalFrameV1(canonicalFrame)
          }),
          {
            _tag: "RunFrameUpdated",
            sequence: 1,
            frame
          }
        ),
        sequence: 1,
        summary
      }),
      sequence: 1
    }),
    {
      _tag: "RunSucceeded",
      sequence: 1,
      finalizedAtMs: 2,
      data: runDataFixture(summary),
      meta: null
    }
  )

describe("widget view models", () => {
  it.effect("renders effect-text from canonical frame authority during an active run", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const viewportWidthPx = 960
      const localProjectionScript = snapshotEffectTextTraversalScript({
        customText: "Frozen runtime text",
        viewportWidthPx
      })
      const running = runningRunState({
        localProjectionScript,
        program: programPreviewFixture.program
      })
      const withFrame = reduceRunState(
        reduceRunState(running, {
          _tag: "RunCanonicalFrameObserved",
          sequence: 1,
          frame: effectTextCanonicalFrameFixture
        }),
        {
          _tag: "RunFrameUpdated",
          sequence: 1,
          frame: frameFixture
        }
      )

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
      const localProjectionScript = snapshotEffectMathProjectionScript({
        d: 1.35,
        n: 77,
        alpha: 0.07
      })
      const running = runningRunState({
        localProjectionScript,
        program: programPreviewFixture.program
      })
      const withFrame = reduceRunState(running, {
        _tag: "RunCanonicalFrameObserved",
        sequence: 1,
        frame: effectMathCanonicalFrameFixture
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
      expect(viewModel.projection.powerReport.effectSize).toBe(effectMathFrameFixture.projection.powerReport.effectSize)
      expect(viewModel.projection.sampleSizeReport.solver.method).toBe("brent")
      expect(viewModel.metrics[0]?.value).toBe(
        `${(effectMathFrameFixture.projection.powerReport.power * 100).toFixed(1)}%`
      )
      expect(viewModel.metrics[1]?.value).toBe(`${effectMathFrameFixture.projection.sampleSizeReport.sampleSize}`)
      expect(viewModel.metrics[3]?.value).toBe(effectMathFrameFixture.projection.powerReport.noncentrality.toFixed(2))
    }))

  it.effect("renders effect-search from canonical frame authority during an active run", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const localProjectionScript = snapshotEffectSearchProjectionScript(30)
      const running = runningRunState({
        localProjectionScript,
        program: programPreviewFixture.program
      })
      const withFrame = reduceRunState(running, {
        _tag: "RunCanonicalFrameObserved",
        sequence: 1,
        frame: effectSearchCanonicalFrameFixture
      })

      registry.set(optimizationAnimatingAtom, true)
      registry.set(trialBudgetAtom, 55)
      registry.set(tpeTrialsAtom, [{ x: 9, y: 9, value: 9, index: 0 }])
      registry.set(randomTrialsAtom, [{ x: 8, y: 8, value: 8, index: 0 }])
      registry.update(surfaceAtom("effect-search"), (state) => ({
        ...state,
        run: withFrame
      }))

      const viewModel = registry.get(optimizationWidgetViewModelAtom)

      expect(viewModel.budget.value).toBe(30)
      expect(viewModel.projection.phase).toBe("running")
      expect(viewModel.projection.tpeTrials.length).toBe(2)
      expect(viewModel.projection.randomTrials.length).toBe(1)
      expect(viewModel.metrics[0]?.value).toBe("0.0800")
      expect(viewModel.metrics[1]?.value).toBe("0.4500")
      expect(viewModel.metrics[3]?.value).toBe("2/30")
    }))

  it.effect("renders effect-dsp from canonical frame authority during an active run", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const localProjectionScript = snapshotEffectDspProjectionScript({
        scenarioId: "intervention-classifier",
        moduleType: "chainOfThought",
        optimizationBudget: 2
      })
      const running = runningRunState({
        localProjectionScript,
        program: programPreviewFixture.program
      })
      const withFrame = reduceRunState(running, {
        _tag: "RunCanonicalFrameObserved",
        sequence: 1,
        frame: effectDspCanonicalFrameFixture
      })

      registry.set(dspScenarioIdAtom, "probe-follow-up")
      registry.set(dspModuleTypeAtom, "predict")
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

  it.effect("keeps paused effect-dsp runs on frozen canonical authority while halting animation", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const localProjectionScript = snapshotEffectDspProjectionScript({
        scenarioId: "intervention-classifier",
        moduleType: "chainOfThought",
        optimizationBudget: 2
      })
      const paused = reduceRunState(
        reduceRunState(
          reduceRunState(
            runningRunState({
              localProjectionScript,
              program: programPreviewFixture.program
            }),
            {
              _tag: "RunFrameUpdated",
              sequence: 1,
              frame: new DspRunFrame({
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
            }
          ),
          {
            _tag: "RunCanonicalFrameObserved",
            sequence: 1,
            frame: effectDspCanonicalFrameFixture
          }
        ),
        {
          _tag: "RunPaused",
          sequence: 1,
          requestedAtMs: 1
        }
      )

      registry.set(dspScenarioIdAtom, "probe-follow-up")
      registry.set(dspModuleTypeAtom, "predict")
      registry.set(dspOptimizationBudgetAtom, 5)
      registry.update(surfaceAtom("effect-dsp"), (state) => ({
        ...state,
        run: paused
      }))

      const viewModel = registry.get(dspWidgetViewModelAtom)

      expect(viewModel.controlsLocked).toBe(true)
      expect(viewModel.isAnimating).toBe(false)
      expect(viewModel.scenario.id).toBe("intervention-classifier")
      expect(viewModel.moduleType).toBe("chainOfThought")
      expect(viewModel.optimizationBudget.value).toBe(2)
      expect(viewModel.runtimeStatus?.stageId).toBe("optimized-eval")
    }))

  it.effect("keeps paused local-driver demos on canonical authority while halting animation", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const effectMathPlan = snapshotEffectMathProjectionScript({
        d: 1.35,
        n: 77,
        alpha: 0.07
      })
      const pausedEffectMath = reduceRunState(
        reduceRunState(
          reduceRunState(
            runningRunState({
              localProjectionScript: effectMathPlan,
              program: programPreviewFixture.program
            }),
            {
              _tag: "RunFrameUpdated",
              sequence: 1,
              frame: effectMathFrameFixture
            }
          ),
          {
            _tag: "RunCanonicalFrameObserved",
            sequence: 1,
            frame: effectMathCanonicalFrameFixture
          }
        ),
        {
          _tag: "RunPaused",
          sequence: 1,
          requestedAtMs: 1
        }
      )
      const pausedEffectSearch = reduceRunState(
        reduceRunState(
          reduceRunState(
            runningRunState({
              localProjectionScript: snapshotEffectSearchProjectionScript(30),
              program: programPreviewFixture.program
            }),
            {
              _tag: "RunFrameUpdated",
              sequence: 1,
              frame: effectSearchFrameFixture
            }
          ),
          {
            _tag: "RunCanonicalFrameObserved",
            sequence: 1,
            frame: effectSearchCanonicalFrameFixture
          }
        ),
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
      expect(optimizationViewModel.budget.value).toBe(30)
      expect(optimizationViewModel.projection.tpeTrials.length).toBe(2)
      expect(powerViewModel.isAnimating).toBe(false)
      expect(powerViewModel.controls.effectSize.value).toBe(1.35)
      expect(powerViewModel.controls.sampleSize.value).toBe(77)
      expect(powerViewModel.controls.alpha.value).toBe(0.07)
      expect(powerViewModel.projection.d).toBe(1.35)
      expect(powerViewModel.projection.n).toBe(77)
      expect(powerViewModel.projection.alpha).toBe(0.07)
    }))

  it.effect("keeps completed runs on canonical authority until reset restores playground control", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const completedTextRun = completedRunState({
        canonicalFrame: new EffectTextProjectionStep({
          corpusIndex: corpus.length,
          requestedWidthPx: 420,
          stageWidthPx: 420,
          obstaclesEnabled: true
        }),
        frame: frameFixture,
        running: runningRunState({
          localProjectionScript: snapshotEffectTextTraversalScript({
            customText: "Frozen runtime text",
            viewportWidthPx: 960
          }),
          program: programPreviewFixture.program
        }),
        summary: "effect-text completed"
      })

      registry.set(customTextAtom, "Playground text")
      registry.set(reflowControlsAtom, {
        corpusIndex: 0,
        width: 180,
        obstaclesEnabled: false
      })
      registry.set(reflowStageViewportWidthAtom, 260)
      registry.update(surfaceAtom("effect-text"), (state) => ({
        ...state,
        run: completedTextRun
      }))

      const completedView = registry.get(reflowWidgetViewModelAtom)

      expect(completedView.controlsLocked).toBe(true)
      expect(completedView.selectedCorpusIndex).toBe(corpus.length)
      expect(completedView.width.value).toBe(420)
      expect(completedView.obstaclesEnabled).toBe(true)
      expect(completedView.customText).toBe("Frozen runtime text")
    }))
})
