import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { type EffectMathRunFrame, snapshotEffectMathRunPlan } from "../../app/web/atoms/power-animation.js"
import { snapshotEffectTextRunPlan } from "../../app/web/atoms/reflow.js"
import { type LocalRunFrame } from "../../app/web/state/local-run.js"
import { reduceRunState } from "../../app/web/state/types.js"
import { programPreviewFixture, runDataFixture } from "../helpers/demo-fixtures.js"
import { runningRunState, stoppedRunState } from "../helpers/run-state.js"

const effectTextFrameFixture: LocalRunFrame = {
  _tag: "effect-text",
  controls: {
    corpusIndex: 0,
    width: 280,
    obstaclesEnabled: false
  },
  projection: {
    baselineSummary: {
      lineCount: 3,
      height: 54,
      maxLineWidth: 260
    },
    summary: {
      lineCount: 3,
      height: 54,
      maxLineWidth: 260
    },
    requestedWidthPx: 280,
    stageWidthPx: 280,
    effectiveWidthPx: 280,
    obstacleDelta: 0,
    canvasHeightPx: 54,
    lineHeight: 18,
    prepared: true,
    corpusLabel: "Fixture",
    corpusText: "Frozen text",
    sceneSummary: "Scene",
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

describe("surface-state reducer", () => {
  it.effect("ignores stale terminal messages from an older run sequence", () =>
    Effect.gen(function*() {
      const state = runningRunState({
        program: programPreviewFixture.program,
        sequence: 2,
        token: 2
      })

      const afterServerCompletion = reduceRunState(state, {
        _tag: "RunServerCompleted",
        sequence: 1,
        observedAtMs: 1,
        summary: "stale",
        meta: null
      })

      const afterSuccess = reduceRunState(state, {
        _tag: "RunSucceeded",
        sequence: 1,
        finalizedAtMs: 2,
        data: runDataFixture("stale"),
        meta: null
      })

      expect(afterServerCompletion).toEqual(state)
      expect(afterSuccess).toEqual(state)
    }))

  it.effect("ignores late terminal messages once a run has stopped", () =>
    Effect.gen(function*() {
      const state = stoppedRunState({ program: programPreviewFixture.program })

      const afterServerCompletion = reduceRunState(state, {
        _tag: "RunServerCompleted",
        sequence: 1,
        observedAtMs: 1,
        summary: "late",
        meta: null
      })

      const afterLocalCompletion = reduceRunState(state, {
        _tag: "RunLocalCompleted",
        sequence: 1,
        observedAtMs: 1
      })

      const afterSuccess = reduceRunState(state, {
        _tag: "RunSucceeded",
        sequence: 1,
        finalizedAtMs: 2,
        data: runDataFixture("late"),
        meta: null
      })

      expect(afterServerCompletion).toEqual(state)
      expect(afterLocalCompletion).toEqual(state)
      expect(afterSuccess).toEqual(state)
    }))

  it.effect("records telemetry inside the reducer-owned run session", () =>
    Effect.gen(function*() {
      const running = runningRunState({
        program: programPreviewFixture.program,
        startedAtMs: 100,
        sequence: 3,
        token: 9
      })

      const paused = reduceRunState(running, {
        _tag: "RunPaused",
        sequence: 3,
        requestedAtMs: 120
      })
      const checkpointed = reduceRunState(paused, {
        _tag: "RunPauseCheckpointReached",
        sequence: 3,
        observedAtMs: 150
      })
      const serverCompleted = reduceRunState(checkpointed, {
        _tag: "RunServerCompleted",
        sequence: 3,
        observedAtMs: 180,
        summary: "done",
        meta: null
      })
      const localCompleted = reduceRunState(serverCompleted, {
        _tag: "RunLocalCompleted",
        sequence: 3,
        observedAtMs: 210
      })
      const succeeded = reduceRunState(localCompleted, {
        _tag: "RunSucceeded",
        sequence: 3,
        finalizedAtMs: 240,
        data: runDataFixture("done"),
        meta: null
      })

      expect(succeeded.session.telemetry.startedAtMs).toBe(100)
      expect(succeeded.session.telemetry.events.map((event) => event.kind)).toEqual([
        "pause-requested",
        "checkpoint-reached",
        "server-completed",
        "local-completed",
        "run-finalized"
      ])
      expect(succeeded.session.telemetry.events[4]?.detail).toBe("succeeded")
    }))

  it.effect("keeps local frame authority sequence-scoped and clears it on reset", () =>
    Effect.gen(function*() {
      const localRunPlan = snapshotEffectTextRunPlan({
        customText: "Frozen text",
        viewportWidthPx: 960
      })
      const running = runningRunState({
        localRunPlan,
        program: programPreviewFixture.program,
        sequence: 4,
        token: 11
      })

      const withFrame = reduceRunState(running, {
        _tag: "RunFrameUpdated",
        sequence: 4,
        frame: effectTextFrameFixture
      })
      const afterStaleFrame = reduceRunState(withFrame, {
        _tag: "RunFrameUpdated",
        sequence: 3,
        frame: {
          ...effectTextFrameFixture,
          controls: {
            ...effectTextFrameFixture.controls,
            width: 180
          }
        }
      })
      const reset = reduceRunState(withFrame, { _tag: "RunReset" })

      expect(withFrame.session.localRunPlan).toEqual(localRunPlan)
      expect(withFrame.session.localRunFrame).toEqual(effectTextFrameFixture)
      expect(afterStaleFrame).toEqual(withFrame)
      expect(reset.session.localRunPlan).toBeNull()
      expect(reset.session.localRunFrame).toBeNull()
    }))

  it.effect("keeps effect-math local frame authority sequence-scoped and clears it on reset", () =>
    Effect.gen(function*() {
      const localRunPlan = snapshotEffectMathRunPlan({
        d: 1.35,
        n: 77,
        alpha: 0.07
      })
      const running = runningRunState({
        localRunPlan,
        program: programPreviewFixture.program,
        sequence: 5,
        token: 12
      })

      const withFrame = reduceRunState(running, {
        _tag: "RunFrameUpdated",
        sequence: 5,
        frame: effectMathFrameFixture
      })
      const afterStaleFrame = reduceRunState(withFrame, {
        _tag: "RunFrameUpdated",
        sequence: 4,
        frame: {
          ...effectMathFrameFixture,
          controls: {
            ...effectMathFrameFixture.controls,
            alpha: 0.02
          }
        }
      })
      const reset = reduceRunState(withFrame, { _tag: "RunReset" })

      expect(withFrame.session.localRunPlan).toEqual(localRunPlan)
      expect(withFrame.session.localRunFrame).toEqual(effectMathFrameFixture)
      expect(afterStaleFrame).toEqual(withFrame)
      expect(reset.session.localRunPlan).toBeNull()
      expect(reset.session.localRunFrame).toBeNull()
    }))
})
