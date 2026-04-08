import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import { canonicalFrameV1 } from "../../app/contracts/canonical-step.js"
import { makeEffectSearchStudyTelemetry } from "../../app/contracts/demo/effect-search-study-telemetry.js"

import { corpus } from "../../app/contracts/corpus.js"
import { EffectSearchCanonicalStep, snapshotEffectSearchProjectionScript } from "../../app/contracts/demo/objective.js"
import { EffectTextProjectionStep, snapshotEffectTextTraversalScript } from "../../app/contracts/demo/text.js"
import {
  type EffectSearchRunFrame,
  optimizationAnimatingAtom,
  randomTrialsAtom,
  tpeTrialsAtom,
  trialBudgetAtom
} from "../../app/web/atoms/optimization-animation.js"
import type { EffectTextRunFrame } from "../../app/web/atoms/reflow.js"
import { customTextAtom, reflowControlsAtom, reflowStageViewportWidthAtom } from "../../app/web/atoms/reflow.js"
import { surfaceAtom } from "../../app/web/atoms/surface.js"
import { optimizationWidgetViewModelAtom, reflowWidgetViewModelAtom } from "../../app/web/atoms/widget-view-models.js"
import { reduceRunState, type RunState } from "../../app/web/state/types.js"
import { programPreviewFixture, runDataFixture } from "../helpers/demo-fixtures.js"
import { runningRunState, stepQueueDrainedRunState, streamCompletedRunState } from "../helpers/run-state.js"

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
  })

