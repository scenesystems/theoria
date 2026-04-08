import { Match } from "effect"

import type { EvidenceSection } from "../../../../contracts/evidence/item.js"
import type { CanonicalFrame } from "../../../../contracts/study/workflow/canonical-step.js"
import { workflowComparisonEvidenceProjectionFromSections } from "./evidence-projection.js"

export type WorkflowComparisonGraphCardViewModel = {
  readonly key: "baseline" | "authored-optimized" | "search-winner"
  readonly label: string
  readonly score: string
  readonly nodeCount: string
  readonly traversal: string
  readonly detail: string
}

export type WorkflowComparisonGraphViewModel = {
  readonly currentStep: string
  readonly currentStepMeta: string
  readonly cards: ReadonlyArray<WorkflowComparisonGraphCardViewModel>
}

const formatScore = (value: number | null): string => (value === null ? "n/a" : value.toFixed(3))

const formatNodeCount = (value: number | null): string => (value === null ? "n/a" : `${value}`)

const traversalSummary = (nodes: ReadonlyArray<string>, fallback: string): string =>
  nodes.length === 0 ? fallback : nodes.join(" -> ")

const variantLabel = (variant: "baseline" | "optimized"): string =>
  Match.value(variant).pipe(
    Match.when("baseline", () => "Baseline"),
    Match.when("optimized", () => "Optimized"),
    Match.exhaustive
  )

const currentStepFromFrame = (frame: CanonicalFrame | null) =>
  frame !== null && frame.step._tag === "WorkflowComparisonCanonicalStep" ? frame.step : null

export const workflowComparisonGraphViewModel = ({
  frame,
  sections
}: {
  readonly frame: CanonicalFrame | null
  readonly sections: ReadonlyArray<EvidenceSection>
}): WorkflowComparisonGraphViewModel => {
  const projection = workflowComparisonEvidenceProjectionFromSections(sections)
  const baselineTraversal = projection.graphs.baseline.traversal
  const winnerTraversal = projection.optimizationWinner?.winnerTraversal ?? projection.graphs.optimized.traversal
  const winnerKnobs = projection.optimizationWinner?.selectedKnobs.map(([key, value]) => `${key}=${value}`) ?? []
  const baselineScore = projection.comparisonDelta.aggregateScore.baseline
  const authoredScore = projection.optimizationSummary?.winnerVsAuthoredOptimizedScore.baseline ?? null
  const winnerScore = projection.optimizationSummary?.winnerVsAuthoredOptimizedScore.improved
    ?? projection.optimizationProgress?.bestScore
    ?? null
  const baselineNodeCount = projection.comparisonDelta.graphNodes.baseline
  const authoredNodeCount = projection.optimizationSummary?.winnerVsAuthoredOptimizedNodeCount.baseline ?? null
  const winnerNodeCount = projection.optimizationSummary?.winnerVsAuthoredOptimizedNodeCount.improved ?? null
  const currentStep = currentStepFromFrame(frame)
  const optimizationProgress = projection.optimizationProgress
  const bestSelection = optimizationProgress?.bestSelection ?? null

  return {
    currentStep: currentStep === null
      ? "Await a server-authored workflow step."
      : `${variantLabel(currentStep.variant)} · ${currentStep.nodeId} · score ${currentStep.aggregateScore.toFixed(3)}`,
    currentStepMeta: currentStep === null
      ? "The graph view only advances from canonical stream frames."
      : currentStep.nodeId === "optimization-study" && optimizationProgress !== null
      ? `Trials ${optimizationProgress.completedTrials ?? 0}/${optimizationProgress.trialBudget ?? 0} · best ${
        formatScore(optimizationProgress.bestScore)
      } · current ${formatScore(optimizationProgress.currentScore)}`
      : `${currentStep.runtimeRole} · state lanes ${currentStep.activeStateLanes.join(", ")}`,
    cards: [
      {
        key: "baseline",
        label: "Baseline Graph",
        score: formatScore(baselineScore),
        nodeCount: formatNodeCount(baselineNodeCount),
        traversal: traversalSummary(baselineTraversal, "Baseline traversal arrives once the authored ledger begins."),
        detail: "Frozen baseline execution under the shared evaluation and render envelope."
      },
      {
        key: "authored-optimized",
        label: "Authored Optimized Anchor",
        score: formatScore(authoredScore),
        nodeCount: formatNodeCount(authoredNodeCount),
        traversal: "Held as the study anchor inside the optimization phase.",
        detail: "Use this as the pre-search package-authored target before the winner replay lands."
      },
      {
        key: "search-winner",
        label: "Search Winner Replay",
        score: formatScore(winnerScore),
        nodeCount: formatNodeCount(winnerNodeCount),
        traversal: traversalSummary(winnerTraversal, "Winner traversal appears after the study selects a manifest."),
        detail: winnerKnobs.length === 0
          ? bestSelection === null
            ? "Study-selected knobs stream here once the search winner is known."
            : `Best so far: ${bestSelection}`
          : winnerKnobs.join(" · ")
      }
    ]
  }
}
