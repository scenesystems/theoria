import type { WorkflowComparisonRunPlan } from "../../../contracts/workflow/comparison-run.js"
import type { WorkflowComparisonGraphViewModel } from "./workflow-comparison-graph-model.js"
import type { WorkflowComparisonTranscriptViewModel } from "./workflow-comparison-transcript-model.js"

export type WorkflowComparisonRenderedPreviewPaneViewModel = {
  readonly key: "baseline" | "comparison-target"
  readonly label: string
  readonly score: string
  readonly body: string
  readonly note: string
}

export type WorkflowComparisonRenderedPreviewMetricViewModel = {
  readonly label: string
  readonly value: string
}

export type WorkflowComparisonRenderedPreviewViewModel = {
  readonly description: string
  readonly panes: ReadonlyArray<WorkflowComparisonRenderedPreviewPaneViewModel>
  readonly metrics: ReadonlyArray<WorkflowComparisonRenderedPreviewMetricViewModel>
}

const scoreValue = (
  graph: WorkflowComparisonGraphViewModel,
  key: WorkflowComparisonGraphViewModel["cards"][number]["key"]
): number | null => {
  const raw = graph.cards.find((card) => card.key === key)?.score ?? "n/a"
  return raw === "n/a" ? null : Number(raw)
}

const formatDelta = (baseline: number | null, improved: number | null): string =>
  baseline === null || improved === null
    ? "n/a"
    : `${improved >= baseline ? "+" : ""}${(improved - baseline).toFixed(3)}`

const latestOutputFor = (
  transcript: WorkflowComparisonTranscriptViewModel,
  variant: WorkflowComparisonTranscriptViewModel["entries"][number]["variant"]
): WorkflowComparisonTranscriptViewModel["entries"][number] | null => {
  const preferred = transcript.entries.filter((entry) => entry.variant === variant && entry.nodeKind === "responder")
    .at(-1)

  return preferred ?? transcript.entries.filter((entry) => entry.variant === variant).at(-1) ?? null
}

export const workflowComparisonRenderedPreviewViewModel = ({
  graph,
  plan,
  transcript
}: {
  readonly graph: WorkflowComparisonGraphViewModel
  readonly plan: WorkflowComparisonRunPlan
  readonly transcript: WorkflowComparisonTranscriptViewModel
}): WorkflowComparisonRenderedPreviewViewModel => {
  const baseline = latestOutputFor(transcript, "baseline")
  const comparisonTarget = latestOutputFor(transcript, "optimized")
  const baselineScore = scoreValue(graph, "baseline")
  const authoredScore = scoreValue(graph, "authored-optimized")
  const winnerScore = scoreValue(graph, "search-winner")
  const comparisonTargetLabel = plan.comparisonMode === "authored-optimized"
    ? "Authored Optimized Output"
    : "Search Winner Output"
  const comparisonTargetScore = plan.comparisonMode === "authored-optimized"
    ? graph.cards.find((card) => card.key === "authored-optimized")?.score ?? "n/a"
    : graph.cards.find((card) => card.key === "search-winner")?.score ?? "n/a"

  return {
    description: comparisonTarget === null
      ? "Rendered preview stays empty until the canonical ledger yields baseline and winner outputs."
      : plan.comparisonMode === "authored-optimized"
      ? "These previews stay on the same execution record while keeping the study winner evidence available separately in the progress lane."
      : "These previews stay on the same execution record as the graph cards and evidence stack.",
    panes: [
      {
        key: "baseline",
        label: "Baseline Output",
        score: graph.cards.find((card) => card.key === "baseline")?.score ?? "n/a",
        body: baseline?.output ?? "Await the baseline replay to materialize a human-facing output preview.",
        note: baseline?.nodeId ?? "Baseline response"
      },
      {
        key: "comparison-target",
        label: comparisonTargetLabel,
        score: comparisonTargetScore,
        body: comparisonTarget?.output ??
          "Await the frozen comparison target replay to materialize the final output preview.",
        note: comparisonTarget?.isCurrent === true
          ? `${comparisonTarget.nodeId} · current canonical output`
          : comparisonTarget?.nodeId ?? "Comparison target response"
      }
    ],
    metrics: [
      { label: "Baseline score", value: graph.cards.find((card) => card.key === "baseline")?.score ?? "n/a" },
      {
        label: "Authored optimized score",
        value: graph.cards.find((card) => card.key === "authored-optimized")?.score ?? "n/a"
      },
      { label: "Search winner score", value: graph.cards.find((card) => card.key === "search-winner")?.score ?? "n/a" },
      { label: "Winner delta vs baseline", value: formatDelta(baselineScore, winnerScore) },
      { label: "Winner delta vs authored optimized", value: formatDelta(authoredScore, winnerScore) }
    ]
  }
}
