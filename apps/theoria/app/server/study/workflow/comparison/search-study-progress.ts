import { Either, Option, Schema } from "effect"
import type { StudyEvent } from "effect-search/StudyEvent"
import * as SearchStudyEvent from "effect-search/StudyEvent"
import * as Arr from "effect/Array"
import * as Record from "effect/Record"

import type { EvidenceItem, EvidenceSection } from "../../../../contracts/evidence/item.js"
import {
  canonicalStepEvent,
  Choreography,
  type EvidenceEvent,
  SectionUpsert
} from "../../../../contracts/evidence/stream.js"
import { StageAdvance, StageEnter } from "../../../../contracts/study/workflow/choreography.js"
import {
  workflowComparisonEvidenceItemKeys,
  workflowComparisonEvidenceSectionKeys
} from "../../../../contracts/study/workflow/comparison/evidence.js"
import { WorkflowComparisonCanonicalStep } from "../../../../contracts/study/workflow/comparison/step.js"
import type { FrozenWorkflowComparisonRun } from "./frozen.js"
import { type WorkflowComparisonSelectedKnobs, WorkflowComparisonSelectedKnobsSchema } from "./runtime-plan.js"
import type { WorkflowComparisonSearchEvaluation } from "./search-study-schema.js"
import { selectionValue, type WorkflowComparisonSearchDimension } from "./search-study-space.js"

const encodeUnknownJson = Schema.encodeSync(Schema.parseJson(Schema.Unknown))
const decodeSelectedKnobsEither = Schema.decodeUnknownEither(WorkflowComparisonSelectedKnobsSchema)

const formatSelection = ({
  dimensions,
  selection
}: {
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly selection: WorkflowComparisonSelectedKnobs
}): string =>
  dimensions
    .map((dimension) => `${dimension.key}=${selectionValue({ fallback: "unset", key: dimension.key, selection })}`)
    .join(" · ")

const formatSelectionFromConfig = ({
  config,
  dimensions
}: {
  readonly config: unknown
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
}): string =>
  Either.match(decodeSelectedKnobsEither(config), {
    onLeft: () => encodeUnknownJson(config),
    onRight: (selection) => formatSelection({ dimensions, selection })
  })

const formatObjectiveValue = (value: number | ReadonlyArray<number>): string =>
  typeof value === "number"
    ? value.toFixed(6)
    : Arr.isNonEmptyReadonlyArray(value)
    ? value.map((entry) => entry.toFixed(6)).join(", ")
    : "n/a"

export const formatEventDetail = ({
  dimensions,
  event
}: {
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly event: StudyEvent
}): string =>
  SearchStudyEvent.matchStudyEvent<string>({
    TrialStarted: ({ config, trialNumber }) =>
      `trial ${trialNumber} reserved · ${formatSelectionFromConfig({ config, dimensions })}`,
    TrialCompleted: ({ trialNumber, value }) => `trial ${trialNumber} completed · score ${formatObjectiveValue(value)}`,
    BestUpdated: ({ trialNumber, value }) =>
      `best updated by trial ${trialNumber} · score ${formatObjectiveValue(value)}`,
    TrialReported: ({ decision, step, trialNumber, value }) =>
      `trial ${trialNumber} reported ${formatObjectiveValue(value)} at step ${step} · ${decision._tag}`,
    TrialPruned: ({ trialNumber, reason }) => `trial ${trialNumber} pruned · ${reason}`,
    TrialRetried: ({ attempt, trialNumber }) => `trial ${trialNumber} retried · attempt ${attempt}`,
    TrialCancelled: ({ reason, trialNumber }) => `trial ${trialNumber} cancelled · ${reason}`,
    TrialFailed: ({ error, trialNumber }) => `trial ${trialNumber} failed · ${error.message}`,
    TrialCosted: ({ cost, cumulativeCost, trialNumber }) =>
      `trial ${trialNumber} cost ${cost.toFixed(3)} · cumulative ${cumulativeCost.toFixed(3)}`,
    StudyStopRequested: ({ mode, reason }) => `stop requested · ${mode} · ${reason}`,
    BracketStarted: ({ bracketIndex, configs, minResource }) =>
      `bracket ${bracketIndex} started · ${configs} configs · min resource ${minResource}`,
    RoundStarted: ({ bracketIndex, nConfigs, resource, roundIndex }) =>
      `round ${bracketIndex}.${roundIndex} started · ${nConfigs} configs · resource ${resource}`,
    RoundCompleted: ({ bracketIndex, completed, nConfigs, roundIndex }) =>
      `round ${bracketIndex}.${roundIndex} completed · ${completed}/${nConfigs}`,
    BracketCompleted: ({ bestValue, bracketIndex, rounds }) =>
      Option.fromNullable(bestValue).pipe(
        Option.match({
          onNone: () => `bracket ${bracketIndex} completed · ${rounds} rounds`,
          onSome: (value) =>
            `bracket ${bracketIndex} completed · best ${formatObjectiveValue(value)} · ${rounds} rounds`
        })
      ),
    StudyCompleted: ({ completionReason }) => `study completed · ${completionReason}`
  })(event)

