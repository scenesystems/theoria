import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { canonicalFrameV1 } from "../../app/contracts/canonical-step.js"
import { InStage, StageEnter } from "../../app/contracts/choreography.js"
import { EffectMathCanonicalStep, projectPowerProjection } from "../../app/contracts/demo/power.js"
import { type PowerControls, snapshotEffectMathProjectionScript } from "../../app/contracts/demo/power.js"
import { EffectTextProjectionStep, snapshotEffectTextTraversalScript } from "../../app/contracts/demo/text.js"
import type { EffectMathRunFrame } from "../../app/web/atoms/power-animation.js"
import type { EffectTextRunFrame } from "../../app/web/atoms/reflow.js"
import { reduceRunState, type RunMessage } from "../../app/web/state/types.js"
import { programPreviewFixture, runDataFixture } from "../helpers/demo-fixtures.js"
import { runningRunState } from "../helpers/run-state.js"

const effectTextFrameFixture: EffectTextRunFrame = {
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
  projection: projectPowerProjection({ d: 1.35, n: 77, alpha: 0.07 })
}

const staleEffectTextFrameFixture: EffectTextRunFrame = {
  ...effectTextFrameFixture,
  controls: {
    ...effectTextFrameFixture.controls,
    width: 180
  }
}

const staleEffectMathFrameFixture: EffectMathRunFrame = {
  ...effectMathFrameFixture,
  controls: {
    ...effectMathFrameFixture.controls,
    alpha: 0.02
  }
}

const canonicalTextFrameFixture = canonicalFrameV1(
  new EffectTextProjectionStep({
    corpusIndex: 0,
    requestedWidthPx: 280,
    stageWidthPx: 280,
    obstaclesEnabled: false
  })
)

const canonicalMathFrameFixture = canonicalFrameV1(
  new EffectMathCanonicalStep({
    controls: effectMathFrameFixture.controls,
    projection: effectMathFrameFixture.projection
  })
)

describe("surface-state reducer", () => {
  it.effect("ignores stale terminal messages from an older run sequence", () =>
    Effect.gen(function*() {
      const state = runningRunState({
        program: programPreviewFixture.program,
        sequence: 2,
        token: 2
      })

      const afterServerCompletion = reduceRunState(state, {
        _tag: "RunStreamCompleteObserved",
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

  it.effect("requires the stream-complete and step-queue facts before sealing success", () =>
    Effect.gen(function*() {
      const running = runningRunState({
        program: programPreviewFixture.program,
        sequence: 6,
        token: 13
      })
      const streamOnly = reduceRunState(running, {
        _tag: "RunStreamCompleteObserved",
        sequence: 6,
        observedAtMs: 10,
        summary: "stream only",
        meta: null
      })
      const stepQueueOnly = reduceRunState(running, {
        _tag: "RunStepQueueDrained",
        sequence: 6,
        observedAtMs: 11
      })
      const successMessage: RunMessage = {
        _tag: "RunSucceeded",
        sequence: 6,
        finalizedAtMs: 12,
        data: runDataFixture("sealed"),
        meta: null
      }

      const beforeGate = reduceRunState(running, successMessage)
      const afterStreamOnly = reduceRunState(streamOnly, successMessage)
      const afterStepQueueOnly = reduceRunState(stepQueueOnly, successMessage)
      const afterBothFacts = reduceRunState(
        reduceRunState(streamOnly, {
          _tag: "RunStepQueueDrained",
          sequence: 6,
          observedAtMs: 11
        }),
        successMessage
      )

      expect(beforeGate).toEqual(running)
      expect(afterStreamOnly).toEqual(streamOnly)
      expect(afterStepQueueOnly).toEqual(stepQueueOnly)
      expect(afterBothFacts._tag).toBe("RunSuccess")
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
      expect(paused._tag).toBe("RunRunning")
      expect(paused.session.control).toBe("paused")
      const checkpointed = reduceRunState(paused, {
        _tag: "RunPauseCheckpointReached",
        sequence: 3,
        observedAtMs: 150
      })
      const serverCompleted = reduceRunState(checkpointed, {
        _tag: "RunStreamCompleteObserved",
        sequence: 3,
        observedAtMs: 180,
        summary: "done",
        meta: null
      })
      const localCompleted = reduceRunState(serverCompleted, {
        _tag: "RunStepQueueDrained",
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
        "run-started",
        "pause-requested",
        "checkpoint-reached",
        "stream-complete-observed",
        "step-queue-drained",
        "run-finalized"
      ])
      expect(succeeded.session.telemetry.events[5]?.detail).toBe("succeeded")
    }))

  it.effect("keeps local frame authority sequence-scoped and clears it on reset", () =>
    Effect.gen(function*() {
      const localProjectionScript = snapshotEffectTextTraversalScript({
        customText: "Frozen text",
        viewportWidthPx: 960
      })
      const running = runningRunState({
        localProjectionScript,
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
        frame: staleEffectTextFrameFixture
      })
      const reset = reduceRunState(withFrame, { _tag: "RunReset" })

      expect(withFrame.session.localProjectionScript).toEqual(localProjectionScript)
      expect(withFrame.session.localRunFrame).toEqual(effectTextFrameFixture)
      expect(afterStaleFrame).toEqual(withFrame)
      expect(reset.session.localProjectionScript).toBeNull()
      expect(reset.session.localRunFrame).toBeNull()
    }))

  it.effect("tracks canonical frame and choreography as reducer-owned stream authority", () =>
    Effect.gen(function*() {
      const running = runningRunState({
        program: programPreviewFixture.program,
        sequence: 8,
        token: 21
      })
      const entered = reduceRunState(
        reduceRunState(running, {
          _tag: "RunCanonicalFrameObserved",
          sequence: 8,
          frame: canonicalTextFrameFixture
        }),
        {
          _tag: "RunChoreographyObserved",
          sequence: 8,
          cue: new StageEnter({ stageId: "corpus-sweep" }),
          state: InStage({ stageId: "corpus-sweep", step: 0, params: {} })
        }
      )
      const staleUpdate = reduceRunState(entered, {
        _tag: "RunCanonicalFrameObserved",
        sequence: 7,
        frame: canonicalMathFrameFixture
      })
      const reset = reduceRunState(entered, { _tag: "RunReset" })

      expect(entered.session.canonicalFrame).toEqual(canonicalTextFrameFixture)
      expect(entered.session.choreography).toEqual(InStage({ stageId: "corpus-sweep", step: 0, params: {} }))
      expect(staleUpdate).toEqual(entered)
      expect(reset.session.canonicalFrame).toBeNull()
      expect(reset.session.choreography._tag).toBe("Idle")
    }))

  it.effect("keeps effect-math local frame authority sequence-scoped and clears it on reset", () =>
    Effect.gen(function*() {
      const controls: PowerControls = {
        d: 1.35,
        n: 77,
        alpha: 0.07
      }
      const localProjectionScript = snapshotEffectMathProjectionScript(controls)
      const running = runningRunState({
        localProjectionScript,
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
        frame: staleEffectMathFrameFixture
      })
      const reset = reduceRunState(withFrame, { _tag: "RunReset" })

      expect(withFrame.session.localProjectionScript).toEqual(localProjectionScript)
      expect(withFrame.session.localRunFrame).toEqual(effectMathFrameFixture)
      expect(afterStaleFrame).toEqual(withFrame)
      expect(reset.session.localProjectionScript).toBeNull()
      expect(reset.session.localRunFrame).toBeNull()
    }))
})
