import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { EntryExecutionError } from "../../app/contracts/entry-error.js"
import { EntryPresentation } from "../../app/contracts/entry/routing.js"
import { presentRun } from "../../app/contracts/presentation/presented-run.js"
import type { Program } from "../../app/contracts/presentation/program.js"
import { EvidenceStreamState } from "../../app/web/state/evidence/stream.js"
import { initialSurfaceState, type SurfaceState } from "../../app/web/state/surface/state.js"
import { surfaceViewModel } from "../../app/web/view/surfaceModel.js"
import {
  effectTextCardFixture as workflowCardFixture,
  programPreviewFixture,
  runDataFixture
} from "../helpers/entry-fixtures.js"
import {
  failedRunState as makeFailedRunState,
  pausedRunState as makePausedRunState,
  stepQueueDrainedRunState,
  succeededRunState as makeSucceededRunState
} from "../helpers/run-state.js"

const fixtureRunData = runDataFixture("surface model fixture")
const fixturePresented = presentRun(fixtureRunData)
const fixtureSurface = EntryPresentation.fromEntryId("workflow")
const emptyEvidenceStream = EvidenceStreamState.empty()
const pausedEvidenceStream = EvidenceStreamState.make({
  sections: fixtureRunData.sections,
  complete: false,
  summary: null,
  meta: null
})

const idleState: SurfaceState = {
  ...initialSurfaceState("workflow"),
  preload: {
    _tag: "PreloadReady",
    data: programPreviewFixture
  }
}

const runSuccessState: SurfaceState = {
  ...initialSurfaceState("workflow"),
  stageTab: "evidence",
  preload: {
    _tag: "PreloadReady",
    data: programPreviewFixture
  },
  run: makeSucceededRunState({ data: fixtureRunData }),
  nextSequence: 2,
  programFileIndex: 0
}

const runFailedState: SurfaceState = {
  ...initialSurfaceState("workflow"),
  stageTab: "evidence",
  preload: {
    _tag: "PreloadReady",
    data: programPreviewFixture
  },
  run: makeFailedRunState({
    error: new EntryExecutionError({
      code: "execution-failed",
      message:
        "ParseError: Required property \"meta\" is missing.\nHuge schema tree details... Huge schema tree details... Huge schema tree details...",
      retryable: false
    }),
    program: programPreviewFixture.program
  }),
  nextSequence: 2,
  programFileIndex: 0
}

const runPausedState: SurfaceState = {
  ...initialSurfaceState("workflow"),
  stageTab: "evidence",
  preload: {
    _tag: "PreloadReady",
    data: programPreviewFixture
  },
  run: makePausedRunState({ program: programPreviewFixture.program }),
  nextSequence: 2,
  programFileIndex: 0
}

