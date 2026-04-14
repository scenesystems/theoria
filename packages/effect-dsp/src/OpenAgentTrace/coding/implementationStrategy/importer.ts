/**
 * Deterministic importer for the checked-in Amp implementation-strategy corpus.
 *
 * @since 0.2.0
 */
import { Effect, Option, Schema } from "effect"

import type { OpenAgentTraceRecord } from "../../schema.js"
import { projectCodingEvidence } from "../evidence.js"
import { projectCodingOutcome } from "../outcome.js"
import {
  CodingPromptCase,
  CodingPromptDataset,
  type CodingPromptDataset as CodingPromptDatasetShape
} from "../schema.js"
import { projectCodingTask } from "../task.js"
import type { CaseLabel } from "./importerSchema.js"
import { Input, Output, surfaceId } from "./project.js"

/**
 * Typed import failure for checked-in implementation-strategy corpus entries.
 *
 * @since 0.2.0
 */
export class ImportError extends Schema.TaggedError<ImportError>()(
  "ImplementationStrategy/ImportError",
  {
    caseId: Schema.String,
    threadId: Schema.String,
    sessionId: Schema.String,
    message: Schema.String
  }
) {}

/**
 * Source pair consumed by the deterministic Amp implementation-strategy importer.
 *
 * @since 0.2.0
 * @category models
 */
export type ImportSource = Readonly<{
  readonly label: CaseLabel
  readonly record: OpenAgentTraceRecord
}>

const validateImportSource = (source: ImportSource) =>
  source.record.source.sessionId === source.label.threadId
    ? Effect.void
    : Effect.fail(
      new ImportError({
        caseId: source.label.caseId,
        threadId: source.label.threadId,
        sessionId: source.record.source.sessionId,
        message: "implementation-strategy label thread authority does not match the normalized capture"
      })
    )

/**
 * Compile one normalized Amp capture plus checked-in sidecar into a prompt case.
 *
 * @since 0.2.0
 * @category constructors
 */
export const importCase = (source: ImportSource) =>
  Effect.gen(function*() {
    yield* validateImportSource(source)
    const task = projectCodingTask(source.record)
    const evidence = projectCodingEvidence(source.record)
    const outcome = projectCodingOutcome(source.record, evidence)

    return new CodingPromptCase({
      caseId: source.label.caseId,
      surfaceId,
      split: source.label.split,
      task,
      evidence,
      outcome,
      input: Input.of({
        task: source.label.task,
        constraints: source.label.constraints,
        files: source.label.files,
        rejectedMoves: source.label.rejectedMoves
      }),
      expectedOutput: Output.of(source.label.expectedStrategy)
    })
  })

/**
 * Compile a checked-in Amp corpus into a deterministic coding prompt dataset.
 *
 * @since 0.2.0
 * @category constructors
 */
export const importDataset = (options: {
  readonly datasetId: string
  readonly sources: readonly [
    ImportSource,
    ...ReadonlyArray<ImportSource>
  ]
}): Effect.Effect<CodingPromptDatasetShape, ImportError> =>
  Effect.forEach(options.sources, importCase, { concurrency: 1 }).pipe(
    Effect.flatMap((cases) => {
      return Option.fromNullable(cases[0]).pipe(
        Option.match({
          onNone: () =>
            Effect.fail(
              new ImportError({
                caseId: options.datasetId,
                threadId: "dataset",
                sessionId: "dataset",
                message: "implementation-strategy dataset import produced no cases"
              })
            ),
          onSome: (firstCase) =>
            Effect.succeed(
              CodingPromptDataset.of({
                datasetId: options.datasetId,
                surfaceId,
                cases: [firstCase, ...cases.slice(1)]
              })
            )
        })
      )
    })
  )