export const selectionRows = ({
  dimensions,
  selection
}: {
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly selection: WorkflowComparisonSelectedKnobs
}): ReadonlyArray<ReadonlyArray<string>> =>
  dimensions.map((dimension) => [
    dimension.key,
    selectionValue({ fallback: "unset", key: dimension.key, selection })
  ])

export const aggregateScoreForEvaluation = (evaluation: WorkflowComparisonSearchEvaluation): number =>
  evaluation.execution.report.aggregateScore

export const bestEvaluation = (
  evaluations: Readonly<Record<string, WorkflowComparisonSearchEvaluation>>
): Option.Option<WorkflowComparisonSearchEvaluation> =>
  Record.values(evaluations).reduce<Option.Option<WorkflowComparisonSearchEvaluation>>(
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

const itemText = (label: string, value: string, key?: string): EvidenceItem => ({
  _tag: "Text",
  key,
  label,
  value
})

const optimizationStudyProgressSection = ({
  best,
  completedTrials,
  current,
  dimensions,
  trialBudget
}: {
  readonly best: WorkflowComparisonSearchEvaluation
  readonly completedTrials: number
  readonly current: WorkflowComparisonSearchEvaluation
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly trialBudget: number
}): EvidenceSection => ({
  key: workflowComparisonEvidenceSectionKeys.optimizationStudyProgress,
  title: "Optimization Study Progress",
  items: [
    {
      _tag: "Scalar",
      key: workflowComparisonEvidenceItemKeys.completedTrials,
      label: "Completed trials",
      value: completedTrials,
      unit: "trials",
      format: "integer"
    },
    {
      _tag: "Scalar",
      key: workflowComparisonEvidenceItemKeys.trialBudget,
      label: "Trial budget",
      value: trialBudget,
      unit: "trials",
      format: "integer"
    },
    itemText(
      "Current selection",
      formatSelection({ dimensions, selection: current.selection }),
      workflowComparisonEvidenceItemKeys.currentSelection
    ),
    {
      _tag: "Scalar",
      key: workflowComparisonEvidenceItemKeys.currentScore,
      label: "Current score",
      value: aggregateScoreForEvaluation(current),
      unit: "score",
      format: "fixed"
    },
    itemText(
      "Best selection",
      formatSelection({ dimensions, selection: best.selection }),
      workflowComparisonEvidenceItemKeys.bestSelection
    ),
    {
      _tag: "Scalar",
      key: workflowComparisonEvidenceItemKeys.bestScore,
      label: "Best score",
      value: aggregateScoreForEvaluation(best),
      unit: "score",
      format: "fixed"
    }
  ]
})

export const optimizationStudyStartedEvents = ({
  trialBudget
}: {
  readonly trialBudget: number
}): ReadonlyArray<EvidenceEvent> => [
  new Choreography({
    cue: new StageEnter({ stageId: "optimization-study", params: { trialBudget, stepCount: trialBudget } })
  })
]

export const optimizationStudyProgressEvents = ({
  best,
  comparison,
  completedTrials,
  current,
  dimensions,
  trialBudget
}: {
  readonly best: WorkflowComparisonSearchEvaluation
  readonly comparison: FrozenWorkflowComparisonRun
  readonly completedTrials: number
  readonly current: WorkflowComparisonSearchEvaluation
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly trialBudget: number
}): ReadonlyArray<EvidenceEvent> => [
  new Choreography({ cue: new StageAdvance({ stageId: "optimization-study", step: completedTrials - 1 }) }),
  canonicalStepEvent(
    new WorkflowComparisonCanonicalStep({
      comparisonId: comparison.comparisonId,
      workflowKind: comparison.workflowKind,
      variant: "optimized",
      nodeId: "optimization-study",
      nodeKind: "critic",
      runtimeRole: "critic",
      stepIndex: completedTrials,
      stepCount: trialBudget,
      lineage: ["optimization-study"],
      activeStateLanes: ["conversation"],
      outputText:
        `Completed ${completedTrials}/${trialBudget} optimization trials. Current ${current.selectionKey} scored ${
          aggregateScoreForEvaluation(current).toFixed(6)
        }; best so far is ${best.selectionKey} at ${aggregateScoreForEvaluation(best).toFixed(6)}.`,
      aggregateScore: aggregateScoreForEvaluation(best)
    })
  ),
  new SectionUpsert({
    section: optimizationStudyProgressSection({
      best,
      completedTrials,
      current,
      dimensions,
      trialBudget
    })
  })
]
