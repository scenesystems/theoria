import { Match } from "effect"

export type WorkflowGraphCardMetric = "nodes" | "score"

export type WorkflowGraphCardKind = "authored-optimized" | "baseline" | "search-winner"

export const workflowGraphCardDetail = ({
  bestSelection,
  kind,
  winnerKnobs
}: {
  readonly bestSelection: string | null
  readonly kind: WorkflowGraphCardKind
  readonly winnerKnobs: ReadonlyArray<string>
}): string =>
  Match.value(kind).pipe(
    Match.when("baseline", () => "Frozen baseline execution under the shared evaluation and render envelope."),
    Match.when(
      "authored-optimized",
      () => "Use this as the pre-search package-authored target before the winner replay lands."
    ),
    Match.when(
      "search-winner",
      () =>
        winnerKnobs.length > 0
          ? winnerKnobs.join(" · ")
          : bestSelection === null
          ? "Study-selected knobs stream here once the search winner is known."
          : `Best so far: ${bestSelection}`
    ),
    Match.exhaustive
  )

export const workflowGraphTraversalFallback = (kind: WorkflowGraphCardKind): string =>
  Match.value(kind).pipe(
    Match.when("baseline", () => "Baseline traversal arrives once the authored ledger begins."),
    Match.when("authored-optimized", () => "Held as the study anchor inside the optimization phase."),
    Match.when("search-winner", () => "Winner traversal appears after the study selects a manifest."),
    Match.exhaustive
  )

export const workflowGraphCardMetricLabel = (metric: WorkflowGraphCardMetric): string =>
  Match.value(metric).pipe(
    Match.when("nodes", () => "Nodes"),
    Match.when("score", () => "Score"),
    Match.exhaustive
  )
