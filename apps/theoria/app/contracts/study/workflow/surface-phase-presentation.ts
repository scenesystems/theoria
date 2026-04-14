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
    ? "Start a run to watch the workflow advance step by step."
    : step.nodeId === "optimization-study"
    ? `Trials ${completedTrials ?? 0}/${trialBudget ?? 0} · best ${formatScore(bestScore)} · current ${
      formatScore(currentScore)
    }`
    : `${step.runtimeRole} · active state ${step.activeStateLanes.join(", ")}`

export const workflowCurrentStepText = (step: WorkflowCanonicalStep | null): string =>
  step === null
    ? "Run the study to see the first workflow step."
    : `${workflowNodeExecutionSectionTitle(step)} · score ${step.aggregateScore.toFixed(3)}`

export const workflowRunStory = ({
  optimize,
  targetMode
}: {
  readonly optimize: boolean
  readonly targetMode: WorkflowTargetMode
}): string =>
  !optimize
    ? "Baseline -> authored improvement"
    : targetMode === "authored-optimized"
    ? "Baseline -> search -> authored improvement replay"
    : "Baseline -> search -> winner replay"

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
          ? "Choose a workflow and shape the run you want to compare."
          : "This run plan is frozen so you can inspect it, run it, or reset to choose a different workflow."
    ),
    Match.when(
      "running",
      () => "The study is live: scores, graph steps, and evidence are arriving now."
    ),
    Match.when(
      "paused",
      () => "The study is paused. Resume when you are ready to keep collecting evidence."
    ),
    Match.when("stopping", () => "Stopping the current study run."),
    Match.when(
      "failed",
      () => "This run stopped before it could finish writing a complete result."
    ),
    Match.when(
      "succeeded",
      () => `Completed: ${workflowRunStory({ optimize, targetMode })}.`
    ),
    Match.exhaustive
  )

export const workflowAuthoredOptimizedAnchorLabel = (): string =>
  `${workflowTargetModeLabel("authored-optimized")} Anchor`
