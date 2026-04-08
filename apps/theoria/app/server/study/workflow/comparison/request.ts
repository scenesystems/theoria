import { Effect } from "effect"

import { DemoExecutionError } from "../../../../contracts/demo-error.js"
import type { EntryDraft } from "../../../../contracts/entry/registry.js"

import type { EntryStreamRequest } from "../../../kernel/stream-request.js"

type WorkflowEntryDraft = Extract<EntryDraft, { readonly entryId: "workflow" }>

const invalidWorkflowEntryRequestError = (): DemoExecutionError =>
  new DemoExecutionError({
    code: "invalid-demo-id",
    message: "Run workflow request does not match the workflow entry.",
    retryable: false
  })

export const workflowEntryDraftForRequest = (
  request: EntryStreamRequest
): Effect.Effect<WorkflowEntryDraft, DemoExecutionError, never> =>
  request.draft === null || request.draft.entryId !== "workflow"
    ? Effect.fail(invalidWorkflowEntryRequestError())
    : Effect.succeed(request.draft)
