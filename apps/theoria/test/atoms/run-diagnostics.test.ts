import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import * as SearchStudyEvent from "effect-search/StudyEvent"

import { makeEffectSearchStudyTelemetry } from "../../app/contracts/demo/effect-search-study-telemetry.js"
import { snapshotEffectSearchRunPlan } from "../../app/web/atoms/optimization-animation.js"
import type { EffectSearchRunFrame } from "../../app/web/atoms/optimization-animation.js"
import { surfaceRunLifecycleDiagnosticsViewModelAtom } from "../../app/web/atoms/run-diagnostics.js"
import { surfaceAtom } from "../../app/web/atoms/surface.js"
import { reduceRunState } from "../../app/web/state/types.js"
import { programPreviewFixture } from "../helpers/demo-fixtures.js"
import { runningRunState } from "../helpers/run-state.js"

const makeTestRegistry = (): Registry.Registry =>
  Registry.make({
    scheduleTask: (f) => {
      f()
    }
  })

describe("run diagnostics atoms", () => {
  it.effect("exposes effect-search StudyEvent telemetry instead of local optimizer atoms", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const localRunPlan = snapshotEffectSearchRunPlan(30)
      const telemetry = makeEffectSearchStudyTelemetry({
        randomEvents: [
          SearchStudyEvent.TrialStarted({ trialNumber: 0, config: { x: 0.75, y: -0.5 } }),
          SearchStudyEvent.TrialCompleted({ trialNumber: 0, value: 0.45 }),
          SearchStudyEvent.BestUpdated({ trialNumber: 0, value: 0.45 })
        ],
        randomTrialPoints: [{ x: 0.75, y: -0.5, value: 0.45, index: 0 }],
        trialBudget: 30,
        tpeEvents: [
          SearchStudyEvent.TrialStarted({ trialNumber: 0, config: { x: -1.25, y: 0.25 } }),
          SearchStudyEvent.TrialCompleted({ trialNumber: 0, value: 0.12 }),
          SearchStudyEvent.BestUpdated({ trialNumber: 0, value: 0.12 }),
          SearchStudyEvent.TrialStarted({ trialNumber: 1, config: { x: -1.1, y: 0.4 } }),
          SearchStudyEvent.TrialCompleted({ trialNumber: 1, value: 0.08 }),
          SearchStudyEvent.BestUpdated({ trialNumber: 1, value: 0.08 })
        ],
        tpeTrialPoints: [
          { x: -1.25, y: 0.25, value: 0.12, index: 0 },
          { x: -1.1, y: 0.4, value: 0.08, index: 1 }
        ]
      })
      const running = runningRunState({
        localRunPlan,
        program: programPreviewFixture.program,
        startedAtMs: 100,
        sequence: 2,
        token: 2
      })
      const effectSearchFrame: EffectSearchRunFrame = {
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
        telemetry
      }
      const withFrame = reduceRunState(running, {
        _tag: "RunFrameUpdated",
        sequence: 2,
        frame: effectSearchFrame
      })

      registry.update(surfaceAtom("effect-search"), (state) => ({
        ...state,
        run: withFrame
      }))

      const viewModel = registry.get(surfaceRunLifecycleDiagnosticsViewModelAtom("effect-search"))
      const rows = viewModel?.sections.flatMap((section) => section.rows) ?? []

      expect(viewModel).not.toBeNull()
      expect(viewModel?.sections.map((section) => section.title)).toContain("Study runtime")
      expect(viewModel?.sections.map((section) => section.title)).toContain("Study event trace")
      expect(rows.some((row) => row.label === "Frozen plan" && row.value === "30 trials per sampler · seed 42")).toBe(
        true
      )
      expect(rows.some((row) => row.label === "Optimizer phase" && row.value === "running")).toBe(true)
      expect(rows.some((row) => row.label === "TPE study" && row.value === "2/30 completed · 6 events · best 0.080000"))
        .toBe(true)
      expect(
        rows.some((row) => row.label === "Random study" && row.value === "1/30 completed · 3 events · best 0.450000")
      ).toBe(true)
      expect(rows.some((row) => row.label === "TPE · Best updated #1" && row.value === "0.080000")).toBe(true)
      expect(rows.some((row) => row.label === "Optimizer animation")).toBe(false)
    }))
})
