import { Registry } from "@effect-atom/atom"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import {
  optimizationAnimatingAtom,
  randomTrialsAtom,
  tpeTrialsAtom,
  trialBudgetAtom
} from "../../app/web/atoms/optimization-animation.js"
import { surfaceRunLifecycleDiagnosticsViewModelAtom } from "../../app/web/atoms/run-diagnostics.js"
import { surfaceAtom } from "../../app/web/atoms/surface.js"
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

      registry.set(trialBudgetAtom, 30)
      registry.set(optimizationAnimatingAtom, true)
      registry.set(tpeTrialsAtom, [{ x: 1, y: 2, value: 3, index: 0 }])
      registry.set(randomTrialsAtom, [{ x: 4, y: 5, value: 6, index: 0 }])
      registry.update(surfaceAtom("effect-search"), (state) => ({
        ...state,
        run: runningRunState({
          program: programPreviewFixture.program,
          startedAtMs: 100,
          sequence: 2,
          token: 2
        })
      }))

      const viewModel = registry.get(surfaceRunLifecycleDiagnosticsViewModelAtom("effect-search"))
      const rows = viewModel?.sections.flatMap((section) => section.rows) ?? []

      expect(viewModel).not.toBeNull()
      expect(rows.some((row) => row.label === "Optimizer animation" && row.value === "active")).toBe(true)
      expect(rows.some((row) => row.label === "Optimizer phase" && row.value === "running")).toBe(true)
      expect(rows.some((row) => row.label === "Search trials" && row.value === "tpe 1/30 · random 1/30")).toBe(true)
    }))
})
