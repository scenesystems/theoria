/** Normalized output from one optimization objective evaluation. */
import { Data } from "effect"

import type { Value } from "../../Objective.js"

export class ObjectiveEvaluation extends Data.Class<{
  readonly value: Value
  readonly cost?: number
}> {}
