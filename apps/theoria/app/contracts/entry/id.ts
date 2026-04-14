import { Schema } from "effect"

/**
 * EntryId is the only app-facing identity. AuthorityId names execution ownership.
 */
export const AuthorityId = Schema.Literal(
  "effect-math",
  "effect-search",
  "effect-dsp",
  "effect-text",
  "effect-inference",
  "digest",
  "seal",
  "sign"
)

export type AuthorityId = typeof AuthorityId.Type

export const authorityIds: ReadonlyArray<AuthorityId> = [
  "effect-math",
  "effect-search",
  "effect-dsp",
  "effect-text",
  "effect-inference",
  "digest",
  "seal",
  "sign"
]

export const WorkflowEntryId = Schema.Literal("workflow")

export type WorkflowEntryId = typeof WorkflowEntryId.Type

export const workflowEntryId: WorkflowEntryId = "workflow"

export const EntryId = WorkflowEntryId

export type EntryId = typeof EntryId.Type

export const entryIds: ReadonlyArray<EntryId> = [workflowEntryId]

export const RunnableEntryId = WorkflowEntryId

export type RunnableEntryId = typeof RunnableEntryId.Type

export const runnableEntryIds: ReadonlyArray<RunnableEntryId> = [workflowEntryId]

export const isAuthorityId = Schema.is(AuthorityId)
export const isEntryId = Schema.is(EntryId)
export const isPackageEntryId = (value: string): value is AuthorityId => isAuthorityId(value)
export const isWorkflowEntryId = Schema.is(WorkflowEntryId)
export const isRunnableEntryId = isWorkflowEntryId
