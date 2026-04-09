import { Match } from "effect"

import { type WorkflowTargetMode, workflowTargetModeLabel } from "./controls.js"
import { workflowNodeExecutionSectionTitle } from "./evidence.js"
import type { WorkflowCanonicalStep } from "./step.js"

const formatScore = (value: number | null): string => (value === null ? "n/a" : value.toFixed(3))

export type WorkflowSurfacePhase = "failed" | "idle" | "paused" | "running" | "stopping" | "succeeded"

export const workflowCurrentStepMeta = ({
  bestScore,
  completedTrials,
  currentScore,
  step,
  trialBudget
}: {
  readonly bestScore: number | null
  readonly completedTrials: number | null
  readonly currentScore: number | null
  readonly step: WorkflowCanonicalStep | null
  readonly trialBudget: number | null
}): string =>
  step === null
    ? "The graph view only advances from canonical stream frames."
    : step.nodeId === "optimization-study"
    ? `Trials ${completedTrials ?? 0}/${trialBudget ?? 0} · best ${formatScore(bestScore)} · current ${
      formatScore(currentScore)
    }`
    : `${step.runtimeRole} · state lanes ${step.activeStateLanes.join(", ")}`

export const workflowCurrentStepText = (step: WorkflowCanonicalStep | null): string =>
  step === null
    ? "Await a server-authored workflow step."
    : `${workflowNodeExecutionSectionTitle(step)} · score ${step.aggregateScore.toFixed(3)}`

export const workflowRunStory = ({
  optimize,
  targetMode
}: {
  readonly optimize: boolean
  readonly targetMode: WorkflowTargetMode
}): string =>
  !optimize
    ? "baseline -> authored optimized replay"
    : targetMode === "authored-optimized"
    ? "baseline -> study -> authored optimized replay"
    : "baseline -> study -> search winner replay"

export const workflowSurfacePhaseLabel = (phase: WorkflowSurfacePhase): string =>
  Match.value(phase).pipe(
    Match.when("idle", () => "Idle"),
    Match.when("running", () => "Running"),
    Match.when("paused", () => "Paused"),
    Match.when("stopping", () => "Stopping"),
    Match.when("failed", () => "Failed"),
    Match.when("succeeded", () => "Succeeded"),
    Match.exhaustive
  )

export const workflowSurfacePhaseDetail = ({
  hasFrozenSelection,
  optimize,
  phase,
  targetMode
}: {
  readonly hasFrozenSelection: boolean
  readonly optimize: boolean
  readonly phase: WorkflowSurfacePhase
  readonly targetMode: WorkflowTargetMode
}): string =>
  Match.value(phase).pipe(
    Match.when(
      "idle",
      () =>
        !hasFrozenSelection
          ? "Select a proving scenario, then freeze one run plan on the shared runtime seam."
          : "The frozen run plan remains inspectable until reset restores scenario selection."
    ),
    Match.when(
      "running",
      () => "Canonical graph frames and evidence sections are streaming from one server-authored execution."
    ),
    Match.when(
      "paused",
      () => "The run authority is paused without handing graph or score truth back to local state."
    ),
    Match.when("stopping", () => "The active run is being interrupted at the shared runtime seam."),
    Match.when(
      "failed",
      () => "The current execution failed before the success gate sealed the authoritative ledger."
    ),
    Match.when(
      "succeeded",
      () => `The completed run sealed ${workflowRunStory({ optimize, targetMode })} on one canonical ledger.`
    ),
    Match.exhaustive
  )

export const workflowAuthoredOptimizedAnchorLabel = (): string =>
  `${workflowTargetModeLabel("authored-optimized")} Anchor`
