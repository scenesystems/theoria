/**
 * Shared dataset handling for prompt-surface-ready coding cases.
 *
 * @since 0.2.0
 */
import { Array as Arr, Effect, Schema } from "effect"

import type { CodingPromptDataset } from "./schema.js"
import { type CodingPromptCase, type CodingPromptDatasetSplit, CodingPromptDatasetSplitSchema } from "./schema.js"

/**
 * Strict split-selection failure for coding datasets.
 *
 * @since 0.2.0
 * @category errors
 */
export class CodingDatasetSelectionError extends Schema.TaggedError<CodingDatasetSelectionError>()(
  "CodingDatasetSelectionError",
  {
    datasetId: Schema.String,
    requestedSplits: Schema.Array(CodingPromptDatasetSplitSchema),
    message: Schema.String
  }
) {}

/**
 * Selects dataset cases for the requested splits and fails instead of silently
 * falling back when the selection is invalid or empty.
 *
 * @since 0.2.0
 * @category constructors
 */
export const selectCodingPromptDatasetCases = (
  dataset: CodingPromptDataset,
  requestedSplits: ReadonlyArray<CodingPromptDatasetSplit>
): Effect.Effect<ReadonlyArray<CodingPromptCase>, CodingDatasetSelectionError> => {
  if (requestedSplits.length === 0) {
    return Effect.fail(
      new CodingDatasetSelectionError({
        datasetId: dataset.datasetId,
        requestedSplits: Arr.empty(),
        message: `Dataset '${dataset.datasetId}' requires at least one explicit split selection.`
      })
    )
  }

  const selected = Arr.filter(dataset.cases, (value) => Arr.some(requestedSplits, (split) => split === value.split))

  return selected.length > 0
    ? Effect.succeed(selected)
    : Effect.fail(
      new CodingDatasetSelectionError({
        datasetId: dataset.datasetId,
        requestedSplits,
        message: `Dataset '${dataset.datasetId}' has no cases for splits: ${requestedSplits.join(", ")}.`
      })
    )
}
