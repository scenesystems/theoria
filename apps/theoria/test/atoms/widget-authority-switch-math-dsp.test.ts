import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { DspCanonicalStep, DspRunFrame } from "../../app/contracts/capability/effect-dsp-runtime.js"
import {
  EffectMathCanonicalStep,
  projectPowerProjection,
  snapshotEffectMathProjectionScript
} from "../../app/contracts/capability/effect-math.js"
import { canonicalFrameV1 } from "../../app/contracts/study/workflow/canonical-step.js"
import { dspWidgetViewModelAtom } from "../../app/web/atoms/dsp-widget-model.js"
import {
  dspModuleTypeAtom,
  dspOptimizationBudgetAtom,
  dspScenarioIdAtom,
  snapshotEffectDspProjectionScript
} from "../../app/web/atoms/dsp-widget.js"
import { powerWidgetViewModelAtom } from "../../app/web/atoms/power-widget-view-model.js"
import {
  type EffectMathRunFrame,
  powerAnimatingAtom,
  powerControlsAtom
} from "../../app/web/atoms/run/power-animation.js"
import { surfaceAtom } from "../../app/web/atoms/surface/state.js"
import type { LocalRunFrame } from "../../app/web/state/run/local.js"
import { reduceRunState } from "../../app/web/state/run/reducer.js"
import type { RunState } from "../../app/web/state/run/types.js"
import { programPreviewFixture, runDataFixture } from "../helpers/entry-fixtures.js"
import { runningRunState, stepQueueDrainedRunState, streamCompletedRunState } from "../helpers/run-state.js"

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
  })

const effectMathFrame: EffectMathRunFrame = {
  _tag: "effect-math",
  controls: { d: 1.35, n: 77, alpha: 0.07 },
  projection: projectPowerProjection({ d: 1.35, n: 77, alpha: 0.07 })
}

const effectDspFrame = new DspRunFrame({
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

const effectMathCanonicalFrame = canonicalFrameV1(
  new EffectMathCanonicalStep({
    controls: effectMathFrame.controls,
    projection: effectMathFrame.projection
  })
)

const effectDspCanonicalFrame = canonicalFrameV1(
  new DspCanonicalStep({
    scenarioId: "intervention-classifier",
    moduleType: "chainOfThought",
    stageId: "optimized-eval",
    stepIndex: 3,
    stepCount: 4,
    metrics: effectDspFrame.metrics
  })
)

const finalizeRunWithFrame = ({
  canonicalFrame,
  frame,
  running,
  summary
}: {
  readonly canonicalFrame: typeof effectMathCanonicalFrame | typeof effectDspCanonicalFrame
  readonly frame: LocalRunFrame
  readonly running: RunState
  readonly summary: string
}) => {
  const active = reduceRunState(
    reduceRunState(running, {
      _tag: "RunCanonicalFrameObserved",
      sequence: 1,
      frame: canonicalFrame
    }),
    { _tag: "RunFrameUpdated", sequence: 1, frame }
  )
  const observed = streamCompletedRunState({ run: active, sequence: 1, summary })
  const drained = stepQueueDrainedRunState({ run: observed, sequence: 1 })

  return {
    active,
    idle: reduceRunState(drained, {
      _tag: "RunSucceeded",
      sequence: 1,
      finalizedAtMs: 2,
      data: runDataFixture(summary),
      meta: null
    })
  }
}

describe("widget authority switch math+dsp", () => {
  it.effect("keeps effect-math on the frozen run plan before the first authored frame arrives", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const running = runningRunState({
        localProjectionScript: snapshotEffectMathProjectionScript({ d: 1.35, n: 77, alpha: 0.07 }),
        program: programPreviewFixture.program
      })

      registry.set(powerAnimatingAtom, true)
      registry.set(powerControlsAtom, { d: 0.2, n: 15, alpha: 0.02 })
      registry.update(surfaceAtom("effect-math"), (state) => ({ ...state, run: running }))

      const activeView = registry.get(powerWidgetViewModelAtom)

      expect(activeView.controlsLocked).toBe(true)
      expect(activeView.isAnimating).toBe(true)
      expect(activeView.controls.effectSize.value).toBe(0.1)
      expect(activeView.controls.sampleSize.value).toBe(77)
      expect(activeView.controls.alpha.value).toBe(0.07)
    }))

  it.effect("keeps effect-math on canonical run authority after completion until reset", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const states = finalizeRunWithFrame({
        canonicalFrame: effectMathCanonicalFrame,
        frame: effectMathFrame,
        running: runningRunState({
          localProjectionScript: snapshotEffectMathProjectionScript({ d: 1.35, n: 77, alpha: 0.07 }),
          program: programPreviewFixture.program
        }),
        summary: "effect-math finished"
      })

      registry.set(powerAnimatingAtom, true)
      registry.set(powerControlsAtom, { d: 0.2, n: 15, alpha: 0.02 })
      registry.update(surfaceAtom("effect-math"), (state) => ({ ...state, run: states.active }))

      const activeView = registry.get(powerWidgetViewModelAtom)

      expect(activeView.controlsLocked).toBe(true)
      expect(activeView.isAnimating).toBe(true)
      expect(activeView.controls.effectSize.value).toBe(1.35)
      expect(activeView.controls.sampleSize.value).toBe(77)

      registry.update(surfaceAtom("effect-math"), (state) => ({ ...state, run: states.idle }))

      const idleView = registry.get(powerWidgetViewModelAtom)

      expect(idleView.controlsLocked).toBe(true)
      expect(idleView.isAnimating).toBe(false)
      expect(idleView.controls.effectSize.value).toBe(1.35)
      expect(idleView.controls.sampleSize.value).toBe(77)
      expect(idleView.controls.alpha.value).toBe(0.07)
    }))

  it.effect("keeps effect-dsp on canonical run authority after completion until reset", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const states = finalizeRunWithFrame({
        canonicalFrame: effectDspCanonicalFrame,
        frame: effectDspFrame,
        running: runningRunState({
          localProjectionScript: snapshotEffectDspProjectionScript({
            scenarioId: "intervention-classifier",
            moduleType: "chainOfThought",
            optimizationBudget: 2
          }),
          program: programPreviewFixture.program
        }),
        summary: "effect-dsp finished"
      })

      registry.set(dspScenarioIdAtom, "probe-follow-up")
      registry.set(dspModuleTypeAtom, "predict")
      registry.set(dspOptimizationBudgetAtom, 5)
      registry.update(surfaceAtom("effect-dsp"), (state) => ({ ...state, run: states.active }))

      const activeView = registry.get(dspWidgetViewModelAtom)

      expect(activeView.controlsLocked).toBe(true)
      expect(activeView.isAnimating).toBe(true)
      expect(activeView.scenario.id).toBe("intervention-classifier")
      expect(activeView.optimizationBudget.value).toBe(2)

      registry.update(surfaceAtom("effect-dsp"), (state) => ({ ...state, run: states.idle }))

      const idleView = registry.get(dspWidgetViewModelAtom)

      expect(idleView.controlsLocked).toBe(true)
      expect(idleView.isAnimating).toBe(false)
      expect(idleView.scenario.id).toBe("intervention-classifier")
      expect(idleView.moduleType).toBe("chainOfThought")
      expect(idleView.optimizationBudget.value).toBe(2)
    }))
})
