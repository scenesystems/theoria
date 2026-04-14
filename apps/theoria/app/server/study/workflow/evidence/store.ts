import type { EvidenceStore } from "../../../../contracts/evidence/store.js"
import type { EvidenceEvent } from "../../../../contracts/evidence/stream.js"
import type { Program } from "../../../../contracts/presentation/program.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"

import { workflowRunDataFromStore } from "./sections.js"

export const runDataFromStore = ({
  workflowRun,
  durationMs,
  program,
  store
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly durationMs: number
  readonly program: Program
  readonly store: EvidenceStore
}) => workflowRunDataFromStore({ workflowRun, durationMs, program, store })

export const applyEventsToStore = (
  store: EvidenceStore,
  events: ReadonlyArray<EvidenceEvent>
): EvidenceStore => events.reduce((nextStore, event) => nextStore.apply(event), store)
