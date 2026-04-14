import { Either, Option, Schema } from "effect"
import type { StudyEvent } from "effect-search/StudyEvent"
import * as SearchStudyEvent from "effect-search/StudyEvent"
import * as Arr from "effect/Array"

import { WorkflowSelectedKnobs } from "../../../../contracts/study/workflow/runtime-plan.js"
import type { WorkflowSearchDimension } from "../search/dimensions.js"
import { selectionValue } from "../search/selection-record.js"

const encodeUnknownJson = Schema.encodeSync(Schema.parseJson(Schema.Unknown))
const decodeSelectedKnobsEither = Schema.decodeUnknownEither(WorkflowSelectedKnobs)

export const formatSelection = ({
  dimensions,
  selection
}: {
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
  readonly selection: WorkflowSelectedKnobs
}): string =>
  dimensions
    .map((dimension) => `${dimension.key}=${selectionValue({ fallback: "unset", key: dimension.key, selection })}`)
    .join(" · ")

const formatSelectionFromConfig = ({
  config,
  dimensions
}: {
  readonly config: unknown
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
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
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
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
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
  readonly selection: WorkflowSelectedKnobs
}): ReadonlyArray<ReadonlyArray<string>> =>
  dimensions.map((dimension) => [
    dimension.key,
    selectionValue({ fallback: "unset", key: dimension.key, selection })
  ])