describe("Theoria Surface Model", () => {
  it.effect("uses compact mode for summary cards while keeping the deep surface-stage projection available", () =>
    Effect.gen(function*() {
      const model = surfaceViewModel({
        surface: fixtureSurface,
        presented: null,
        state: idleState,
        stream: emptyEvidenceStream,
        variant: "compact"
      })

      expect(model.running).toBe(false)
      expect(model.statusTone).toBe("panel")
      expect(model.evidenceDensity).toBe("compact")
      expect(model.chrome.title).toBe(workflowCardFixture.title)
      expect(model.chrome.packageMeta.value).toBe(workflowCardFixture.packageName)
      expect(model.chrome.primaryAction.label).toBe(fixtureSurface.runLabel)
      expect(model.evidenceRows[0]?.label).toBe("Entry Use Case")
      expect(model.evidenceRows[1]?.label).toBe("Run Intent")
      expect(model.runControls.primary.action).toBe("run")
      expect(model.surfaceStage.showTabs).toBe(true)
      expect(model.surfaceStage.activeTab).toBe("interactive")
    }))

  it.effect("builds the expanded surface from code and surface-stage view models", () =>
    Effect.gen(function*() {
      const model = surfaceViewModel({
        surface: fixtureSurface,
        presented: fixturePresented,
        state: runSuccessState,
        stream: pausedEvidenceStream,
        variant: "expanded"
      })

      expect(model.running).toBe(false)
      expect(model.statusTone).toBe("strip")
      expect(model.evidenceDensity).toBe("expanded")
      expect(model.chrome.badgeLabel).toBe(workflowCardFixture.id)
      expect(model.chrome.useCaseMeta.value).toBe(fixtureSurface.useCase)
      expect(model.code.entry).toBe("server/run.ts")
      expect(model.code.fileName).toBe("run.ts")
      expect(model.code.selectedSourceScope).toBe("run")
      expect(model.code.sourceTabs[0]?.label).toBe("Run Session")
      expect(model.runControls.secondary._tag).toBe("Some")
      expect(model.surfaceStage.showTabs).toBe(true)
      expect(model.surfaceStage.activeTab).toBe("evidence")
      expect(model.surfaceStage.evidence._tag).toBe("RunEvidenceResults")
      expect(model.surfaceStage.hintText).toContain("evidence ledger")
    }))

  it.effect("keeps compact evidence rows focused on the package use case after success", () =>
    Effect.gen(function*() {
      const model = surfaceViewModel({
        surface: fixtureSurface,
        presented: fixturePresented,
        state: runSuccessState,
        stream: pausedEvidenceStream,
        variant: "compact"
      })

      expect(model.evidenceRows[0]?.label).toBe("Entry Use Case")
      expect(model.evidenceRows[1]?.label).toBe("Projection runtime")
    }))

  it.effect("summarizes verbose runtime failures for status readability", () =>
    Effect.gen(function*() {
      const model = surfaceViewModel({
        surface: fixtureSurface,
        presented: null,
        state: runFailedState,
        stream: emptyEvidenceStream,
        variant: "expanded"
      })

      expect(model.status.startsWith("Execution failed:")).toBe(true)
      expect(model.status.includes("Huge schema tree details")).toBe(false)
      expect(model.surfaceStage.evidence._tag).toBe("RunEvidenceFailure")
    }))

  it.effect("derives resume and stop controls from paused run state", () =>
    Effect.gen(function*() {
      const model = surfaceViewModel({
        surface: fixtureSurface,
        presented: null,
        state: runPausedState,
        stream: pausedEvidenceStream,
        variant: "expanded"
      })

      expect(model.running).toBe(false)
      expect(model.status.startsWith("Run paused")).toBe(true)
      expect(model.runControls.primary.action).toBe("resume")
      expect(model.runControls.secondary._tag).toBe("Some")
      expect(model.surfaceStage.evidence._tag).toBe("RunEvidenceInFlight")
      if (model.surfaceStage.evidence._tag === "RunEvidenceInFlight") {
        expect(model.surfaceStage.evidence.control).toBe("paused")
      }
    }))

  it.effect("keeps paused surface-stage copy on stream-owned evidence even while the reducer waits for stream completion", () =>
    Effect.gen(function*() {
      const state: SurfaceState = {
        ...runPausedState,
        run: stepQueueDrainedRunState({ run: runPausedState.run })
      }

      const model = surfaceViewModel({
        surface: fixtureSurface,
        presented: null,
        state,
        stream: pausedEvidenceStream,
        variant: "expanded"
      })

      expect(model.status).toBe("Run paused. Resume to continue streaming evidence.")
      expect(model.surfaceStage.evidence._tag).toBe("RunEvidenceInFlight")
      if (model.surfaceStage.evidence._tag === "RunEvidenceInFlight") {
        expect(model.surfaceStage.evidence.description).toBe("Resume to continue streaming evidence.")
        expect(model.surfaceStage.evidence.control).toBe("paused")
      }
    }))

  it.effect("normalizes stale program file selection to the real prepared file set", () =>
    Effect.gen(function*() {
      const state: SurfaceState = {
        ...idleState,
        programFileIndex: 8,
        preload: {
          _tag: "PreloadReady",
          data: {
            ...programPreviewFixture,
            program: {
              files: [
                {
                  language: "ts",
                  entry: "workflow/baseline.graph.ts",
                  name: "baseline.graph.ts",
                  source: "export const baselineWorkflow = { variant: 'baseline' }"
                },
                {
                  language: "ts",
                  entry: "workflow/optimized.graph.ts",
                  name: "optimized.graph.ts",
                  source: "export const optimizedWorkflow = { variant: 'optimized' }"
                }
              ]
            }
          }
        }
      }

      const model = surfaceViewModel({
        surface: fixtureSurface,
        presented: null,
        state,
        stream: emptyEvidenceStream,
        variant: "expanded"
      })

      expect(model.code.selectedFileIndex).toBe(0)
      expect(model.code.fileName).toBe("baseline.graph.ts")
      expect(model.code.fileTabs[1]?.name).toBe("optimized.graph.ts")
      expect(model.code.fileTabs[1]?.directory).toBe("workflow")
      expect(model.code.originLabel).toBe("Prepared")
      expect(model.code.selectedSourceScope).toBe("prepared")
    }))

  it.effect("surfaces run and prepared workspaces as separate IDE tabs when their source sets differ", () =>
    Effect.gen(function*() {
      const preparedProgram: Program = {
        files: [
          {
            language: "ts",
            entry: "workflow/baseline.graph.ts",
            name: "baseline.graph.ts",
            source: "export const baselineWorkflow = { preload: true }"
          },
          {
            language: "ts",
            entry: "workflow/optimized.graph.ts",
            name: "optimized.graph.ts",
            source: "export const optimizedWorkflow = { source: 'prepared' }"
          }
        ]
      }
      const runProgram: Program = {
        files: [{
          language: "ts",
          entry: "workflow/baseline.graph.ts",
          name: "baseline.graph.ts",
          source: "export const baselineWorkflow = { source: 'executed' }"
        }]
      }
      const state: SurfaceState = {
        ...runSuccessState,
        programSourceScope: "prepared",
        preload: {
          _tag: "PreloadReady",
          data: {
            ...programPreviewFixture,
            program: preparedProgram
          }
        },
        run: makeSucceededRunState({
          data: {
            ...fixtureRunData,
            program: runProgram
          }
        })
      }

      const model = surfaceViewModel({
        surface: fixtureSurface,
        presented: fixturePresented,
        state,
        stream: pausedEvidenceStream,
        variant: "expanded"
      })

      expect(model.code.selectedSourceScope).toBe("prepared")
      expect(model.code.sourceTabs.map((tab) => tab.label)).toEqual(["Run Session", "Prepared"])
      expect(model.code.fileTabs).toHaveLength(2)
      expect(model.code.fileName).toBe("baseline.graph.ts")
    }))
})
