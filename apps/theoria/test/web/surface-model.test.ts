import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { DemoExecutionError } from "../../app/contracts/demo-error.js"
import type { Program } from "../../app/contracts/presentation.js"
import { entryPresentationForId } from "../../app/contracts/proving-substrate.js"
import {
  emptyEvidenceStreamState,
  type EvidenceStreamState,
  initialSurfaceState,
  type SurfaceState
} from "../../app/web/state/types.js"
import { presentRun } from "../../app/web/view/presenter.js"
import { surfaceViewModel } from "../../app/web/view/surfaceModel.js"
import { effectTextCardFixture, programPreviewFixture, runDataFixture } from "../helpers/demo-fixtures.js"
import {
  failedRunState as makeFailedRunState,
  pausedRunState as makePausedRunState,
  stepQueueDrainedRunState,
  succeededRunState as makeSucceededRunState
} from "../helpers/run-state.js"

const fixtureRunData = runDataFixture("surface model fixture")
const fixturePresented = presentRun(fixtureRunData)
const fixtureSurface = entryPresentationForId(effectTextCardFixture.id)
const pausedEvidenceStream: EvidenceStreamState = {
  sections: fixtureRunData.sections,
  complete: false,
  summary: null,
  meta: null
}

const idleState: SurfaceState = {
  ...initialSurfaceState("effect-text"),
  preload: {
    _tag: "PreloadReady",
    data: programPreviewFixture
  }
}

const runSuccessState: SurfaceState = {
  ...initialSurfaceState("effect-text"),
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
  ...initialSurfaceState("effect-text"),
  stageTab: "evidence",
  preload: {
    _tag: "PreloadReady",
    data: programPreviewFixture
  },
  run: makeFailedRunState({
    error: new DemoExecutionError({
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
  ...initialSurfaceState("effect-text"),
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
  it.effect("uses compact mode for summary cards while keeping the deep-stage projection available", () =>
    Effect.gen(function*() {
      const model = surfaceViewModel({
        surface: fixtureSurface,
        presented: null,
        state: idleState,
        stream: emptyEvidenceStreamState,
        variant: "compact"
      })

      expect(model.running).toBe(false)
      expect(model.statusTone).toBe("panel")
      expect(model.evidenceDensity).toBe("compact")
      expect(model.chrome.title).toBe(effectTextCardFixture.title)
      expect(model.chrome.packageMeta.value).toBe(effectTextCardFixture.packageName)
      expect(model.chrome.primaryAction.label).toBe(effectTextCardFixture.runLabel)
      expect(model.evidenceRows[0]?.label).toBe("Package Use Case")
      expect(model.evidenceRows[1]?.label).toBe("Run Intent")
      expect(model.runControls.primary.action).toBe("run")
      expect(model.stage.showTabs).toBe(true)
      expect(model.stage.activeTab).toBe("interactive")
    }))

  it.effect("builds the expanded surface from code and stage view models", () =>
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
      expect(model.chrome.badgeLabel).toBe(effectTextCardFixture.id)
      expect(model.chrome.useCaseMeta.value).toBe(fixtureSurface.useCase)
      expect(model.code.entry).toBe("server/run.ts")
      expect(model.code.fileName).toBe("run.ts")
      expect(model.code.selectedSourceScope).toBe("run")
      expect(model.code.sourceTabs[0]?.label).toBe("Run Session")
      expect(model.runControls.secondary._tag).toBe("Some")
      expect(model.stage.showTabs).toBe(true)
      expect(model.stage.activeTab).toBe("evidence")
      expect(model.stage.evidence._tag).toBe("results")
      expect(model.stage.hintText).toContain("obstacle-aware projection")
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

      expect(model.evidenceRows[0]?.label).toBe("Package Use Case")
      expect(model.evidenceRows[1]?.label).toBe("Projection runtime")
    }))

  it.effect("summarizes verbose runtime failures for status readability", () =>
    Effect.gen(function*() {
      const model = surfaceViewModel({
        surface: fixtureSurface,
        presented: null,
        state: runFailedState,
        stream: emptyEvidenceStreamState,
        variant: "expanded"
      })

      expect(model.status.startsWith("Execution failed:")).toBe(true)
      expect(model.status.includes("Huge schema tree details")).toBe(false)
      expect(model.stage.evidence._tag).toBe("failure")
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
      expect(model.stage.evidence._tag).toBe("paused")
    }))

  it.effect("keeps paused stage copy on stream-owned evidence even while the reducer waits for stream completion", () =>
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
      expect(model.stage.evidence._tag).toBe("paused")
      if (model.stage.evidence._tag === "paused") {
        expect(model.stage.evidence.description).toBe("Resume to continue streaming evidence.")
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
                  entry: "server/run.ts",
                  name: "run.ts",
                  source: "export const run = Effect.succeed('ok')"
                },
                {
                  language: "ts",
                  entry: "web/atoms/animation.ts",
                  name: "animation.ts",
                  source: "export const animation = 'live'"
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
        stream: emptyEvidenceStreamState,
        variant: "expanded"
      })

      expect(model.code.selectedFileIndex).toBe(0)
      expect(model.code.fileName).toBe("run.ts")
      expect(model.code.fileTabs[1]?.name).toBe("animation.ts")
      expect(model.code.fileTabs[1]?.directory).toBe("web/atoms")
      expect(model.code.originLabel).toBe("Prepared")
      expect(model.code.selectedSourceScope).toBe("prepared")
    }))

  it.effect("surfaces run and prepared workspaces as separate IDE tabs when their source sets differ", () =>
    Effect.gen(function*() {
      const preparedProgram: Program = {
        files: [
          {
            language: "ts",
            entry: "server/run.ts",
            name: "run.ts",
            source: "export const preload = true"
          },
          {
            language: "ts",
            entry: "web/atoms/animation.ts",
            name: "animation.ts",
            source: "export const animation = 'prepared'"
          }
        ]
      }
      const runProgram: Program = {
        files: [{
          language: "ts",
          entry: "server/run.ts",
          name: "run.ts",
          source: "export const run = 'executed'"
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
      expect(model.code.fileName).toBe("run.ts")
    }))
})
