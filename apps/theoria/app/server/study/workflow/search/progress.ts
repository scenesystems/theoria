import { Option } from "effect"
import * as Record from "effect/Record"

import type { WorkflowSearchEvaluation } from "./schema.js"

export const aggregateScoreForEvaluation = (evaluation: WorkflowSearchEvaluation): number =>
  evaluation.execution.report.aggregateScore

export const bestEvaluation = (
  evaluations: Readonly<Record<string, WorkflowSearchEvaluation>>
): Option.Option<WorkflowSearchEvaluation> =>
  Record.values(evaluations).reduce<Option.Option<WorkflowSearchEvaluation>>(
    (best, evaluation) =>
      Option.match(best, {
        onNone: () => Option.some(evaluation),
        onSome: (currentBest) =>
          Option.some(
            aggregateScoreForEvaluation(evaluation) > aggregateScoreForEvaluation(currentBest)
              ? evaluation
              : currentBest
          )
      }),
    Option.none()
  )
