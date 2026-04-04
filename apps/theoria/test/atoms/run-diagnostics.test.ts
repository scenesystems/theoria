import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import {
  optimizationAnimatingAtom,
  randomTrialsAtom,
  snapshotEffectSearchRunPlan,
  tpeTrialsAtom,
  trialBudgetAtom
} from "../../app/web/atoms/optimization-animation.js"
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
  it.effect("exposes effect-search local driver rows beside reducer telemetry", () =>
    Effect.gen(function*() {
      const registry = makeTestRegistry()
      const localRunPlan = snapshotEffectSearchRunPlan(30)
      const running = runningRunState({
        localRunPlan,
        program: programPreviewFixture.program,
        startedAtMs: 100,
        sequence: 2,
        token: 2
      })
      const withFrame = reduceRunState(running, {
        _tag: "RunFrameUpdated",
        sequence: 2,
        frame: {
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
          }
        }
      })

      registry.set(trialBudgetAtom, 30)
      registry.set(optimizationAnimatingAtom, true)
      registry.set(tpeTrialsAtom, [{ x: 1, y: 2, value: 3, index: 0 }])
      registry.set(randomTrialsAtom, [{ x: 4, y: 5, value: 6, index: 0 }])
      registry.update(surfaceAtom("effect-search"), (state) => ({
        ...state,
        run: withFrame
      }))

      const viewModel = registry.get(surfaceRunLifecycleDiagnosticsViewModelAtom("effect-search"))
      const rows = viewModel?.sections.flatMap((section) => section.rows) ?? []

      expect(viewModel).not.toBeNull()
      expect(rows.some((row) => row.label === "Optimizer animation" && row.value === "active")).toBe(true)
      expect(rows.some((row) => row.label === "Optimizer phase" && row.value === "running")).toBe(true)
      expect(rows.some((row) => row.label === "Search trials" && row.value === "tpe 2/30 · random 1/30")).toBe(true)
    }))
})
