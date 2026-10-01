/** Failure construction shared by search-space projection mechanisms. */
import type { InvalidSearchSpace } from "../../../SearchError.js"
import { invalidSearchSpace } from "../failure.js"

export type ProjectionOperation = "pick" | "omit"

export const projectionFailure = (
  operation: ProjectionOperation,
  reason: string,
  dimension?: string
): InvalidSearchSpace => invalidSearchSpace(`SearchSpace.${operation}: ${reason}`, dimension)
