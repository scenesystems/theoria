import { DemoExecutionError } from "../../../../contracts/demo-error.js"
import { WorkflowComparisonExecutionError } from "../../../../contracts/study/workflow/comparison/run.js"

export const normalizeWorkflowComparisonExecutionError = (error: unknown): DemoExecutionError =>
  error instanceof DemoExecutionError
    ? error
    : error instanceof WorkflowComparisonExecutionError
    ? new DemoExecutionError({
      code: error.code,
      message: error.message,
      retryable: error.retryable
    })
    : new DemoExecutionError({
      code: "execution-failed",
      message: String(error),
      retryable: false
    })
