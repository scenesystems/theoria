import { Effect } from "effect"

import type { EvidenceEvent } from "../../../../contracts/evidence/stream.js"
import type { WorkflowExecutionLane } from "../../../../contracts/study/workflow/controls.js"
import { WorkflowStudyExecutionError } from "../../../../contracts/study/workflow/execution.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import type { WorkflowEntrySelection } from "../../../../contracts/study/workflow/selection.js"
import type { DspProviderRuntime } from "../../../capability/effect-dsp.js"
import { workflowSearchDimensions } from "./dimensions.js"
import { executeWorkflowSearchStudy } from "./execution.js"
import { workflowSearchStudyOutcome } from "./outcome.js"
import type { WorkflowSearchStudyOutcome } from "./schema.js"

type WorkflowSearchProgressPublisher<R> = (
  events: ReadonlyArray<EvidenceEvent>
) => Effect.Effect<void, never, R>

const executionError = (message: string) =>
  new WorkflowStudyExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

export const runWorkflowSearchStudy = <R = never>({
  workflowRun,
  lane,
  plan,
  publishProgress = () => Effect.void
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly lane: WorkflowExecutionLane
  readonly plan: WorkflowEntrySelection
  readonly publishProgress?: WorkflowSearchProgressPublisher<R>
}): Effect.Effect<WorkflowSearchStudyOutcome, WorkflowStudyExecutionError, R | DspProviderRuntime> =>
  Effect.gen(function*() {
    const dimensions = yield* workflowSearchDimensions(workflowRun, plan)
    const execution = yield* executeWorkflowSearchStudy({
      workflowRun,
      dimensions,
      lane,
      publishProgress
    })

    return yield* workflowSearchStudyOutcome({
      workflowRun,
      dimensions,
      evaluations: execution.evaluations,
      events: execution.events,
      plan,
      result: execution.result,
      snapshot: execution.snapshot,
      trialBudget: execution.trialBudget
    }).pipe(
      Effect.mapError(() => executionError(`Workflow study outcome assembly failed for ${workflowRun.scenarioId}.`))
    )
  })
