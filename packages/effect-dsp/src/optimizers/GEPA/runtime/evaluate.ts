/**
 * GEPA candidate evaluation runtime.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Inspectable, Option, Ref, Schema, String as Str } from "effect"

import { MetricResult } from "../../../contracts/MetricResult.js"
import { withModuleParamsInstructions } from "../../../contracts/ModuleParams.js"
import { encodePayload } from "../../../contracts/Payload.js"
import { ReflectiveDatasetSample } from "../model.js"
import { CandidateScoreVector, type ProgramCandidate } from "../model.js"

import { instructionForPredictor, withFeedback } from "./helpers.js"
import type { GEPAExamples, GEPAOptions } from "./options.js"

/**
 * Materialized candidate evaluation rows.
 *
 * @since 0.1.0
 * @category models
 */
export class CandidateEvaluation extends Schema.Class<CandidateEvaluation>("GEPACandidateEvaluation")({
  scores: CandidateScoreVector,
  samples: Schema.Array(ReflectiveDatasetSample)
}) {}

class CandidateEvaluationRow extends Schema.Class<CandidateEvaluationRow>("GEPACandidateEvaluationRow")({
  score: Schema.Number,
  sample: ReflectiveDatasetSample
}) {}

const resolveValset = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>(
  options: GEPAOptions<I, O, ME, MR, E, R>
): GEPAExamples =>
  Arr.filter(
    Option.getOrElse(Option.fromNullable(options.valset), () => options.trainset),
    (example) => Option.isSome(Option.fromNullable(example.output))
  )

/**
 * Evaluate one candidate against the resolved validation set.
 *
 * @since 0.1.0
 * @category constructors
 */
export const evaluateCandidate = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, E, R>(
  options: GEPAOptions<I, O, ME, MR, E, R>,
  candidate: ProgramCandidate
) =>
  Effect.acquireUseRelease(
    Ref.get(options.module.params).pipe(
      Effect.tap((original) =>
        Ref.set(
          options.module.params,
          withModuleParamsInstructions(
            original,
            Option.getOrElse(instructionForPredictor(candidate, options.module.name), () => original.instructions)
          )
        )
      )
    ),
    () => {
      const decodeInput = Schema.decodeUnknown(options.module.signature.inputSchema)
      const decodeOutput = Schema.decodeUnknown(options.module.signature.outputSchema)

      return Effect.forEach(resolveValset(options), (example, index) =>
        Effect.gen(function*() {
          const expectedOutputRaw = Option.getOrElse(Option.fromNullable(example.output), () => example.input)
          const moduleInput = yield* decodeInput(example.input)
          const expectedOutput = yield* decodeOutput(expectedOutputRaw)
          const prediction = yield* options.module.forward(moduleInput)
          const inputs = yield* encodePayload(options.module.signature.inputSchema, moduleInput)
          const generatedOutputs = yield* encodePayload(options.module.signature.outputSchema, prediction)
          const expectedDocument = yield* encodePayload(options.module.signature.outputSchema, expectedOutput)
          const metricResult = yield* options.metric.score(prediction, expectedOutput)
          const normalizedMetric = new MetricResult({
            score: metricResult.score,
            ...withFeedback(Option.fromNullable(metricResult.feedback))
          })

          return new CandidateEvaluationRow({
            score: metricResult.score,
            sample: new ReflectiveDatasetSample({
              exampleId: Str.concat("example-", Inspectable.toStringUnknown(index)),
              predictorName: options.module.name,
              inputs,
              generatedOutputs,
              expectedOutput: expectedDocument,
              metricResult: normalizedMetric
            })
          })
        }), { concurrency: "inherit" }).pipe(
          Effect.map((rows) =>
            new CandidateEvaluation({
              scores: Arr.map(rows, (row) => row.score),
              samples: Arr.map(rows, (row) => row.sample)
            })
          )
        )
    },
    (original) => Ref.set(options.module.params, original)
  )
