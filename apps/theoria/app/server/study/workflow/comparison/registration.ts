import { Effect } from "effect"

import { workflowEntryDescriptor } from "../../../../contracts/entry/descriptors/workflow.js"
import type { StreamManifest } from "../../../../contracts/evidence/manifest.js"
import type { RunData } from "../../../../contracts/study/run.js"

import type { EntryRunEnv } from "../../../kernel/registration.js"
import { makeEntryRegistration } from "../../../kernel/registration.js"
import { preloadProgram, workflowEntryWorkflowRegistration } from "./workflow.js"

const acceptsManifest = (manifest: StreamManifest | null): boolean => manifest === null

const unreachableWorkflowExecution: Effect.Effect<RunData, unknown, EntryRunEnv> = Effect.dieMessage(
  "Workflow entry execution is owned by the workflow study registration."
)

export const workflowEntryRegistration = makeEntryRegistration({
  descriptor: workflowEntryDescriptor,
  lane: "provider",
  execute: unreachableWorkflowExecution,
  preloadProgram,
  acceptsManifest,
  streamPlan: null,
  workflowRegistration: workflowEntryWorkflowRegistration
})
