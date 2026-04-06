import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { canonicalFrameV1 } from "../../app/contracts/canonical-step.js"
import { corpus } from "../../app/contracts/corpus.js"
import { EffectTextProjectionStep, snapshotEffectTextRunPlan } from "../../app/contracts/demo/text.js"
import {
  customTextAtom,
  type EffectTextRunFrame,
  reflowControlsAtom,
  reflowStageViewportWidthAtom
} from "../../app/web/atoms/reflow.js"
import { surfaceAtom } from "../../app/web/atoms/surface.js"
import { reflowWidgetViewModelAtom } from "../../app/web/atoms/widget-view-models.js"
import { reduceRunState } from "../../app/web/state/types.js"
import { programPreviewFixture } from "../helpers/demo-fixtures.js"
import { runningRunState } from "../helpers/run-state.js"

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

const canonicalFrameFixture = canonicalFrameV1(
  new EffectTextProjectionStep({
    corpusIndex: corpus.length,
    requestedWidthPx: 420,
    stageWidthPx: 420,
    obstaclesEnabled: true
  })
)

describe("runtime spine playground authority", () => {
  it.effect("keeps widget controls as playground-only state until the active run authority resets", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const running = runningRunState({
        localRunPlan: snapshotEffectTextRunPlan({
          customText: "Frozen runtime text",
          viewportWidthPx: 960
        }),
        program: programPreviewFixture.program
      })
      const active = reduceRunState(
        reduceRunState(running, {
          _tag: "RunCanonicalFrameObserved",
          sequence: 1,
          frame: canonicalFrameFixture
        }),
        {
          _tag: "RunFrameUpdated",
          sequence: 1,
          frame: frameFixture
        }
      )
      const reset = reduceRunState(active, { _tag: "RunReset" })

      registry.set(customTextAtom, "Playground text")
      registry.set(reflowControlsAtom, {
        corpusIndex: 0,
        width: 180,
        obstaclesEnabled: false
      })
      registry.set(reflowStageViewportWidthAtom, 260)
      registry.update(surfaceAtom("effect-text"), (state) => ({
        ...state,
        run: active
      }))

      const activeView = registry.get(reflowWidgetViewModelAtom)

      expect(activeView.selectedCorpusIndex).toBe(corpus.length)
      expect(activeView.customText).toBe("Frozen runtime text")
      expect(activeView.width.value).toBe(420)
      expect(activeView.obstaclesEnabled).toBe(true)

      registry.update(surfaceAtom("effect-text"), (state) => ({
        ...state,
        run: reset
      }))

      const resetView = registry.get(reflowWidgetViewModelAtom)

      expect(resetView.selectedCorpusIndex).toBe(0)
      expect(resetView.customText).toBe("Playground text")
      expect(resetView.width.value).toBe(180)
      expect(resetView.obstaclesEnabled).toBe(false)
    }))
})