const effectTextFrame: EffectTextRunFrame = {
  _tag: "effect-text",
  controls: { corpusIndex: corpus.length, width: 420, obstaclesEnabled: true },
  projection: {
    baselineSummary: { lineCount: 4, height: 72, maxLineWidth: 390 },
    summary: { lineCount: 5, height: 90, maxLineWidth: 360 },
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

const effectSearchFrame: EffectSearchRunFrame = {
  _tag: "effect-search",
  projection: {
    trialBudget: 30,
    tpeTrials: [
      { x: -1.25, y: 0.25, value: 0.12, index: 0 },
      { x: -1.1, y: 0.4, value: 0.08, index: 1 }
    ],
    randomTrials: [{ x: 0.75, y: -0.5, value: 0.45, index: 0 }],
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

const effectTextCanonicalFrame = canonicalFrameV1(
  new EffectTextProjectionStep({
    corpusIndex: corpus.length,
    requestedWidthPx: 420,
    stageWidthPx: 420,
    obstaclesEnabled: true
  })
)

const effectSearchCanonicalFrame = canonicalFrameV1(
  new EffectSearchCanonicalStep({
    trialBudget: effectSearchFrame.projection.trialBudget,
    phase: "running",
    tpeTrials: effectSearchFrame.projection.tpeTrials,
    randomTrials: effectSearchFrame.projection.randomTrials,
    telemetry: effectSearchFrame.telemetry
  })
)

const finalizeRunWithFrame = ({
  canonicalFrame,
  frame,
  running,
  summary
}: {
  readonly canonicalFrame: typeof effectTextCanonicalFrame | typeof effectSearchCanonicalFrame
  readonly frame: EffectSearchRunFrame | EffectTextRunFrame
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

describe("widget authority switch", () => {
  it.effect("keeps effect-text on the frozen run plan before the first authored frame arrives", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const projectionScript = snapshotEffectTextTraversalScript({
        customText: "Frozen runtime text",
        viewportWidthPx: 960
      })
      const running = runningRunState({
        localProjectionScript: projectionScript,
        program: programPreviewFixture.program
      })

      registry.set(customTextAtom, "Playground text")
      registry.set(reflowControlsAtom, { corpusIndex: 0, width: 180, obstaclesEnabled: false })
      registry.set(reflowStageViewportWidthAtom, 260)
      registry.update(surfaceAtom("effect-text"), (state) => ({ ...state, run: running }))

      const activeView = registry.get(reflowWidgetViewModelAtom)

      expect(activeView.controlsLocked).toBe(true)
      expect(activeView.isAnimating).toBe(true)
      expect(activeView.selectedCorpusIndex).toBe(corpus.length)
      expect(activeView.customText).toBe("Frozen runtime text")
      expect(activeView.width.value).toBe(projectionScript.entries[0]?.steps[0]?.stageWidthPx)
      expect(activeView.obstaclesEnabled).toBe(false)
      expect(activeView.stage).toBeNull()
      expect(activeView.metrics).toEqual([])
    }))

  it.effect("keeps effect-text on canonical run authority after completion until reset", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const states = finalizeRunWithFrame({
        canonicalFrame: effectTextCanonicalFrame,
        frame: effectTextFrame,
        running: runningRunState({
          localProjectionScript: snapshotEffectTextTraversalScript({
            customText: "Frozen runtime text",
            viewportWidthPx: 960
          }),
          program: programPreviewFixture.program
        }),
        summary: "effect-text finished"
      })

      registry.set(customTextAtom, "Playground text")
      registry.set(reflowControlsAtom, { corpusIndex: 0, width: 180, obstaclesEnabled: false })
      registry.set(reflowStageViewportWidthAtom, 260)
      registry.update(surfaceAtom("effect-text"), (state) => ({ ...state, run: states.active }))

      const activeView = registry.get(reflowWidgetViewModelAtom)

      expect(activeView.controlsLocked).toBe(true)
      expect(activeView.isAnimating).toBe(true)
      expect(activeView.selectedCorpusIndex).toBe(corpus.length)
      expect(activeView.width.value).toBe(420)
      expect(activeView.obstaclesEnabled).toBe(true)

      registry.update(surfaceAtom("effect-text"), (state) => ({ ...state, run: states.idle }))

      const completedView = registry.get(reflowWidgetViewModelAtom)

      expect(completedView.controlsLocked).toBe(true)
      expect(completedView.selectedCorpusIndex).toBe(corpus.length)
      expect(completedView.width.value).toBe(420)
      expect(completedView.obstaclesEnabled).toBe(true)
      expect(completedView.customText).toBe("Frozen runtime text")
    }))

  it.effect("keeps effect-search on the frozen run plan before the first authored frame arrives", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const running = runningRunState({
        localProjectionScript: snapshotEffectSearchProjectionScript(30),
        program: programPreviewFixture.program
      })

      registry.set(optimizationAnimatingAtom, true)
      registry.set(trialBudgetAtom, 55)
      registry.set(tpeTrialsAtom, [{ x: 9, y: 9, value: 9, index: 0 }])
      registry.set(randomTrialsAtom, [{ x: 8, y: 8, value: 8, index: 0 }])
      registry.update(surfaceAtom("effect-search"), (state) => ({ ...state, run: running }))

      const activeView = registry.get(optimizationWidgetViewModelAtom)

      expect(activeView.controlsLocked).toBe(true)
      expect(activeView.isAnimating).toBe(true)
      expect(activeView.budget.value).toBe(30)
      expect(activeView.projection.tpeTrials.length).toBe(0)
      expect(activeView.projection.randomTrials.length).toBe(0)
      expect(activeView.metrics[3]?.value).toBe("0/30")
    }))

  it.effect("keeps effect-search on canonical run authority after completion until reset", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const states = finalizeRunWithFrame({
        canonicalFrame: effectSearchCanonicalFrame,
        frame: effectSearchFrame,
        running: runningRunState({
          localProjectionScript: snapshotEffectSearchProjectionScript(30),
          program: programPreviewFixture.program
        }),
        summary: "effect-search finished"
      })

      registry.set(optimizationAnimatingAtom, true)
      registry.set(trialBudgetAtom, 55)
      registry.set(tpeTrialsAtom, [{ x: 9, y: 9, value: 9, index: 0 }])
      registry.set(randomTrialsAtom, [{ x: 8, y: 8, value: 8, index: 0 }])
      registry.update(surfaceAtom("effect-search"), (state) => ({ ...state, run: states.active }))

      const activeView = registry.get(optimizationWidgetViewModelAtom)

      expect(activeView.controlsLocked).toBe(true)
      expect(activeView.isAnimating).toBe(true)
      expect(activeView.budget.value).toBe(30)
      expect(activeView.projection.tpeTrials.length).toBe(2)

      registry.update(surfaceAtom("effect-search"), (state) => ({ ...state, run: states.idle }))

      const completedView = registry.get(optimizationWidgetViewModelAtom)

      expect(completedView.controlsLocked).toBe(true)
      expect(completedView.isAnimating).toBe(false)
      expect(completedView.budget.value).toBe(30)
      expect(completedView.projection.tpeTrials.length).toBe(2)
      expect(completedView.projection.randomTrials.length).toBe(1)
    }))
})
