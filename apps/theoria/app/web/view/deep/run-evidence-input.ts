import { Match } from "effect"

import type { RunEvidencePresentationInput } from "../../../contracts/presentation/run-evidence.js"
import type { EvidenceStreamState } from "../../state/evidence/stream.js"
import { statusFromError } from "../../state/run/status.js"
import type { RunState } from "../../state/run/types.js"

export const runEvidencePresentationInput = ({
  run,
  stream
}: {
  readonly run: RunState
  readonly stream: EvidenceStreamState
}): RunEvidencePresentationInput =>
  Match.value(run).pipe(
    Match.withReturnType<RunEvidencePresentationInput>(),
    Match.tag("RunIdle", () => ({ _tag: "RunEvidenceIdleInput" })),
    Match.tag("RunRunning", ({ session }) => ({
      _tag: "RunEvidenceInFlightInput",
      control: session.control,
      sectionCount: stream.sections.length,
      stageId: session.choreography._tag === "InStage" ? session.choreography.stageId : null,
      step: session.choreography._tag === "InStage" ? session.choreography.step : null
    })),
    Match.tag("RunFailed", ({ error }) => ({
      _tag: "RunEvidenceFailureInput",
      description: statusFromError(error),
      hasRetainedEvidence: stream.sections.length > 0
    })),
    Match.tag("RunSuccess", ({ data }) => ({
      _tag: "RunEvidenceResultsInput",
      summary: data.summary
    })),
    Match.exhaustive
  )
