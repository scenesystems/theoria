import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as SearchStudyEvent from "effect-search/StudyEvent"

import { projectEffectSearchStudyTelemetry } from "../../app/contracts/capability/effect-search-study-telemetry-projection.js"
import { SearchConfig } from "../../app/contracts/capability/effect-search.js"
import { surfaceRunLifecycleDiagnosticsViewModelAtom } from "../../app/web/atoms/run/diagnostics.js"
import { EffectSearchRunFrame, OptimizationProjection } from "../../app/web/atoms/run/optimization-animation.js"
import { surfaceAtom } from "../../app/web/atoms/surface/state.js"
import { reduceRunState } from "../../app/web/state/run/reducer.js"
import { programPreviewFixture } from "../helpers/entry-fixtures.js"
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
      const localProjectionScript = SearchConfig.fromTrialBudget(30).projectionScript()
      const telemetry = projectEffectSearchStudyTelemetry({
        randomEvents: [
          SearchStudyEvent.TrialStarted.make({ trialNumber: 0, config: { x: 0.75, y: -0.5 } }),
          SearchStudyEvent.TrialCompleted.make({ trialNumber: 0, value: 0.45 }),
          SearchStudyEvent.BestUpdated.make({ trialNumber: 0, value: 0.45 })
        ],
        randomTrialPoints: [{ x: 0.75, y: -0.5, value: 0.45, index: 0 }],
        trialBudget: 30,
        tpeEvents: [
          SearchStudyEvent.TrialStarted.make({ trialNumber: 0, config: { x: -1.25, y: 0.25 } }),
          SearchStudyEvent.TrialCompleted.make({ trialNumber: 0, value: 0.12 }),
          SearchStudyEvent.BestUpdated.make({ trialNumber: 0, value: 0.12 }),
          SearchStudyEvent.TrialStarted.make({ trialNumber: 1, config: { x: -1.1, y: 0.4 } }),
          SearchStudyEvent.TrialCompleted.make({ trialNumber: 1, value: 0.08 }),
          SearchStudyEvent.BestUpdated.make({ trialNumber: 1, value: 0.08 })
        ],
        tpeTrialPoints: [
          { x: -1.25, y: 0.25, value: 0.12, index: 0 },
          { x: -1.1, y: 0.4, value: 0.08, index: 1 }
        ]
      })
      const running = runningRunState({
        localProjectionScript,
        program: programPreviewFixture.program,
        startedAtMs: 100,
        sequence: 2,
        token: 2
      })
      const effectSearchFrame = EffectSearchRunFrame.make({
        projection: OptimizationProjection.fromTrials({
          phase: "running",
          randomTrials: [{ x: 0.75, y: -0.5, value: 0.45, index: 0 }],
          tpeTrials: [
            { x: -1.25, y: 0.25, value: 0.12, index: 0 },
            { x: -1.1, y: 0.4, value: 0.08, index: 1 }
          ],
          trialBudget: 30
        }),
        telemetry
      })
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
