import { EntryExecutionError } from "../../../contracts/entry-error.js"
import { WorkflowStudyExecutionError } from "../../../contracts/study/workflow/execution.js"

export const normalizeWorkflowStudyExecutionError = (error: unknown): EntryExecutionError =>
  error instanceof EntryExecutionError
    ? error
    : error instanceof WorkflowStudyExecutionError
    ? new EntryExecutionError({
      code: error.code,
      message: error.message,
      retryable: error.retryable
    })
    : new EntryExecutionError({
      code: "execution-failed",
      message: String(error),
      retryable: false
    })
