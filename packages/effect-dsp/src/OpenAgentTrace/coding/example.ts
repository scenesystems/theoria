/**
 * Example compilation for shared coding prompt cases.
 *
 * @since 0.2.0
 */
import { Effect, Option, Schema } from "effect"

import { Example } from "../../Example/index.js"
import { type CodingDatasetSelectionError, selectCodingPromptDatasetCases } from "./dataset.js"
import type { CodingPromptCase, CodingPromptDataset, CodingPromptDatasetSplit } from "./schema.js"

/**
 * Labeled-example compilation failure for a coding prompt case.
 *
 * @since 0.2.0
 * @category errors
 */
export class CodingExampleCompilationError extends Schema.TaggedError<CodingExampleCompilationError>()(
  "CodingExampleCompilationError",
  {
    caseId: Schema.String,
    surfaceId: Schema.String,
    message: Schema.String
  }
) {}

/**
 * Compiles one labeled coding prompt case into the existing `Example` model.
 *
 * @since 0.2.0
 * @category constructors
 */
export const codingPromptCaseToExample = (
  promptCase: CodingPromptCase
): Effect.Effect<Example, CodingExampleCompilationError> =>
  Option.fromNullable(promptCase.expectedOutput).pipe(
    Option.match({
      onNone: () =>
        Effect.fail(
          new CodingExampleCompilationError({
            caseId: promptCase.caseId,
            surfaceId: promptCase.surfaceId,
            message: `Prompt case '${promptCase.caseId}' is missing an expected output.`
          })
        ),
      onSome: (expectedOutput) => Effect.succeed(new Example({ input: promptCase.input, output: expectedOutput }))
    })
  )

/**
 * Compiles a selected set of coding prompt cases into optimizer-ready examples.
 *
 * @since 0.2.0
 * @category constructors
 */
export const codingPromptCasesToExamples = (
  promptCases: ReadonlyArray<CodingPromptCase>
): Effect.Effect<ReadonlyArray<Example>, CodingExampleCompilationError> =>
  Effect.forEach(promptCases, codingPromptCaseToExample, { concurrency: 1 })

/**
 * Selects strict dataset splits and compiles them into optimizer-ready
 * examples.
 *
 * @since 0.2.0
 * @category constructors
 */
export const codingPromptDatasetToExamples = (
  dataset: CodingPromptDataset,
  requestedSplits: ReadonlyArray<CodingPromptDatasetSplit>
): Effect.Effect<ReadonlyArray<Example>, CodingDatasetSelectionError | CodingExampleCompilationError> =>
  Effect.flatMap(selectCodingPromptDatasetCases(dataset, requestedSplits), codingPromptCasesToExamples)
